import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type TableFilledResult = { ok: boolean; error?: string };

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
 * "Your table is now full" notice — the mirror image of tableUnderfilledEmail,
 * sent when a join fills the 4th seat (fired once, on that 3 → 4 transition only
 * — see the caller). Branded via Resend + buildBrandedEmail. Best-effort: the
 * seat has already committed, so a send failure must not block the join.
 *
 * Two variants (opts.acting):
 *   - acting = false (the other three already-seated players): "your table is
 *     now full" — this happened to you.
 *   - acting = true (the player who just took the 4th seat): "you completed this
 *     table" — you did this. Same details + link, confirmation-toned copy.
 */
export async function sendTableFilledEmail(
  recipient: { email: string; fullName?: string | null },
  table: {
    tableId: string;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    locationAddress: string | null;
    roundType: string | null;
  },
  opts: { acting?: boolean } = {}
): Promise<TableFilledResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const acting = opts.acting === true;
  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(table.tableDate);
  const timeLabel = formatTime(table.tableTime);
  const url = `${SITE_URL}/portal/tables/${table.tableId}`;

  const detailRows = [
    `<strong>Players:</strong> 4 of 4 seated`,
    `<strong>When:</strong> ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
    `<strong>Where:</strong> ${table.locationName}${table.locationAddress ? ` — ${table.locationAddress}` : ""}`,
  ];
  if (table.roundType) detailRows.push(`<strong>Round type:</strong> ${table.roundType}`);
  const detailsHtml = detailRows
    .map((r) => `<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3a4a4f;">${r}</p>`)
    .join("");

  const lead = acting
    ? "You took the fourth seat &mdash; that&rsquo;s a full table, all set to play."
    : "Good news &mdash; your Mahjong Open table just filled its fourth seat, so it&rsquo;s all set to play.";

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">${lead}</p>
    ${detailsHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">View the table</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">See you there! If your plans change, cancel your seat on the table page so someone can take your spot.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: acting ? "You completed your table — see you there!" : "Your table is now full — see you there!",
      html: buildBrandedEmail({
        title: acting ? "You completed this table" : "Your table is now full",
        innerHtml,
        preheader: `4 of 4 seated — ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the table-filled email." };
  } catch {
    return { ok: false, error: "Could not send the table-filled email." };
  }

  return { ok: true };
}
