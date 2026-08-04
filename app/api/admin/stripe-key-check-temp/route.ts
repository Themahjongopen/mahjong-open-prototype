import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getPortalUser } from "@/lib/portal/session";

// TEMPORARY diagnostic route — not linked from any UI, admin-gated, read-only.
// Purpose: confirm which Stripe account the production STRIPE_SECRET_KEY
// actually belongs to, without ever exposing the key value itself. Added to
// debug a promo-code-always-invalid issue where the hypothesis is that the
// deployed key points at a different Stripe account than the one being used
// to manage coupons in the dashboard.
//
// Delete this file once the mismatch is confirmed/ruled out — it should not
// stay in the codebase long-term.
export async function GET() {
  const session = await getPortalUser();
  if (!session || session.status !== "active" || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY is not set in this environment." }, { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-06-24.dahlia" });

  try {
    const account = await stripe.accounts.retrieve(null);
    return NextResponse.json({
      keyMode: stripeSecretKey.startsWith("sk_live_") ? "live" : stripeSecretKey.startsWith("sk_test_") ? "test" : "unknown",
      accountId: account.id,
      accountEmail: account.email ?? null,
      businessName: account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? null,
      country: account.country ?? null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Stripe request failed" }, { status: 502 });
  }
}
