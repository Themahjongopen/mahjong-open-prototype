import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, email, phone, city_id, series_id, skill_level, avatar_url } = body;

    if (!full_name || !email || !phone || !city_id || !series_id || !skill_level || !avatar_url) {
      return NextResponse.json({ error: "Please complete all required fields, including a profile photo." }, { status: 400 });
    }

    // Only accept a photo URL from our own Supabase Storage avatars bucket.
    const storageBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!storageBase || !String(avatar_url).startsWith(`${storageBase}/storage/v1/object/public/avatars/`)) {
      return NextResponse.json({ error: "Invalid profile photo." }, { status: 400 });
    }

    const supabase: any = createAdminClient();

    if (!supabase) {
      console.error("Registration failed because Supabase admin credentials are missing.");
      return NextResponse.json({ error: "Registration service is unavailable right now." }, { status: 503 });
    }

    // Validate the series up front — before touching the registrations table —
    // so a deactivated or past-deadline series never leaves a pending
    // registration behind. We reuse this row's name/price for Stripe below.
    const { data: seriesData, error: seriesError } = await supabase
      .from("series")
      .select("name, price_cents, is_active, registration_closes_at")
      .eq("id", series_id)
      .single();

    if (seriesError || !seriesData) {
      return NextResponse.json({ error: "The selected series could not be found." }, { status: 404 });
    }

    // registration_closes_at is an inclusive date (registration stays open
    // through that day); a series that isn't active is treated as closed too.
    const today = new Date().toISOString().slice(0, 10);
    const registrationClosed =
      !seriesData.is_active ||
      (seriesData.registration_closes_at && seriesData.registration_closes_at < today);

    if (registrationClosed) {
      return NextResponse.json({ error: "Registration for this series has closed." }, { status: 400 });
    }

    const { data: existingRegistration, error: lookupError } = await supabase
      .from("registrations")
      .select("id, paid_status")
      .eq("email", email)
      .eq("series_id", series_id)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: "Registration could not be loaded. Please try again." }, { status: 500 });
    }

    let registrationId = existingRegistration?.id;

    if (existingRegistration?.paid_status === "paid") {
      return NextResponse.json({ error: "You’re already registered for this series." }, { status: 409 });
    }

    if (registrationId) {
      const { error: updateError } = await supabase
        .from("registrations")
        .update({
          full_name,
          phone,
          city_id,
          skill_level,
          avatar_url,
          paid_status: "pending",
        })
        .eq("id", registrationId);

      if (updateError) {
        return NextResponse.json({ error: "Registration could not be updated. Please try again." }, { status: 500 });
      }
    } else {
      const { data: insertedRegistration, error: insertError } = await supabase
        .from("registrations")
        .insert({
          full_name,
          email,
          phone,
          city_id,
          series_id,
          skill_level,
          avatar_url,
          paid_status: "pending",
        })
        .select("id")
        .single();

      if (insertError) {
        if (insertError.code === "23505") {
          return NextResponse.json({ error: "You are already registered for this series." }, { status: 409 });
        }

        return NextResponse.json({ error: "Registration could not be saved. Please try again." }, { status: 500 });
      }

      registrationId = insertedRegistration.id;
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      return NextResponse.json({ error: "Payment service is unavailable right now." }, { status: 503 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-06-24.dahlia",
    });

    const origin = request.headers.get("origin") || "http://localhost:3000";

    const expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      expires_at: expiresAt,
      // Show the "Add promotion code" field on Stripe's hosted checkout. Coupons
      // and their promotion codes are managed in the Stripe dashboard; Stripe
      // validates the code, applies the discount, and enforces limits/expiry.
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
      // Redundant linkage to the registration row: metadata AND client_reference_id.
      // Stripe copies both onto recovery sessions, so the webhook can reconnect even
      // if one is missing.
      client_reference_id: registrationId,
      metadata: {
        registration_id: registrationId,
        series_id,
        email,
      },
      payment_intent_data: {
        metadata: {
          registration_id: registrationId,
        },
      },
    });

    const { data: existingPayment, error: paymentLookupError } = await supabase
      .from("payments")
      .select("id")
      .eq("registration_id", registrationId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (paymentLookupError) {
      return NextResponse.json({ error: "Payment record could not be prepared. Please try again." }, { status: 500 });
    }

    if (existingPayment) {
      const { error: paymentUpdateError } = await supabase
        .from("payments")
        .update({
          amount_cents: seriesData.price_cents,
          currency: "USD",
          status: "pending",
          provider: "stripe",
          provider_payment_id: null,
        })
        .eq("id", existingPayment.id);

      if (paymentUpdateError) {
        return NextResponse.json({ error: "Payment record could not be prepared. Please try again." }, { status: 500 });
      }
    } else {
      const { error: paymentInsertError } = await supabase.from("payments").insert({
        registration_id: registrationId,
        amount_cents: seriesData.price_cents,
        currency: "USD",
        status: "pending",
        provider: "stripe",
        provider_payment_id: null,
      });

      if (paymentInsertError) {
        return NextResponse.json({ error: "Payment record could not be prepared. Please try again." }, { status: 500 });
      }
    }

    return NextResponse.json({ url: session.url });
  } catch {
    return NextResponse.json({ error: "Invalid registration payload." }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function PATCH() {
  return NextResponse.json({ ok: true });
}
