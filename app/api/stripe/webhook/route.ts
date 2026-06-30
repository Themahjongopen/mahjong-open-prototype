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
        .select("name, price_cents, starts_at, ends_at")
        .eq("id", registrationData.series_id)
        .single();

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

      // Final public site URL — update once the custom domain is connected.
      const SITE_URL = "https://themahjongopen.com";
      // Stable asset host for the logo image (works now and after the domain connects).
      const ASSET_BASE = "https://mahjong-open-prototype-pi.vercel.app";

      const html = `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f5f3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f3;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e8e4;">
            <tr>
              <td align="center" style="padding:38px 24px 6px 24px;">
                <img src="${ASSET_BASE}/assets/logo-email.png" alt="The Mahjong Open" width="220" style="display:block;margin:0 auto;border:0;" />
              </td>
            </tr>
            <tr><td style="padding:14px 40px 0 40px;"><div style="height:3px;background-color:#8ab49c;border-radius:2px;"></div></td></tr>
            <tr>
              <td style="padding:28px 40px 4px 40px;font-family:Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#1d4d59;font-weight:normal;">You&rsquo;re in, ${firstName}.</h1>
                <p style="margin:0 0 4px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Your payment was successful and your spot in <strong style="color:#1d4d59;">${seriesName}</strong> is confirmed. We can&rsquo;t wait to see you at the table.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 8px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f2;border:1px solid #dde7e0;border-radius:10px;">
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
              </td>
            </tr>
            <tr>
              <td style="padding:18px 40px 4px 40px;font-family:Helvetica,Arial,sans-serif;">
                <p style="margin:0;font-size:15px;line-height:1.65;color:#3a4a4f;">The player portal opens before the series begins. We&rsquo;ll email your access details and the full schedule as soon as it&rsquo;s ready &mdash; keep an eye on your inbox.</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:24px 40px 36px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="background-color:#c60e31;border-radius:999px;">
                      <a href="${SITE_URL}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Visit The Mahjong Open</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;background-color:#1d4d59;font-family:Helvetica,Arial,sans-serif;">
                <p style="margin:0 0 6px 0;font-size:13px;color:#ffffff;font-weight:bold;">The Mahjong Open</p>
                <p style="margin:0 0 10px 0;font-size:12px;line-height:1.5;color:#b8cdc6;">A city-based Mahjong game league. You&rsquo;re receiving this because you registered for ${seriesName}.</p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#8ba89f;">[ Mailing address &mdash; add before sending marketing emails ]</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9aa39f;">&copy; 2026 The Mahjong Open</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

      try {
        const resend = new Resend(resendApiKey);

        await resend.emails.send({
          from: "The Mahjong Open <welcome@themahjongopen.com>",
          to: [registrationData.email],
          subject: `You're in — welcome to ${seriesName}`,
          html,
        });
      } catch (emailError) {
        console.error("Welcome email failed after payment confirmation.", emailError);
      }
    }
  }

  return NextResponse.json({ received: true });
}
