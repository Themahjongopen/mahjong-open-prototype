import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type NewTableResult = { ok: boolean; error?: string };

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
 * "A new table just opened in your city" notice, sent to each OTHER paid player
 * in the table's city+series when someone creates a table. Branded via Resend +
 * buildBrandedEmail, same as tableUpdatedEmail / tableUnderfilledEmail.
 *
 * Opt-in (gated on the email_new_tables preference by the caller). Best-effort:
 * the table has already been created, so a send failure must not surface to the
 * host or block the request.
 */
export async function sendNewTableEmail(
  recipient: { email: string; fullName?: string | null },
  table: {
    tableId: string;
    cityName: string;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    locationAddress: string | null;
    roundType: string | null;
  }
): Promise<NewTableResult> {
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
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">A new table just opened in ${table.cityName}. If it works for you, claim a seat before it fills up:</p>
    ${detailsHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">View the table</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">You&rsquo;re getting this because you turned on new-table emails for your city. Change that anytime on your profile.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: `A new table just opened in ${table.cityName}`,
      html: buildBrandedEmail({
        title: `A new table opened in ${table.cityName}`,
        innerHtml,
        preheader: `${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""} — ${table.locationName}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the new-table email." };
  } catch {
    return { ok: false, error: "Could not send the new-table email." };
  }

  return { ok: true };
}
