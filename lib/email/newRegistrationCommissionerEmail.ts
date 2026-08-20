import { buildBrandedEmail } from "@/lib/email/brandedEmail";

// Sent to a city's commissioner(s) the moment a registration is PAID, so they can
// onboard the new player (add to GroupMe, send a welcome) without opening the
// admin console. Built to be acted on directly from the inbox: the email address
// is shown as large, tap-and-hold-selectable text plus a one-tap "Send a welcome
// email" mailto button, and the phone (when collected) is a tap-to-call link.
export function buildNewRegistrationCommissionerEmail(params: {
  playerName: string;
  email: string;
  phone: string | null | undefined;
  cityName: string;
  registeredAt: string;
  // Who this registration is credited to, already formatted (e.g. "Sandy Faulkner",
  // "Sandy Faulkner & Vicki Campbell", or "Unattributed"). A shared credit reads as
  // a full name each — a commissioner should never have to wonder whether it means
  // half or full.
  creditedTo: string;
}): { subject: string; html: string } {
  const { playerName, email, phone, cityName, registeredAt, creditedTo } = params;

  const rowLabel = "font-size:11px;letter-spacing:1px;color:#8a9a93;text-transform:uppercase;margin:0 0 2px 0;";
  const rowValue = "font-size:16px;color:#142f34;margin:0 0 16px 0;font-weight:bold;";

  const phoneRow = phone
    ? `<p style="${rowLabel}">Phone</p>
       <p style="${rowValue}"><a href="tel:${phone}" style="color:#142f34;text-decoration:none;">${phone}</a></p>`
    : `<p style="${rowLabel}">Phone</p>
       <p style="font-size:15px;color:#8a9a93;margin:0 0 16px 0;">Not collected</p>`;

  const innerHtml = `
    <p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">A new player just paid and joined <strong style="color:#1d4d59;">${cityName}</strong>. Here are their details so you can add them to your GroupMe and send a welcome.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f2;border:1px solid #dde7e0;border-radius:10px;margin:0 0 20px 0;">
      <tr>
        <td style="padding:20px 24px;font-family:Helvetica,Arial,sans-serif;">
          <p style="${rowLabel}">Name</p>
          <p style="${rowValue}">${playerName}</p>
          <p style="${rowLabel}">Email</p>
          <p style="font-size:16px;margin:0 0 16px 0;word-break:break-all;"><a href="mailto:${email}" style="color:#c60e31;font-weight:bold;text-decoration:none;">${email}</a></p>
          ${phoneRow}
          <p style="${rowLabel}">City</p>
          <p style="${rowValue}">${cityName}</p>
          <p style="${rowLabel}">Credited to</p>
          <p style="${rowValue}">${creditedTo}</p>
          <p style="${rowLabel}">Registered</p>
          <p style="font-size:15px;color:#142f34;margin:0;">${registeredAt}</p>
        </td>
      </tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
      <tr>
        <td align="center" style="background-color:#ec466e;border-radius:999px;">
          <a href="mailto:${email}?subject=${encodeURIComponent(`Welcome to The Mahjong Open — ${cityName}!`)}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Send a welcome email</a>
        </td>
      </tr>
    </table>
  `;

  return {
    subject: `New player in ${cityName} — ${playerName}`,
    html: buildBrandedEmail({
      title: "New player registered",
      innerHtml,
      footerNote: "Mahjong Made Social. You’re receiving this because you’re a commissioner for this city.",
    }),
  };
}
