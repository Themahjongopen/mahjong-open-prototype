import { NextResponse } from "next/server";
import { createAdminClient, listAuthUsersByEmail } from "@/lib/supabase/server";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/admin/passcode";
import { sendPortalInvite } from "@/lib/email/portalInvite";

export const runtime = "nodejs";

// Defense in depth — proxy.ts already gates /api/admin/*, but re-validate here.
function isAuthorized(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`));
  if (!cookie) return false;
  return isValidAdminCookie(cookie.slice(ADMIN_COOKIE_NAME.length + 1), process.env.ADMIN_PASSCODE);
}

type Status = "sent" | "skipped" | "error";
type InviteOutcome = { registrationId: string; email: string | null; status: Status; message?: string };

// Admin-triggered portal invites — single, bulk, or Resend invite. Every path
// sends the same fully branded email via lib/email/portalInvite (generateLink +
// buildBrandedEmail + Resend), so we don't depend on Supabase SMTP template
// styling. Only PAID registrants are invited; already-active accounts (the user
// has signed in) are skipped and pointed at the password-reset flow instead.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.registrationIds)
    ? body.registrationIds.map((v: unknown) => String(v)).filter(Boolean)
    : body?.registrationId
      ? [String(body.registrationId)]
      : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "No registrations selected." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Invite service is unavailable." }, { status: 503 });
  }

  const { data: registrations, error: lookupError } = await supabase
    .from("registrations")
    .select("id, full_name, email, paid_status")
    .in("id", ids);

  if (lookupError) {
    return NextResponse.json({ error: "Could not load registrations." }, { status: 502 });
  }

  // One listUsers pass tells us who already has an account and who has signed in.
  let usersByEmail = new Map<string, { id: string; last_sign_in_at: string | null }>();
  try {
    usersByEmail = await listAuthUsersByEmail(supabase);
  } catch {
    // Non-fatal: fall back to invite-first behaviour (generateLink handles existing users).
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = new Map<string, any>((registrations ?? []).map((r: any) => [String(r.id), r]));
  const outcomes: InviteOutcome[] = [];

  for (const id of ids) {
    const reg = byId.get(id);
    if (!reg) {
      outcomes.push({ registrationId: id, email: null, status: "error", message: "Registration not found." });
      continue;
    }
    if (reg.paid_status !== "paid") {
      outcomes.push({ registrationId: id, email: reg.email, status: "skipped", message: "Not a paid registration." });
      continue;
    }
    const authUser = usersByEmail.get(String(reg.email).toLowerCase());
    if (authUser?.last_sign_in_at) {
      outcomes.push({
        registrationId: id,
        email: reg.email,
        status: "skipped",
        message: "Account is already active — use the password reset flow.",
      });
      continue;
    }

    const result = await sendPortalInvite(supabase, { email: reg.email, fullName: reg.full_name });
    outcomes.push(
      result.ok
        ? { registrationId: id, email: reg.email, status: "sent" }
        : { registrationId: id, email: reg.email, status: "error", message: result.error }
    );
  }

  const sent = outcomes.filter((o) => o.status === "sent").length;
  const failed = outcomes.filter((o) => o.status === "error").length;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;

  // A single-invite request surfaces its specific failure as a top-level error so
  // the existing single-row UI keeps showing precise messages.
  if (ids.length === 1 && sent === 0) {
    const only = outcomes[0];
    const httpStatus = only.status === "skipped" ? 409 : 502;
    return NextResponse.json({ error: only.message ?? "Could not send the invite.", outcomes }, { status: httpStatus });
  }

  return NextResponse.json({ ok: sent > 0, sent, failed, skipped, outcomes });
}
