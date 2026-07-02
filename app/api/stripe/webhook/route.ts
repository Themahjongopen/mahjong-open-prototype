import { NextResponse } from "next/server";
import { Resend } from "resend";
import Stripe from "stripe";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
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

  const supabase: any = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Payment service is unavailable." }, { status: 503 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const registrationId = session.metadata?.registration_id;

    if (!registrationId) {
      return NextResponse.json({ received: true });
    }

    const { data: registrationData } = await supabase
      .from("registrations")
      .select("id, full_name, email, phone, city_id, series_id, paid_status, created_at")
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
        .select("name, price_cents, starts_at, ends_at")
        .eq("id", registrationData.series_id)
        .single();

      const { data: cityData } = await supabase
        .from("cities")
        .select("name")
        .eq("id", registrationData.city_id)
        .maybeSingle();

      const cityName = cityData?.name ?? "Unknown city";
      const seriesName = seriesData?.name ?? "The Mahjong Open";
      const firstName = (registrationData.full_name || "there").split(" ")[0];
      const amountPaid =
        typeof seriesData?.price_cents === "number"
          ? `$${(seriesData.price_cents / 100).toFixed(2)}`
          : "$80.00";
      const formatDate = (value?: string) =>
        value
          ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : "";
      const dateRange =
        seriesData?.starts_at && seriesData?.ends_at
          ? `${formatDate(seriesData.starts_at)} – ${formatDate(seriesData.ends_at)}`
          : "";
      const registeredAt = registrationData.created_at
        ? new Date(registrationData.created_at).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "Unknown";

      const SITE_URL = "https://themahjongopen.com";
      const RULEBOOK_URL = "";
      const rulebookBlock = RULEBOOK_URL
        ? `<tr><td style="padding:6px 40px 4px 40px;font-family:Helvetica,Arial,sans-serif;"><p style="margin:0;font-size:15px;line-height:1.65;color:#3a4a4f;">New to the game or want a refresher? <a href="${RULEBOOK_URL}" style="color:#c60e31;font-weight:bold;text-decoration:underline;">Read the official rulebook</a> so you&rsquo;re ready for your first table.</p></td></tr>`
        : "";

      const internalNoticeInnerHtml = `
        <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3a4a4f;">
          <p style="margin:0 0 12px 0;"><strong>Name:</strong> ${registrationData.full_name}</p>
          <p style="margin:0 0 12px 0;"><strong>Email:</strong> ${registrationData.email}</p>
          <p style="margin:0 0 12px 0;"><strong>Phone:</strong> ${registrationData.phone || "Not provided"}</p>
          <p style="margin:0 0 12px 0;"><strong>City:</strong> ${cityName}</p>
          <p style="margin:0 0 12px 0;"><strong>Series:</strong> ${seriesName}</p>
          <p style="margin:0 0 12px 0;"><strong>Amount paid:</strong> ${amountPaid}</p>
          <p style="margin:0;"><strong>Registered at:</strong> ${registeredAt}</p>
        </div>
      `;

      const innerHtml = `
        <p style="margin:0 0 4px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Your payment was successful and your spot in <strong style="color:#1d4d59;">${seriesName}</strong> is confirmed. We can&rsquo;t wait to see you at the table.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f2;border:1px solid #dde7e0;border-radius:10px;margin:18px 0 0 0;">
          <tr>
            <td style="padding:18px 22px;font-family:Helvetica,Arial,sans-serif;">
              <div style="font-size:11px;letter-spacing:1px;color:#8a9a93;text-transform:uppercase;margin-bottom:2px;">Series</div>
              <div style="font-size:15px;color:#1d4d59;font-weight:bold;margin-bottom:14px;">${seriesName}</div>
              <div style="font-size:11px;letter-spacing:1px;color:#8a9a93;text-transform:uppercase;margin-bottom:2px;">Dates</div>
              <div style="font-size:15px;color:#142f34;margin-bottom:14px;">${dateRange}</div>
              <div style="font-size:11px;letter-spacing:1px;color:#8a9a93;text-transform:uppercase;margin-bottom:2px;">Amount paid</div>
              <div style="font-size:15px;color:#142f34;">${amountPaid}</div>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0 0;font-size:15px;line-height:1.65;color:#3a4a4f;">The player portal opens before the series begins. We&rsquo;ll email your access details and the full schedule as soon as it&rsquo;s ready &mdash; keep an eye on your inbox.</p>
        ${rulebookBlock}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0 auto;">
          <tr>
            <td align="center" style="background-color:#ec466e;border-radius:999px;">
              <a href="${SITE_URL}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Visit The Mahjong Open</a>
            </td>
          </tr>
        </table>
      `;

      const html = buildBrandedEmail({
        title: `You’re in, ${firstName}.`,
        innerHtml,
        footerNote: `A city-based mahjong social league. You’re receiving this because you registered for ${seriesName}.`,
      });
      try {
        const resend = new Resend(resendApiKey);

        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: ["themahjongopen@gmail.com"],
          replyTo: registrationData.email,
          subject: `New registration — ${registrationData.full_name} · ${cityName} (${seriesName})`,
          html: buildBrandedEmail({
            title: "New registration",
            innerHtml: internalNoticeInnerHtml,
            footerNote: "A city-based mahjong social league. You’re receiving this because a player completed a registration through The Mahjong Open.",
          }),
        });

        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: [registrationData.email],
          subject: `You're in — Welcome to ${seriesName}`,
          html,
        });
      } catch (emailError) {
        console.error("Welcome or registration notice email failed after payment confirmation.", emailError);
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const registrationId = session.metadata?.registration_id;

    if (!registrationId) {
      return NextResponse.json({ received: true });
    }

    const { data: registrationData } = await supabase
      .from("registrations")
      .select("id, full_name, email, series_id, paid_status, reminder_sent_at")
      .eq("id", registrationId)
      .maybeSingle();

    if (
      !registrationData ||
      registrationData.paid_status !== "pending" ||
      registrationData.reminder_sent_at
    ) {
      return NextResponse.json({ received: true });
    }

    const recoveryUrl = session.after_expiration?.recovery?.url;

    if (recoveryUrl && registrationData.email) {
      const { data: seriesData } = await supabase
        .from("series")
        .select("name")
        .eq("id", registrationData.series_id)
        .single();

      const seriesName = seriesData?.name ?? "The Mahjong Open";
      const firstName = (registrationData.full_name || "there").split(" ")[0];
      const resendApiKey = process.env.RESEND_API_KEY;

      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          const innerHtml = `
            <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName}, you’re almost in — your spot for <strong style="color:#1d4d59;">${seriesName}</strong> isn’t confirmed until payment is complete.</p>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Complete your registration to hold your place and keep your series plans moving.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
              <tr>
                <td align="center" style="background-color:#ec466e;border-radius:999px;">
                  <a href="${recoveryUrl}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Complete your registration</a>
                </td>
              </tr>
            </table>
          `;

          const html = buildBrandedEmail({
            title: "Your registration is still waiting",
            innerHtml,
            footerNote: "A city-based mahjong social league. You’re receiving this because your registration was left unfinished.",
          });

          await resend.emails.send({
            from: "The Mahjong Open <welcome@themahjongopen.com>",
            to: [registrationData.email],
            subject: "Your Mahjong Open registration isn't finished",
            html,
          });

          await supabase.from("registrations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", registrationId);
        } catch (emailError) {
          console.error("Abandoned registration reminder email failed.", emailError);
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
