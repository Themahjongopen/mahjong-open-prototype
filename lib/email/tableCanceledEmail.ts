import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type TableCanceledResult = { ok: boolean; error?: string };

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
 * "A table you're in was canceled" notice, sent to each OTHER seated player when
 * a host cancels their table or an admin cancels it from the console. Branded via
 * Resend + buildBrandedEmail, same shape as tableUpdatedEmail / tableHostChanged.
 *
 * Sent UNCONDITIONALLY (not preference-gated), like the other transactional table
 * notices — a canceled table is something a seated player needs to know regardless
 * of their reminder settings. Best-effort: the caller has already committed the
 * cancellation, so a send failure here must never surface or roll it back. No
 * "view the table" button (the table is gone); links to the player's open tables.
 */
export async function sendTableCanceledEmail(
  recipient: { email: string; fullName?: string | null },
  table: {
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    cityName?: string | null;
    roundType?: string | null;
  }
): Promise<TableCanceledResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(table.tableDate);
  const timeLabel = formatTime(table.tableTime);
  const url = `${SITE_URL}/portal/tables`;

  const detailRows = [
    `<strong>When:</strong> ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
    `<strong>Where:</strong> ${table.locationName}${table.cityName ? ` (${table.cityName})` : ""}`,
  ];
  if (table.roundType) detailRows.push(`<strong>Round type:</strong> ${table.roundType}`);
  const detailsHtml = detailRows
    .map((r) => `<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3a4a4f;">${r}</p>`)
    .join("");

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">A Mahjong Open table you were seated at has been canceled:</p>
    ${detailsHtml}
    <p style="margin:16px 0 0 0;font-size:15px;line-height:1.65;color:#3a4a4f;">You don&rsquo;t need to do anything &mdash; your seat has been released. You can browse other open tables in your city any time.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">See open tables</a>
        </td>
      </tr>
    </table>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: "A table you're in was canceled",
      html: buildBrandedEmail({
        title: "A table you're in was canceled",
        innerHtml,
        preheader: `${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""} — ${table.locationName}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the cancellation email." };
  } catch {
    return { ok: false, error: "Could not send the cancellation email." };
  }

  return { ok: true };
}
