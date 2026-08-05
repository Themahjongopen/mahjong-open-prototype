import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type TableUpdatedResult = { ok: boolean; error?: string };

// Plain date -> "Thursday, August 20" (midday UTC anchor avoids tz day-shift).
function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
// "18:00" / "18:00:00" -> "6:00 PM"; passes through anything unexpected.
function formatTime(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  let h = Number.parseInt(m[1], 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ampm}`;
}

/**
 * "This table's details have changed" notice, sent to each OTHER seated player
 * when a host/admin edits a table's time/date/location/round type. Branded via
 * Resend + buildBrandedEmail, same as tableReminderEmail / scorePostedEmail.
 *
 * Deliberately not a field-by-field diff — it just shows the table's current
 * (post-edit) details and links to the table page, which is all either player
 * asked for. Best-effort: the caller has already saved the edit, so a send
 * failure here must not surface to the host.
 */
export async function sendTableUpdatedEmail(
  recipient: { email: string; fullName?: string | null },
  table: {
    tableId: string;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    locationAddress: string | null;
    roundType: string | null;
  }
): Promise<TableUpdatedResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(table.tableDate);
  const timeLabel = formatTime(table.tableTime);
  const url = `${SITE_URL}/portal/tables/${table.tableId}`;

  const detailRows = [
    `<strong>When:</strong> ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
    `<strong>Where:</strong> ${table.locationName}${table.locationAddress ? ` — ${table.locationAddress}` : ""}`,
  ];
  if (table.roundType) detailRows.push(`<strong>Round type:</strong> ${table.roundType}`);
  const detailsHtml = detailRows
    .map((r) => `<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3a4a4f;">${r}</p>`)
    .join("");

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">The host updated a Mahjong Open table you&rsquo;re seated at. Here are its current details:</p>
    ${detailsHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">View the table</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">If the new time or place doesn&rsquo;t work for you, cancel your seat on the table page so someone can take your spot.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: "A table you're in was updated",
      html: buildBrandedEmail({
        title: "This table's details have changed",
        innerHtml,
        preheader: `${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""} — ${table.locationName}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the update email." };
  } catch {
    return { ok: false, error: "Could not send the update email." };
  }

  return { ok: true };
}
