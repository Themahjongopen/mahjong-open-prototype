import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type SeriesAnnouncementResult = { ok: boolean; error?: string };

// Admins type PLAIN TEXT, so escape before interpolating into the email HTML.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Split the message into paragraphs on blank lines; single newlines within a
// paragraph become <br>. Everything is escaped first.
function renderParagraphs(message: string): string {
  return message
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">${escapeHtml(block).replace(/\r?\n/g, "<br/>")}</p>`)
    .join("");
}

/**
 * Admin-composed "series update" broadcast, sent to each targeted player whose
 * email_series_updates pref is on (gated at the call site). Subject + message
 * are the admin's plain-text input; message renders as paragraphs. Branded via
 * Resend + buildBrandedEmail, same as the other notification emails.
 */
export async function sendSeriesAnnouncementEmail(
  recipient: { email: string; fullName?: string | null },
  announcement: { subject: string; message: string }
): Promise<SeriesAnnouncementResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const bodyHtml = renderParagraphs(announcement.message);
  const preheader = announcement.message.replace(/\s+/g, " ").trim().slice(0, 120);

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: announcement.subject,
      html: buildBrandedEmail({
        title: escapeHtml(announcement.subject),
        innerHtml: bodyHtml,
        preheader,
      }),
    });
    if (error) return { ok: false, error: "Could not send the announcement email." };
  } catch {
    return { ok: false, error: "Could not send the announcement email." };
  }

  return { ok: true };
}
