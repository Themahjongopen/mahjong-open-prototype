import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type ScorePostedResult = { ok: boolean; error?: string };

// Plain date -> "Thursday, August 20". Anchor to midday UTC so the day doesn't
// shift in negative-offset timezones (same pattern as the series pages).
function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * Sent to each seated player (except the host who entered them) when a round's
 * scores are submitted — gated by the recipient's `email_score_posted` pref at
 * the call site. Branded via Resend + buildBrandedEmail, same as portalInvite.
 * `table.tableId` drives the "view the round" link.
 */
export async function sendScorePostedEmail(
  recipient: { email: string; fullName?: string | null },
  table: { tableId: string; tableDate: string; locationName: string },
  result: { roundScore: number; isNoShow: boolean; isNoShowBonus: boolean }
): Promise<ScorePostedResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(table.tableDate);
  const location = table.locationName;
  const url = `${SITE_URL}/portal/tables/${table.tableId}`;

  // Result sentence — no-show and stay-bonus rounds don't have a numeric score.
  let resultLine: string;
  if (result.isNoShow) {
    resultLine = `The round at ${location} on ${dateLabel} is scored. This round was recorded with a no-show — see the table page for details.`;
  } else if (result.isNoShowBonus) {
    resultLine = `The round at ${location} on ${dateLabel} is scored. You stayed and everyone who did received a +25 bonus for this round.`;
  } else {
    resultLine = `Your score for the ${dateLabel} round at ${location}: <strong>${result.roundScore}</strong>.`;
  }

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 20px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">${resultLine}</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">View the full round</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">See the round details and the latest standings on your member portal.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: "Your round score is posted",
      html: buildBrandedEmail({
        title: "Your round score is posted",
        innerHtml,
        preheader: result.isNoShow || result.isNoShowBonus ? "Scores are in for your round." : `Your score: ${result.roundScore}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the score email." };
  } catch {
    return { ok: false, error: "Could not send the score email." };
  }

  return { ok: true };
}
