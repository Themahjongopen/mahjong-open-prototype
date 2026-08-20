import { Resend } from "resend";
import { buildBrandedEmail } from "@/lib/email/brandedEmail";
import { SITE_URL } from "@/lib/site";
import { formatTableTime } from "@/lib/format/time";

const FROM = "The Mahjong Open <welcome@themahjongopen.com>";

export type TableInviteDeclinedResult = { ok: boolean; error?: string };

// Plain date -> "Thursday, August 20" (midday UTC anchor avoids tz day-shift).
function formatDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * Sent to the INVITER when an invitee declines their table invitation (held-seats
 * feature, migration 044). The declined invite's hold is released, so the seat is
 * open again — the whole point (commissioner Kim's framing: "so the host knows
 * they're not coming, and then they can invite somebody else").
 *
 * Sent ONLY on an invitee-initiated decline, never on a host/inviter self-release
 * (they already know). Expiry stays silent by design — there is no write at the
 * derived-expiry instant to hang an email on. Unconditional (no prefs gate), same
 * posture as tableInviteEmail. Best-effort: release_hold already committed, so a
 * send failure only logs and never rolls the decline back.
 */
export async function sendTableInviteDeclinedEmail(
  recipient: { email: string; fullName?: string | null },
  info: {
    tableId: string;
    declinerName: string | null;
    tableDate: string;
    tableTime: string | null;
    locationName: string;
    roundType: string | null;
  }
): Promise<TableInviteDeclinedResult> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return { ok: false, error: "Email service is not configured." };

  const firstName = (recipient.fullName ?? "").trim().split(/\s+/)[0] || "there";
  const declinerName = (info.declinerName ?? "").trim() || "Someone you invited";
  const dateLabel = formatDate(info.tableDate);
  const timeLabel = formatTableTime(info.tableTime);
  const url = `${SITE_URL}/portal/tables/${info.tableId}`;

  const innerHtml = `
    <p style="margin:0 0 12px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">Hi ${firstName},</p>
    <p style="margin:0 0 16px 0;font-size:15px;line-height:1.65;color:#3a4a4f;"><strong>${declinerName}</strong> won&rsquo;t be joining your table on ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""} at ${info.locationName}. The seat is open again &mdash; you can invite someone else.</p>
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
      subject: `${declinerName} can’t make your table`,
      html: buildBrandedEmail({
        title: "A seat just opened up",
        innerHtml,
        preheader: `${declinerName} declined — ${dateLabel} at ${info.locationName}`,
      }),
    });
    if (error) return { ok: false, error: "Could not send the decline email." };
  } catch {
    return { ok: false, error: "Could not send the decline email." };
  }

  return { ok: true };
}
