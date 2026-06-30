import { NextResponse } from "next/server";
import { Resend } from "resend";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("Stripe webhook secret is not configured.");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error("Stripe secret key is not configured.");
    return NextResponse.json({ error: "Payment service is unavailable." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2026-06-24.dahlia",
  });

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed.", error);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const registrationId = session.metadata?.registration_id;

    if (!registrationId) {
      return NextResponse.json({ received: true });
    }

    const supabase: any = createAdminClient();

    if (!supabase) {
      return NextResponse.json({ error: "Payment service is unavailable." }, { status: 503 });
    }

    const { data: registrationData } = await supabase
      .from("registrations")
      .select("id, full_name, email, series_id, paid_status")
      .eq("id", registrationId)
      .maybeSingle();

    if (registrationData?.paid_status === "paid") {
      return NextResponse.json({ received: true });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    await supabase.from("registrations").update({ paid_status: "paid" }).eq("id", registrationId);
    await supabase
      .from("payments")
      .update({
        status: "succeeded",
        provider_payment_id: paymentIntentId,
      })
      .eq("registration_id", registrationId);

    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey && registrationData?.email) {
      const { data: seriesData } = await supabase
        .from("series")
        .select("name")
        .eq("id", registrationData.series_id)
        .single();

      const seriesName = seriesData?.name ?? "The Mahjong Open";

      try {
        const resend = new Resend(resendApiKey);

        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: [registrationData.email],
          subject: `Welcome to ${seriesName}`,
          html: `
            <p>Hi ${registrationData.full_name},</p>
            <p>Thank you for registering for <strong>${seriesName}</strong>.</p>
            <p>Your payment was successful, and your registration is now confirmed.</p>
            <p>The player portal opens before the series begins, and we’ll share access details by email when it’s ready.</p>
            <p>Thanks again,<br />The Mahjong Open</p>
          `,
        });
      } catch (emailError) {
        console.error("Welcome email failed after payment confirmation.", emailError);
      }
    }
  }

  return NextResponse.json({ received: true });
}
