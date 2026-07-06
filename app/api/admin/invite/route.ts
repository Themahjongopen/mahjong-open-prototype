import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/admin/passcode";
import { SITE_URL } from "@/lib/site";

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

// Admin-triggered portal invite. Invites a single PAID registrant via Supabase
// Auth; the invite email (Supabase → Resend SMTP) lands them on /portal/set-password.
// The 007 trigger creates their profile and links registrations.profile_id on
// account creation.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const registrationId = body?.registrationId?.toString();
  if (!registrationId) {
    return NextResponse.json({ error: "Missing registrationId." }, { status: 400 });
  }

  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Invite service is unavailable." }, { status: 503 });
  }

  const { data: registration, error: lookupError } = await supabase
    .from("registrations")
    .select("id, full_name, email, paid_status, profile_id")
    .eq("id", registrationId)
    .maybeSingle();

  if (lookupError || !registration) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  if (registration.paid_status !== "paid") {
    return NextResponse.json({ error: "Only paid registrations can be invited." }, { status: 400 });
  }
  if (registration.profile_id) {
    return NextResponse.json({ error: "This registrant already has a portal account." }, { status: 409 });
  }

  const { error: inviteError } = await supabase.auth.admin.inviteUserByEmail(registration.email, {
    data: { full_name: registration.full_name },
    redirectTo: `${SITE_URL}/portal/auth/callback?next=/portal/set-password`,
  });

  if (inviteError) {
    // Most common: the auth user already exists (previously invited).
    const alreadyExists = /already been registered|already exists|already registered/i.test(inviteError.message ?? "");
    return NextResponse.json(
      { error: alreadyExists ? "An account for this email already exists." : "Could not send the invite." },
      { status: alreadyExists ? 409 : 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
