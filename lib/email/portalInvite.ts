import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type PortalInviteResult = { ok: boolean; error?: string };

/**
 * Generates a portal set-password link and sends it as a fully branded email via
 * Resend — independent of Supabase's SMTP templates. Used by every app-initiated
 * invite (single, bulk, and Resend invite).
 *
 * Link strategy: try a one-time `invite` link first (this also creates the auth
 * user, which fires the 007 trigger to create the profile + backfill
 * registrations.profile_id). If the user already exists (a re-send), fall back to
 * a `recovery` link so the same "set your password" flow still works. Either way
 * the email points at our own /portal/auth/callback, matching the reset template.
 */
export async function sendPortalInvite(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  { email, fullName }: { email: string; fullName?: string | null }
): Promise<PortalInviteResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  let linkType: "invite" | "recovery" = "invite";
  let gen = await supabase.auth.admin.generateLink({
    type: "invite",
    email,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });

  const alreadyExists = /already.*regist|already exists|email.*exists/i.test(gen.error?.message ?? "");
  if (gen.error && alreadyExists) {
    linkType = "recovery";
    gen = await supabase.auth.admin.generateLink({ type: "recovery", email });
  }

  const hashedToken: string | undefined = gen.data?.properties?.hashed_token;
  if (gen.error || !hashedToken) {
    return { ok: false, error: gen.error?.message ?? "Could not generate an invite link." };
  }

  const actionUrl = `${SITE_URL}/portal/auth/callback?token_hash=${hashedToken}&type=${linkType}&next=/portal/set-password`;
  const firstName = (fullName ?? "").trim().split(/\s+/)[0] || "there";

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">You&rsquo;re all set for The Mahjong Open. Your member portal account is ready &mdash; set a password below to sign in.</p>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Inside you&rsquo;ll find your city&rsquo;s tables, live standings, and score submission through the season.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${actionUrl}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Set your password</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">This link can be used once and expires for security. If it stops working, ask an organizer to re-send your invite.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [email],
      subject: "Set up your Mahjong Open member portal",
      html: buildBrandedEmail({
        title: "Set up your member portal",
        innerHtml,
        footerNote:
          "A city-based mahjong social league. You’re receiving this because you registered for The Mahjong Open.",
      }),
    });
    if (error) return { ok: false, error: "Could not send the invite email." };
  } catch {
    return { ok: false, error: "Could not send the invite email." };
  }

  return { ok: true };
}
