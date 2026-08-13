import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { generateInviteLink } from "@/lib/email/portalInvite";

export const runtime = "nodejs";

// Generate-only portal set-password link for a paid registrant — NO email sent.
// A last-resort fallback for players whose invite email bounces/never arrives:
// the admin generates the link here and hands it to the player directly (text,
// DM, etc.). Same trust boundary + paid guard as /api/admin/invite; the only
// difference is we return the URL instead of emailing it.
//
// Side effect (unchanged from the emailed path): generating an `invite` link for
// a never-invited player creates their auth account, so their row will show
// invite_state "invited" on the next reload — same as a normal invite.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Invite service is unavailable." }, { status: 503 });
  }

  const { data: reg, error: lookupError } = await supabase
    .from("registrations")
    .select("id, full_name, email, paid_status")
    .eq("id", id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Could not load the registration." }, { status: 502 });
  }
  if (!reg) {
    return NextResponse.json({ error: "That registration no longer exists." }, { status: 404 });
  }
  if (reg.paid_status !== "paid") {
    return NextResponse.json({ error: "Only paid registrations can be invited to the portal." }, { status: 400 });
  }

  const link = await generateInviteLink(supabase, { email: reg.email, fullName: reg.full_name });
  if (!link.ok) {
    return NextResponse.json({ error: link.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true, actionUrl: link.actionUrl });
}
