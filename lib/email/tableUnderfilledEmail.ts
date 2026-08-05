import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type TableUnderfilledResult = { ok: boolean; error?: string };

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
 * "A seat opened up and your table is now short a player" notice, sent to the
 * remaining seated players when a cancellation drops a table from 4 → 3 active
 * players (fired once, on that transition only — see the caller). Branded via
 * Resend + buildBrandedEmail, same as tableReminderEmail. Purely informational,
 * best-effort: the seat cancel has already committed and must not be blocked by
 * a send failure.
 */
export async function sendTableUnderfilledEmail(
  recipient: { email: string; fullName?: string | null },
  table: {
    tableId: string;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    locationAddress: string | null;
    roundType: string | null;
    activeCount: number;
  }
): Promise<TableUnderfilledResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(table.tableDate);
  const timeLabel = formatTime(table.tableTime);
  const url = `${SITE_URL}/portal/tables/${table.tableId}`;

  const detailRows = [
    `<strong>Players:</strong> ${table.activeCount} of 4 seated`,
    `<strong>When:</strong> ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
    `<strong>Where:</strong> ${table.locationName}${table.locationAddress ? ` — ${table.locationAddress}` : ""}`,
  ];
  const detailsHtml = detailRows
    .map((r) => `<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3a4a4f;">${r}</p>`)
    .join("");

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">A seat opened up at your Mahjong Open table, so it&rsquo;s now short a player. A round needs four to count, so you may want to help find someone to fill the spot.</p>
    ${detailsHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">View the table</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">Anyone in your city can claim the open seat from the table page.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: "A seat opened up at your table",
      html: buildBrandedEmail({
        title: "Your table is short a player",
        innerHtml,
        preheader: `${table.activeCount} of 4 seated — ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the notification email." };
  } catch {
    return { ok: false, error: "Could not send the notification email." };
  }

  return { ok: true };
}
