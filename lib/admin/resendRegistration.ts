import type Stripe from "stripe";
import { sendRegistrationReminderEmail } from "@/lib/email/registrationReminderEmail";

export type ResendResult = { ok: boolean; emailSent?: boolean; skipped?: boolean; error?: string };

// Core logic for re-issuing one pending registration's checkout link + reminder
// email. Used by both the single-row resend route and the new bulk route, so
// they can never drift apart. `skipped: true` distinguishes "nothing to do here"
// (not pending, or registration closed) from a real failure, so bulk callers can
// report accurate sent/skipped/failed counts.
export async function resendOneRegistration(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  stripe: Stripe,
  origin: string,
  id: string
): Promise<ResendResult> {
  const { data: reg } = await supabase
    .from("registrations")
    .select("id, full_name, email, phone, city_id, series_id, skill_level, avatar_url, paid_status, stripe_session_id")
    .eq("id", id)
    .maybeSingle();
  if (!reg) return { ok: false, error: "Registration not found." };
  if (reg.paid_status !== "pending") {
    return { ok: false, skipped: true, error: "This registration isn't pending — there's nothing to resend." };
  }

  const { data: seriesData } = await supabase
    .from("series")
    .select("name, price_cents, is_active, registration_closes_at")
    .eq("id", reg.series_id)
    .single();
  if (!seriesData) return { ok: false, error: "The series could not be found." };

  const today = new Date().toISOString().slice(0, 10);
  const registrationClosed =
    !seriesData.is_active || (seriesData.registration_closes_at && seriesData.registration_closes_at < today);
  if (registrationClosed) {
    return { ok: false, skipped: true, error: "Registration for this series has closed — a new link can't be issued." };
  }

  await supabase.from("registrations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", reg.id);

  if (reg.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(reg.stripe_session_id);
    } catch (err) {
      console.error("[resend] could not expire old session (non-fatal)", reg.stripe_session_id, err);
    }
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: reg.email,
      expires_at: expiresAt,
      allow_promotion_codes: true,
      after_expiration: { recovery: { enabled: true } },
      line_items: [
        { quantity: 1, price_data: { currency: "usd", unit_amount: seriesData.price_cents, product_data: { name: seriesData.name } } },
      ],
      success_url: `${origin}/register/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/register/cancelled`,
      client_reference_id: reg.id,
      metadata: { registration_id: reg.id, series_id: reg.series_id, email: reg.email },
      payment_intent_data: { metadata: { registration_id: reg.id } },
    });
  } catch (err) {
    console.error("[resend] failed to create new checkout session", err);
    return { ok: false, error: "Could not create a new checkout link. Please try again." };
  }

  await supabase.from("registrations").update({ stripe_session_id: session.id }).eq("id", reg.id);

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

  return { ok: true, emailSent };
}
