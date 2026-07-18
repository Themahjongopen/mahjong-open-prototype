// Base URL for building auth redirect links (invite / password reset callbacks).
// NOTE: themahjongopen.com is NOT connected yet — this defaults to the Vercel
// prototype URL until the domain connects at launch. See the go-live checklist:
// swap NEXT_PUBLIC_SITE_URL (and the hardcoded SITE_URL in the Stripe webhook)
// to https://themahjongopen.com when the domain goes live.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://mahjong-open-prototype-pi.vercel.app";
