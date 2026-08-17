import { NextResponse } from "next/server";
import { Resend } from "resend";
import Stripe from "stripe";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { sendRegistrationReminderEmail } from "@/lib/email/registrationReminderEmail";
import { sendPortalInvite } from "@/lib/email/portalInvite";
import { ensureAttributionOnPaid } from "@/lib/registration/attribution";
import { createAdminClient, listAuthUsersByEmail } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REG_COLUMNS = "id, full_name, email, phone, city_id, series_id, paid_status, created_at";

// Resolve a registration from a completed/recovered Checkout Session, most reliable
// link first: (1) metadata.registration_id, (2) client_reference_id, (3) customer
// email + series_id. Stripe copies all three onto recovery sessions. Each lookup
// tolerates errors (e.g. a non-uuid id) and falls through. Returns null if unmatched.
async function resolveRegistration(supabase: any, session: Stripe.Checkout.Session) {
  const byId = async (id: string | null | undefined) => {
    if (!id) return null;
    const { data } = await supabase.from("registrations").select(REG_COLUMNS).eq("id", id).maybeSingle();
    return data ?? null;
  };

  const byId1 = await byId(session.metadata?.registration_id);
  if (byId1) return byId1;

  const byId2 = await byId(session.client_reference_id);
  if (byId2) return byId2;

  const email = session.customer_email ?? session.customer_details?.email ?? null;
  const seriesId = session.metadata?.series_id ?? null;
  if (email && seriesId) {
    const { data } = await supabase
      .from("registrations")
      .select(REG_COLUMNS)
      .eq("email", email)
      .eq("series_id", seriesId)
      .maybeSingle();
    return data ?? null;
  }

  return null;
}

// Alert (internal email) when a paid checkout can't be matched to a registration, so
// a paid-but-unregistered case is visible instead of silently orphaning. Non-fatal.
async function sendUnmatchedAlert(sessionId: string, email: string | null, amountCents: number | null) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;
  const amount = typeof amountCents === "number" ? `$${(amountCents / 100).toFixed(2)}` : "unknown";
  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "The Mahjong Open <welcome@themahjongopen.com>",
      to: ["themahjongopen@gmail.com"],
      subject: `Action needed: paid checkout not matched to a registration (${sessionId})`,
      html: buildBrandedEmail({
        title: "Unmatched paid checkout",
        innerHtml: `
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3a4a4f;">
            <p style="margin:0 0 12px 0;">A Stripe checkout completed but couldn&rsquo;t be matched to a registration row. Please reconcile manually in Stripe and Supabase.</p>
            <p style="margin:0 0 12px 0;"><strong>Session:</strong> ${sessionId}</p>
            <p style="margin:0 0 12px 0;"><strong>Email:</strong> ${email || "unknown"}</p>
            <p style="margin:0;"><strong>Amount:</strong> ${amount}</p>
          </div>
        `,
        footerNote: "Automated alert from the Stripe webhook.",
      }),
    });
  } catch (alertError) {
    console.error("[stripe-webhook] failed to send unmatched-checkout alert", alertError);
  }
}

