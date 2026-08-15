import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";
import { formatTableTime } from "@/lib/format/time";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type TableReminderResult = { ok: boolean; error?: string };

// Plain date -> "Monday, Aug 17" (midday UTC anchor avoids tz day-shift).
function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

/**
 * Table reminder sent by the daily cron to each seated player whose
 * email_table_reminders pref is on. Branded via Resend + buildBrandedEmail.
 *
 * NO RELATIVE TIME anywhere ("tomorrow" etc.): the safety-net re-pickup can send
 * this on the day OF the table, not only the day before, so relative wording
 * would be wrong. Subject, title, and body all state the actual day + 12-hour
 * time (via formatTableTime) so the message reads correctly whenever it lands.
 */
export async function sendTableReminderEmail(
  recipient: { email: string; fullName?: string | null },
  table: {
    tableId: string;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    locationAddress: string | null;
    roundType: string | null;
  }
): Promise<TableReminderResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(table.tableDate);
  const timeLabel = formatTableTime(table.tableTime);
  const whenText = `${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`; // e.g. "Monday, Aug 17 at 6:00 PM"
  const url = `${SITE_URL}/portal/tables/${table.tableId}`;

  const detailRows = [
    `<strong>When:</strong> ${whenText}`,
    `<strong>Where:</strong> ${table.locationName}${table.locationAddress ? ` — ${table.locationAddress}` : ""}`,
  ];
  if (table.roundType) detailRows.push(`<strong>Round:</strong> ${table.roundType}`);
  const detailsHtml = detailRows
    .map((r) => `<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3a4a4f;">${r}</p>`)
    .join("");

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">A friendly reminder about your upcoming Mahjong Open table:</p>
    ${detailsHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">View the table</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">Can&rsquo;t make it? Cancel your seat on the table page so someone can take your spot.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: `Your Mahjong Open table — ${whenText}`,
      html: buildBrandedEmail({
        title: "Your Mahjong Open table",
        innerHtml,
        preheader: `${whenText} — ${table.locationName}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the reminder email." };
  } catch {
    return { ok: false, error: "Could not send the reminder email." };
  }

  return { ok: true };
}
