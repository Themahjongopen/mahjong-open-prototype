import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { resendOneRegistration } from "@/lib/admin/resendRegistration";

export const runtime = "nodejs";

// Admin-only: bulk version of the single-row resend, for the admin Players
// page's checkbox selection. Loops sequentially (not Promise.all) to avoid
// bursting Stripe's rate limits when resending to many pending registrants at
// once. Returns { sent, skipped, failed } — the same shape /api/admin/invite
// already uses — so the existing result-banner pattern works unchanged.
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No registrations selected." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "Payment service is unavailable right now." }, { status: 503 });
  }
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-06-24.dahlia" });
  const origin = request.headers.get("origin") || "http://localhost:3000";

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const id of ids) {
    const result = await resendOneRegistration(supabase, stripe, origin, id);
    if (result.ok) sent += 1;
    else if (result.skipped) skipped += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}
