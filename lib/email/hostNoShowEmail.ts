import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type HostNoShowResult = { ok: boolean; error?: string };

function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// Sent to the HOST when a player at their table records them as a no-show (Aug 2026
// change — the remaining seated players can now record a host who didn't show, since
// the table can't play three-handed). The host loses 20 points this week from an
// action another player took, so they're told directly rather than discovering it in
// the standings — and pointed at their commissioner if it's wrong (the lightweight
// dispute path; admins have Revert / Score Corrections to undo it). Unconditional
// (no prefs gate). Best-effort: the record is already committed, a send only logs.
export async function sendHostNoShowEmail(
  recipient: { email: string; fullName?: string | null },
  info: { tableId: string; tableDate: string; locationName: string; reporterName: string | null }
): Promise<HostNoShowResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(info.tableDate);
  const reporter = (info.reporterName ?? "").trim() || "A player at your table";
  const url = `${SITE_URL}/portal/tables/${info.tableId}`;

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;"><strong>${reporter}</strong> recorded you as a no-show for the table at ${info.locationName} on ${dateLabel}. A no-show is <strong>&minus;20 points</strong> for the week.</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">If that&rsquo;s not right, please contact your city commissioner — they can review it and have it corrected.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">View the table</a>
        </td>
      </tr>
    </table>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: `You were recorded as a no-show`,
      html: buildBrandedEmail({
        title: "A no-show was recorded",
        innerHtml,
        preheader: `${info.locationName} — ${dateLabel}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the no-show email." };
  } catch {
    return { ok: false, error: "Could not send the no-show email." };
  }

  return { ok: true };
}
