import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Admin-only: mark a paid registration as refunded. This is a status-sync
// action only — it does NOT call Stripe or process an actual refund. Use it
// after issuing the refund in the Stripe dashboard, to reflect that back into
// the app. Every place that reads paid_status (directory_members, the
// standings views, lib/portal/session.ts, and the admin paid-city-count logic)
// filters strictly on paid_status = 'paid', so this single column flip is
// sufficient to drop the player from standings/directory/table eligibility —
// no other table needs to change. Does NOT touch the linked auth account;
// portal login is untouched by design (see build prompt for rationale).
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  const { data: reg } = await supabase
    .from("registrations")
    .select("id, paid_status")
    .eq("id", id)
    .maybeSingle();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  if (reg.paid_status !== "paid") {
    return NextResponse.json({ error: "Only a paid registration can be marked refunded." }, { status: 400 });
  }

  const { error } = await supabase
    .from("registrations")
    .update({ paid_status: "refunded" })
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: "Could not update the registration." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
