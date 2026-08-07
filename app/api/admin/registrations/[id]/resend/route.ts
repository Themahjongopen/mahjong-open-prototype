import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { resendOneRegistration } from "@/lib/admin/resendRegistration";

export const runtime = "nodejs";

// Admin-only: instantly re-issue a pending registration's checkout link (an
// on-demand replacement for the 2h Stripe abandoned-checkout timer). The actual
// work lives in resendOneRegistration() so the single-row and bulk routes share
// one implementation.
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
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "Payment service is unavailable right now." }, { status: 503 });
  }
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-06-24.dahlia" });
  const origin = request.headers.get("origin") || "http://localhost:3000";

  const result = await resendOneRegistration(supabase, stripe, origin, id);
  if (!result.ok) {
    const status = result.error === "Registration not found." ? 404 : 400;
    return NextResponse.json({ error: result.error ?? "Could not resend the link." }, { status });
  }
  return NextResponse.json({ ok: true, emailSent: result.emailSent });
}
