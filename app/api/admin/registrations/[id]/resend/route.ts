import { NextResponse } from "next/server";
import Stripe from "stripe";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { sendRegistrationReminderEmail } from "@/lib/email/registrationReminderEmail";

export const runtime = "nodejs";

// Admin-only: instantly re-issue a pending registration's checkout link (an
// on-demand replacement for the 2h Stripe abandoned-checkout timer). Expires the
// old session, creates a fresh one identical to /api/register's, and emails the
// same "complete your registration" reminder.
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
    .select("id, full_name, email, phone, city_id, series_id, skill_level, avatar_url, paid_status, stripe_session_id")
    .eq("id", id)
    .maybeSingle();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  }
  if (reg.paid_status !== "pending") {
    return NextResponse.json({ error: "This registration isn't pending — there's nothing to resend." }, { status: 400 });
  }

  const { data: seriesData } = await supabase
    .from("series")
    .select("name, price_cents, is_active, registration_closes_at")
    .eq("id", reg.series_id)
    .single();
  if (!seriesData) {
    return NextResponse.json({ error: "The series could not be found." }, { status: 404 });
  }

  // Mirror /api/register's registrationClosed check exactly.
  const today = new Date().toISOString().slice(0, 10);
  const registrationClosed =
    !seriesData.is_active ||
    (seriesData.registration_closes_at && seriesData.registration_closes_at < today);
  if (registrationClosed) {
    return NextResponse.json({ error: "Registration for this series has closed — a new link can't be issued." }, { status: 400 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: "Payment service is unavailable right now." }, { status: 503 });
  }
  const stripe = new Stripe(stripeSecretKey, { apiVersion: "2026-06-24.dahlia" });

  // Step 5: stamp reminder_sent_at FIRST — this is the same idempotency guard the
  // checkout.session.expired webhook checks, so when expiring the old session
  // below fires that webhook, the automatic path sees this set and skips sending,
  // preventing a duplicate email. Order matters: must precede the expire below.
  await supabase.from("registrations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", reg.id);

  // Step 6: best-effort expire the OLD session (skip if there isn't one).
  if (reg.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(reg.stripe_session_id);
    } catch (err) {
      // Already expired/completed/nonexistent — fine, non-fatal.
      console.error("[resend] could not expire old session (non-fatal)", reg.stripe_session_id, err);
    }
  }

  // Step 7: new Checkout Session — identical shape to /api/register.
  const origin = request.headers.get("origin") || "http://localhost:3000";
  const expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: reg.email,
      expires_at: expiresAt,
      allow_promotion_codes: true,
      after_expiration: {
        recovery: {
          enabled: true,
        },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: seriesData.price_cents,
            product_data: {
              name: seriesData.name,
            },
          },
        },
      ],
      success_url: `${origin}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/register/cancelled`,
      client_reference_id: reg.id,
      metadata: {
        registration_id: reg.id,
        series_id: reg.series_id,
        email: reg.email,
      },
      payment_intent_data: {
        metadata: {
          registration_id: reg.id,
        },
      },
    });
  } catch (err) {
    console.error("[resend] failed to create new checkout session", err);
    return NextResponse.json({ error: "Could not create a new checkout link. Please try again." }, { status: 500 });
  }

  // Step 8: point the registration at the new session.
  await supabase.from("registrations").update({ stripe_session_id: session.id }).eq("id", reg.id);

  // Step 9: send the reminder now, using the NEW session's own checkout URL (it
  // hasn't expired, so there's no recovery URL). Report emailSent honestly.
  let emailSent = false;
  try {
    const res = await sendRegistrationReminderEmail(
      { email: reg.email, fullName: reg.full_name },
      { seriesName: seriesData.name, checkoutUrl: session.url ?? "" }
    );
    emailSent = res.ok;
    if (!res.ok) console.error("[resend] reminder email not sent", res.error);
  } catch (err) {
    console.error("[resend] reminder email threw", err);
  }

  return NextResponse.json({ ok: true, emailSent });
}
