import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

// App-owned password-reset email — NOT Supabase's built-in recovery email.
//
// Supabase's default recovery link points at its hosted /auth/v1/verify GET
// endpoint, which verifies (and CONSUMES) the one-time token on the first fetch
// with no human-interaction gate — so email security scanners and link
// prefetchers silently burn the token before the player clicks, and the real
// click lands on "link is invalid or has expired". Instead we mint the recovery
// token server-side and point the button at our OWN /portal/auth/confirm, which
// only calls verifyOtp() on a real "Continue" click. This is the same hardening
// the invite flow already uses (see lib/email/portalInvite.ts) — reset-password
// was just never migrated to it.
//
// Always returns { ok: true } — whether or not the email exists, and whether or
// not the send succeeds — so neither the client nor an attacker can tell an
// existing account from a missing one.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = body?.email?.toString().trim();
  if (!email) return NextResponse.json({ ok: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createAdminClient();
  if (!supabase) return NextResponse.json({ ok: true });

  // Force recovery (never invite): a password reset must never create a new
  // account for an unknown email. For a non-existent email this errors / returns
  // no token, and we silently no-op below — no email sent, no existence leak.
  const gen = await supabase.auth.admin.generateLink({ type: "recovery", email });
  const hashedToken: string | undefined = gen.data?.properties?.hashed_token;
  if (gen.error || !hashedToken) return NextResponse.json({ ok: true });

  const actionUrl = `${SITE_URL}/portal/auth/confirm?token_hash=${hashedToken}&type=recovery&next=/portal/update-password`;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return NextResponse.json({ ok: true });

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi there,</p>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">We got a request to reset your Mahjong Open portal password. Tap the button below to choose a new one.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;background-color:#fdeef2;border-radius:8px;">
      <tr>
        <td style="padding:12px 16px;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#9a1f58;">
          <strong>Before you tap the button:</strong> turn off Wi&#8209;Fi on your phone first, then open this link on cellular data. This is the single most common fix for the button not working.
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${actionUrl}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Reset your password</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">This link can be used once and expires 24 hours after this email was sent. Didn&rsquo;t request this? You can ignore it.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    await resend.emails.send({
      from: FROM,
      to: [email],
      subject: "Reset your Mahjong Open portal password",
      html: buildBrandedEmail({
        title: "Reset your password",
        innerHtml,
        footerNote: "Mahjong Made Social. You’re receiving this because a password reset was requested for your account.",
      }),
    });
  } catch {
    // Swallow — still return ok:true so the response can't distinguish
    // "email doesn't exist" from "send failed" (same reasoning as the UI copy).
  }

  return NextResponse.json({ ok: true });
}
