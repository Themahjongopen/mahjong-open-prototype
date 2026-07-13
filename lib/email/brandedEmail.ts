const ASSET_BASE = "https://mahjong-open-prototype-pi.vercel.app";

export function buildBrandedEmail({
  title,
  innerHtml,
  footerNote = "A city-based Mahjong game league.",
}: {
  title: string;
  innerHtml: string;
  footerNote?: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f4f5f3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f3;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6e8e4;">
            <tr>
              <td align="center" style="padding:38px 24px 6px 24px;">
                <img src="${ASSET_BASE}/assets/logo-email.png" alt="The Mahjong Open" width="220" style="display:block;margin:0 auto;border:0;" />
              </td>
            </tr>
            <tr><td style="padding:14px 40px 0 40px;"><div style="height:3px;background-color:#8ab49c;border-radius:2px;"></div></td></tr>
            <tr>
              <td style="padding:28px 40px 4px 40px;font-family:Helvetica,Arial,sans-serif;">
                <h1 style="margin:0 0 12px 0;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#1d4d59;font-weight:normal;">${title}</h1>
                ${innerHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 24px 40px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font-size:0;line-height:0;height:24px;">&nbsp;</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;background-color:#1d4d59;font-family:Helvetica,Arial,sans-serif;">
                <img src="${ASSET_BASE}/assets/logo-email-white.png" alt="The Mahjong Open" width="150" style="display:block;margin:0 0 14px 0;border:0;" />
                <p style="margin:0 0 10px 0;font-size:12px;line-height:1.5;color:#b8cdc6;">${footerNote}</p>
                <p style="margin:0;font-size:12px;line-height:1.5;color:#8ba89f;">[ Mailing address — add before sending marketing emails ]</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#9aa39f;">&copy; 2026 The Mahjong Open</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
