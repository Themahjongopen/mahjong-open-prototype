import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";
import { formatTableTime } from "@/lib/format/time";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type TableHostChangedResult = { ok: boolean; error?: string };

// Plain date -> "Thursday, August 20" (midday UTC anchor avoids tz day-shift).
function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * "The host of your table changed" notice, sent when a table's host role is
 * handed off to another seated player (PATCH action:"handoff"). Two flavors,
 * selected by opts.isNewHost:
 *   - new host  → they now have responsibilities they didn't sign up for (mark
 *     the table played once all four have played, enter everyone's scores).
 *   - everyone else seated → short "your host changed to {name}" notice.
 *
 * NOTIFICATION-PREFERENCES DECISION: sent UNCONDITIONALLY. Does NOT import or
 * call resolvePrefs() and does NOT read profiles.notification_preferences —
 * knowing who runs your table is transactional, same posture as
 * tableUpdatedEmail / tableUnderfilledEmail. Do not add a prefs gate.
 *
 * Time is rendered with formatTableTime() (12-hour AM/PM) — never by slicing the
 * raw Postgres time string. Best-effort: the handoff is already committed, so a
 * send failure returns { ok:false } and must not block anything.
 */
export async function sendTableHostChangedEmail(
  recipient: { email: string; fullName?: string | null },
  table: {
    tableId: string;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    cityName: string | null;
    weekNumber: number;
    roundType: string | null;
  },
  opts: { isNewHost: boolean; newHostName: string }
): Promise<TableHostChangedResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const dateLabel = formatDate(table.tableDate);
  const timeLabel = formatTableTime(table.tableTime);
  const url = `${SITE_URL}/portal/tables/${table.tableId}`;

  const detailRows = [
    `<strong>When:</strong> ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
    `<strong>Where:</strong> ${table.locationName}${table.cityName ? ` — ${table.cityName}` : ""}`,
    `<strong>Week:</strong> Week ${table.weekNumber}${table.roundType ? ` · ${table.roundType}` : ""}`,
  ];
  const detailsHtml = detailRows
    .map((r) => `<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3a4a4f;">${r}</p>`)
    .join("");

  const title = opts.isNewHost ? "You're now hosting this table" : "Your table's host changed";
  const subject = opts.isNewHost ? "You're now hosting a Mahjong Open table" : "The host of your table changed";

  const bodyHtml = opts.isNewHost
    ? `
      <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">You&rsquo;ve been made the host of this Mahjong Open table. As the host, once all four players have played you&rsquo;ll <strong>mark the table as played</strong> and <strong>enter everyone&rsquo;s round scores</strong> in the portal.</p>
      ${detailsHtml}
      <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#8a9499;">You&rsquo;re also holding a seat at the table. If you can&rsquo;t make it, you can hand hosting to another seated player from the table page.</p>
    `
    : `
      <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
      <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;"><strong>${opts.newHostName}</strong> is now hosting your Mahjong Open table. Nothing changes for your seat — here are the current details:</p>
      ${detailsHtml}
    `;

  const innerHtml = `
    ${bodyHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
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
      subject,
      html: buildBrandedEmail({
        title,
        innerHtml,
        preheader: `${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""} — ${table.locationName}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the host-change email." };
  } catch {
    return { ok: false, error: "Could not send the host-change email." };
  }

  return { ok: true };
}
