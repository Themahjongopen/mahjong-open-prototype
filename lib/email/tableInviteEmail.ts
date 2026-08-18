import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";
import { formatTableTime } from "@/lib/format/time";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type TableInviteResult = { ok: boolean; error?: string };

// Plain date -> "Thursday, August 20" (midday UTC anchor avoids tz day-shift).
// Same helper the other table emails use.
function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * "{Inviter} invited you to a Mahjong Open table" — the person-to-person invite
 * (migration 034). Sent when a seated player picks other registered players in
 * the table's city and invites them. Branded via Resend + buildBrandedEmail,
 * same shape as tableUpdatedEmail / tableUnderfilledEmail.
 *
 * NOTIFICATION-PREFERENCES DECISION (the whole point of this feature): this email
 * is sent UNCONDITIONALLY. It does NOT import or call resolvePrefs() and does NOT
 * read profiles.notification_preferences — a person-to-person invitation is
 * transactional, and there's no per-player "table invites" toggle by design.
 * Same posture as the unconditional tableUpdatedEmail. Do not add a prefs gate.
 *
 * HONEST ABOUT THE RACE: because any seated player can invite, more people may be
 * invited than there are open seats. The copy says seats are first come, first
 * served — it never claims a seat is being held. The recipient still taps the
 * real "Join this table" button; this email seats no one.
 *
 * Time is rendered with formatTableTime() (12-hour AM/PM) — never by slicing the
 * raw Postgres time string. Best-effort: the caller has already written the
 * invite row, so a send failure here returns { ok:false } and is recorded as a
 * `failed` entry rather than rolling anything back.
 */
export async function sendTableInviteEmail(
  recipient: { email: string; fullName?: string | null },
  invite: {
    tableId: string;
    inviterName: string | null;
    cityName: string | null;
    weekNumber: number;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    roundType: string | null;
    openSeats: number;
  }
): Promise<TableInviteResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const inviterFirst = (invite.inviterName ?? "").trim().split(/\s+/)[0] || "A player";
  const dateLabel = formatDate(invite.tableDate);
  const timeLabel = formatTableTime(invite.tableTime);
  const url = `${SITE_URL}/portal/tables/${invite.tableId}`;
  const seatLabel = invite.openSeats === 1 ? "1 open seat" : `${invite.openSeats} open seats`;

  const detailRows = [
    `<strong>When:</strong> ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
    `<strong>Where:</strong> ${invite.locationName}${invite.cityName ? ` — ${invite.cityName}` : ""}`,
    `<strong>Week:</strong> Week ${invite.weekNumber}${invite.roundType ? ` · ${invite.roundType}` : ""}`,
    `<strong>Seats:</strong> ${seatLabel} right now`,
  ];
  const detailsHtml = detailRows
    .map((r) => `<p style="margin:0 0 8px 0;font-size:15px;line-height:1.6;color:#3a4a4f;">${r}</p>`)
    .join("");

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">${inviterFirst} invited you to join a Mahjong Open table${invite.cityName ? ` in ${invite.cityName}` : ""}. Here are the details:</p>
    ${detailsHtml}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="${url}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Join this table</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;">Seats are first come, first served — tap above to grab yours. You&rsquo;re only seated once you join on the table page.</p>
  `;

  try {
    const resend = new Resend(resendApiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: [recipient.email],
      subject: `${inviterFirst} invited you to a Mahjong Open table`,
      html: buildBrandedEmail({
        title: "You're invited to a table",
        innerHtml,
        preheader: `${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""} — ${invite.locationName}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the invite email." };
  } catch {
    return { ok: false, error: "Could not send the invite email." };
  }

  return { ok: true };
}
