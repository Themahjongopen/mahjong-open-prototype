import { buildBrandedEmail } from "./brandedEmail";

// One-time "we're live — register now" email for the waitlist, sent when the
// coming-soon gate flips OFF and registration opens. Copy is from
// docs/Waitlist-Launch-Email-Draft.md. Uses the shared branded shell (logo
// header, pink CTA, navy footer with mailing address) — same as the welcome
// email. Kept as a reusable module so the real blast (likely a Resend
// broadcast, for unsubscribe handling) can render identical HTML.

export const WAITLIST_LAUNCH_SUBJECT = "The Mahjong Open is live — save your spot";

export const WAITLIST_LAUNCH_PREHEADER =
  "Registration is officially open — grab your seat for the first 8-week series.";

const REGISTER_URL = "https://themahjongopen.com/#register";

export function buildWaitlistLaunchEmail() {
  const p = "margin:0 0 14px 0;font-size:15px;line-height:1.65;color:#3a4a4f;";
  const strong = "color:#1d4d59;";

  const innerHtml = `
        <p style="${p}">You asked to be the first to know, so here it is: <strong style="${strong}">registration is now open</strong> in the cities of Mobile, AL; Slidell, LA; Ocean Springs, MS; and Madison, MS.</p>
        <p style="${p}">The Mahjong Open is a city-based mahjong social league for everyone who loves the game. Register once and you&rsquo;re set for a full <strong style="${strong}">8-week series</strong> &mdash; play unlimited games, meet players across your city, and climb the leaderboard. Series One runs August 17 &ndash; October 11 &mdash; register now to be there from week one. All skill levels are welcome, and you play on your own schedule.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 24px auto;">
          <tr>
            <td align="center" style="background-color:#ec466e;border-radius:999px;">
              <a href="${REGISTER_URL}" style="display:inline-block;padding:13px 32px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;font-weight:bold;">Save my spot</a>
            </td>
          </tr>
        </table>
        <p style="${p}">Here&rsquo;s how it works: a series kicks off in your city once <strong style="${strong}">20 players</strong> have registered &mdash; so claim your spot and bring a friend or two. And if your city doesn&rsquo;t reach 20, everyone is fully refunded, so there&rsquo;s no risk in being early.</p>
        <p style="${p}">Don&rsquo;t see your city? The Mahjong Open grows one community at a time &mdash; and it starts with someone like you. If you&rsquo;d love to bring the league to your town, we&rsquo;d love to meet you.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px auto;">
          <tr>
            <td align="center" style="border:2px solid #1d4d59;border-radius:999px;">
              <a href="https://themahjongopen.com/lead-a-city" style="display:inline-block;padding:11px 30px;font-family:Helvetica,Arial,sans-serif;font-size:15px;color:#1d4d59;text-decoration:none;font-weight:bold;">Bring it to my city</a>
            </td>
          </tr>
        </table>
        <p style="${p}">We can&rsquo;t wait to see you at the table.</p>
        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.65;color:#3a4a4f;">&mdash; The Mahjong Open</p>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#8a9499;font-style:italic;">$80 per 8-week series &middot; all skill levels welcome &middot; play anywhere in your city</p>
  `;

  return buildBrandedEmail({
    title: "It’s official — The Mahjong Open is here.",
    innerHtml,
    preheader: WAITLIST_LAUNCH_PREHEADER,
    footerNote:
      "A city-based mahjong social league. You’re receiving this because you signed up to be notified when registration opened.",
  });
}
