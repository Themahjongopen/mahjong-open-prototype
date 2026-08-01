import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type RegistrationReminderResult = { ok: boolean; error?: string };

/**
 * "Complete your registration" reminder for a pending registration. Extracted
 * verbatim from the webhook's checkout.session.expired handler so both the
 * automatic (Stripe-expiry) and manual (admin resend) paths use one template —
 * `checkoutUrl` is the session's recovery URL (expiry path) or the new session's
 * checkout URL (resend path). Resend + buildBrandedEmail, like every other email.
 */
export async function sendRegistrationReminderEmail(
  recipient: { email: string; fullName?: string | null },
  details: { seriesName: string; checkoutUrl: string }
): Promise<RegistrationReminderResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName || "there").split(" ")[0];
  const innerHtml = `
            <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName}, you’re almost in — your spot for <strong style="color:#1d4d59;">${details.seriesName}</strong> isn’t confirmed until payment is complete.</p>
            <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Complete your registration to hold your place and keep your series plans moving.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0;">
              <tr>
                <td align="center" style="background-color:#ec466e;border-radius:999px;">
                  <a href="${details.checkoutUrl}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Complete your registration</a>
                </td>
              </tr>
            </table>
          `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: "Your Mahjong Open registration isn't finished",
      html: buildBrandedEmail({
        title: "Your registration is still waiting",
        innerHtml,
        footerNote: "A city-based mahjong social league. You’re receiving this because your registration was left unfinished.",
      }),
    });
    if (error) return { ok: false, error: "Could not send the reminder email." };
  } catch {
    return { ok: false, error: "Could not send the reminder email." };
  }

  return { ok: true };
}