// Internal alert when a per-series auto-invite fails to send — payment is fine,
// but the invite didn't go out, so an admin needs to send it manually. Mirrors
// sendUnmatchedAlert's log-and-move-on posture (never throws to the caller).
async function sendAutoInviteFailedAlert(email: string, fullName: string | null, reason?: string) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;
  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: "The Mahjong Open <welcome@themahjongopen.com>",
      to: ["themahjongopen@gmail.com"],
      subject: `Action needed: auto-invite failed for ${fullName ?? email}`,
      html: buildBrandedEmail({
        title: "Auto-invite failed",
        innerHtml: `
          <div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#3a4a4f;">
            <p style="margin:0 0 12px 0;">Payment succeeded and the registration is fine, but the automatic portal invite failed to send. Use the admin console to invite them manually.</p>
            <p style="margin:0 0 12px 0;"><strong>Player:</strong> ${fullName ?? "Unknown"}</p>
            <p style="margin:0 0 12px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin:0;"><strong>Reason:</strong> ${reason ?? "Unknown"}</p>
          </div>
        `,
        footerNote: "Automated alert from the Stripe webhook.",
      }),
    });
  } catch (alertError) {
    console.error("[stripe-webhook] failed to send auto-invite-failed alert", alertError);
  }
}

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

    const registrationData = await resolveRegistration(supabase, session);

    if (!registrationData) {
      // Paid but unmatched: surface it (log + internal alert) instead of returning silently.
      const sessionEmail = session.customer_email ?? session.customer_details?.email ?? session.metadata?.email ?? null;
      console.error("[stripe-webhook] checkout.session.completed could not be matched to a registration", {
        sessionId: session.id,
        email: sessionEmail,
        amountCents: session.amount_total,
      });
      await sendUnmatchedAlert(session.id, sessionEmail, session.amount_total ?? null);
      return NextResponse.json({ received: true });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    // Atomic flip pending -> paid: only the delivery that actually flips proceeds, so
    // concurrent/duplicate webhook deliveries can't both mark paid or send the email.
    const { data: flipped } = await supabase
      .from("registrations")
      .update({ paid_status: "paid" })
      .eq("id", registrationData.id)
      .eq("paid_status", "pending")
      .select("id");

    if (!flipped || flipped.length === 0) {
      // Already processed (or not in a pending state) — idempotent no-op.
      return NextResponse.json({ received: true });
    }

    // Persist the REAL amount charged (after discount codes) so revenue reporting
    // is accurate — a 100%-off comp stores 0, not the series list price. The row
    // was created at the list price when checkout started; only overwrite when
    // Stripe gives us a concrete amount_total.
    const paidCents = typeof session.amount_total === "number" ? session.amount_total : null;
    await supabase
      .from("payments")
      .update({
        status: "succeeded",
        provider_payment_id: paymentIntentId,
        ...(paidCents !== null ? { amount_cents: paidCents } : {}),
      })
      .eq("registration_id", registrationData.id);

    // Attribution safety net: a registration created before the live attribution
    // code shipped was never attributed at signup, and can pay AFTER the one-time
    // backfill ran — nothing else would attribute it. Do it here, at payment time.
    // INSERT-ONLY + idempotent: if it already has an attribution row (the normal
    // case for anything created after the live code shipped), this does nothing —
    // safe on Stripe's webhook retries. FULLY ISOLATED: wrapped here AND
    // self-swallowing inside, mirroring /api/register's treatment of
    // writeAttribution, so a failure can never fail the webhook or disrupt payment
    // reconciliation (a webhook that errors gets retried by Stripe). Runs only on
    // the delivery that actually flipped pending -> paid (guarded above).
    try {
      await ensureAttributionOnPaid(supabase, {
        registrationId: registrationData.id,
        cityId: registrationData.city_id,
        referralCode: session.metadata?.referral_code || null,
        heardAbout: session.metadata?.heard_about || null,
      });
    } catch (attributionError) {
      console.error("[stripe-webhook] attribution on paid failed (registration unaffected)", attributionError);
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (resendApiKey && registrationData?.email) {
      const { data: seriesData } = await supabase
        .from("series")
        .select("name, price_cents, starts_at, ends_at, auto_invite_enabled")
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
      // Real amount charged (after discount codes), not the series list price —
      // so a 100%-off coupon correctly shows $0.00. Falls back to the series
      // price only if amount_total is somehow absent (shouldn't happen for a
      // completed session).
      const amountPaid =
        typeof session.amount_total === "number"
          ? `$${(session.amount_total / 100).toFixed(2)}`
          : typeof seriesData?.price_cents === "number"
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
      const RULEBOOK_URL = "https://www.themahjongopen.com/handbook/the-mahjong-open-handbook-2026.pdf";
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
        footerNote: `Mahjong Made Social. You’re receiving this because you registered for ${seriesName}.`,
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
            footerNote: "Mahjong Made Social. You’re receiving this because a player completed a registration through The Mahjong Open.",
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

      // Auto-invite (per-series opt-in): if this series has it on, send the portal
      // invite now instead of waiting for an admin click. Isolated + non-blocking
      // — payment is already recorded and the emails above already fired; a failure
      // here only alerts + logs, it never affects the checkout flow.
      if (seriesData?.auto_invite_enabled) {
        try {
          // Skip anyone who already has full portal access (e.g. registering
          // for a second city under 2NDCITY) — they don't need a "set up your
          // account" email, they already have one. Reuses the same lookup the
          // admin Players page already relies on elsewhere in this codebase.
          // Note: this pages through every Auth user on every auto-invite-
          // eligible checkout — fine at today's scale, worth revisiting (a
          // targeted single-email lookup instead of a full scan) if the
          // league grows into the thousands of accounts.
          const usersByEmail = await listAuthUsersByEmail(supabase);
          const alreadyActive = usersByEmail.get(registrationData.email.toLowerCase())?.last_sign_in_at;

          if (!alreadyActive) {
            const inviteResult = await sendPortalInvite(supabase, {
              email: registrationData.email,
              fullName: registrationData.full_name,
            });

            if (!inviteResult.ok) {
              console.error("[stripe-webhook] auto-invite failed to send", { registrationId: registrationData.id, error: inviteResult.error });
              await sendAutoInviteFailedAlert(registrationData.email, registrationData.full_name, inviteResult.error);
            }
          }
        } catch (autoInviteError) {
          console.error("[stripe-webhook] auto-invite threw", autoInviteError);
          await sendAutoInviteFailedAlert(registrationData.email, registrationData.full_name, "Unexpected error — see server logs.");
        }
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

      // Shared template — identical email to the admin manual-resend path.
      const res = await sendRegistrationReminderEmail(
        { email: registrationData.email, fullName: registrationData.full_name },
        { seriesName, checkoutUrl: recoveryUrl }
      );
      if (res.ok) {
        await supabase.from("registrations").update({ reminder_sent_at: new Date().toISOString() }).eq("id", registrationId);
      } else {
        console.error("Abandoned registration reminder email failed.", res.error);
      }
    }
  }

  return NextResponse.json({ received: true });
}
