import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";
import { formatTableTime } from "@/lib/format/time";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type AdminAddedResult = { ok: boolean; error?: string };

// Plain date -> "Thursday, August 20" (midday UTC anchor avoids tz day-shift).
function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// Sent to a player an ADMIN seated at a table from the console (support fix), so
// they aren't surprised to find themselves on a table — and know the 24h no-show
// rule now applies to them. A self-serve joiner chose to join and needs no such
// notice; this is the admin-only case. Unconditional (no prefs gate), same posture
// as tableInviteEmail. Best-effort: the seat is already committed, so a send
// failure only logs and never rolls the add back.
export async function sendAdminAddedToTableEmail(
  recipient: { email: string; fullName?: string | null },
  info: {
    tableId: string;
    cityName: string | null;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    roundType: string | null;
  }
): Promise<AdminAddedResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(info.tableDate);
  const timeLabel = formatTableTime(info.tableTime);
  const url = `${SITE_URL}/portal/tables/${info.tableId}`;

  const detailRows = [
    `<strong>When:</strong> ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
    `<strong>Where:</strong> ${info.locationName}${info.cityName ? ` — ${info.cityName}` : ""}`,
    ...(info.roundType ? [`<strong>Round:</strong> ${info.roundType}`] : []),
  ];
  const detailsHtml = detailRows
    .map((r) => `<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3a4a4f;">${r}</p>`)
    .join("");

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">A Mahjong Open organizer added you to a table${info.cityName ? ` in ${info.cityName}` : ""}. Here are the details:</p>
    ${detailsHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">View the table</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">If this isn&rsquo;t right, cancel your spot on the table page. Heads up: leaving within 24 hours of game time counts as a no-show (&minus;20).</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: `You've been added to a Mahjong Open table`,
      html: buildBrandedEmail({
        title: "You're on a table",
        innerHtml,
        preheader: `${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""} — ${info.locationName}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the notification email." };
  } catch {
    return { ok: false, error: "Could not send the notification email." };
  }

  return { ok: true };
}
