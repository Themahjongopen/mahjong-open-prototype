# The Mahjong Open — Project Summary

## Status: 🎉 LIVE

The site is **live in production at https://themahjongopen.com** (canonical host
`https://www.themahjongopen.com`) as of **July 22, 2026**.

## What it is

A city-based mahjong social league. Players register once, play unlimited games
over an 8-week series, and climb their city's leaderboard.

- **Stack:** Next.js 16 (App Router) · Supabase (Postgres + Auth + Storage +
  RLS) · Stripe Checkout · Resend (email) · Vercel (hosting).
- **Surfaces:**
  - **Marketing site** (`app/(marketing)`) — public.
  - **Player portal** (`app/portal`) — Supabase-auth, paid members.
  - **Admin console** (`app/admin`) — gated to `profiles.role = 'admin'`.
- **Flow:** register → Stripe Checkout → webhook flips registration to paid,
  records the payment, and sends confirmation + owner-notice emails.

## Series One

- **Launch cities:** Madison, MS and Ocean Springs, MS.
- **Series One dates:** Aug 17 – Oct 11, 2026 (8 weeks).
- **Price:** $80 per series.
- **Three leaderboards** (replaced the original two — see the scoring
  overhaul below): **Ace Award** (single highest round score, no minimum),
  **Champion Award** (best-7-of-8 weekly `avg(min, max)` round score minus
  no-show penalties), and **city-vs-city** ("The Mahjong Open Leader" — sum
  of the top 3 individual round scores recorded in that city).

## Go-Live milestone — July 22, 2026

Completed this session:

- **Launched to production** — live at themahjongopen.com; the `COMING_SOON`
  env var was **deleted** in Vercel, so the coming-soon gate is off.
- **Search visibility** — `SITE_INDEXABLE=true` added in Vercel (site is now
  indexable). **Google Search Console verified** (verification meta tag added to
  `app/layout.tsx`) and the **sitemap submitted**.
- **Waitlist blast sent** — launch announcement emailed to the waitlist.
- **Admin access granted** (via SQL) to `shariskelly@gmail.com`,
  `abirdsong75@gmail.com`, and `afgolfgirl@gmail.com`.
- **Supabase auth config** — Site URL updated to
  `https://www.themahjongopen.com`; production redirect URLs added.
- **Stripe webhook fix** — the "Amount paid" figure now uses
  `session.amount_total` (the real amount charged after discount codes), so
  coupon registrations correctly show **$0.00** instead of $80.00.
- **Mobile scroll fix** — `RegisterModal` is capped at `90vh` with an inner
  `overflow-y: auto` region, so the submit button is reachable on narrow
  viewports (375px).

Also shipped in the surrounding session (code):

- Admin dashboard tiles + player portal home stats wired to **live data**
  (`/api/admin/metrics`, `/api/portal/my-stats`).
- Migration **016** (`show_in_directory` opt-out) and **017** (standalone
  `is_commissioner` flag, decoupled from `role`).
- Marketing copy corrected to the two-leaderboard model; homepage launch-cities
  section + optimized brand photos added.
- "Sign In" removed from marketing nav; `/sign-in` redirects visitors to `/`
  (admins pass through to `/admin`).
- Portal "Switch to admin view" now navigates to `/admin` (in-portal admin
  overlay removed).

## Scoring overhaul — August 10, 2026

The original two leaderboards ("Top Leader Score" / "Top Average Score") were
retired and replaced ahead of legal/wording pushback from other leagues, and a
new cross-city competition was added (this reverses an earlier "no combined
leaderboard" scope line — a genuine new feature, not a rename).

- **Ace Award** — a player's single highest round score across the series. No
  minimum rounds, no tiebreaker (ties share a rank).
- **Champion Award** — reuses the old "Top Leader Score" engineering (weekly
  bucketing, best-7-of-8 weeks, no-show penalty subtracted across all 8
  weeks), but the weekly value changed from `SUM(top 2 round scores)` to
  `avg(min round, max round)` that week. No minimum. Tiebreak: higher total
  score across all rounds played.
- **City-vs-city — "The Mahjong Open Leader"** — city score = sum of the top 3
  individual round scores recorded by anyone registered in that city that
  series (not top-3-players'-totals — the 3 highest single round scores
  city-wide). No floor.
- All three are scoped per `(series, city)`, so a player registered in two
  cities (the `2NDCITY` multi-city feature) gets independent numbers in each.
  A review-stage bug in the first draft — grouping by `(series, user)` only —
  duplicated a multi-city player's weekly values once per city and inflated
  Champion Award; caught and fixed before commit by hand-verifying against a
  real multi-city demo player. **The original migration 013 view had the same
  latent gap**, so it's worth keeping in mind if historical Series data is
  ever audited (no real scoring happened before this shipped, so no real data
  was affected).
- A second bug shipped post-merge: migration 027 was modeled on migration
  013's original view shape and silently dropped the `avatar_url` column that
  migration 015 had since added, breaking both standings pages in production
  (`avatar_url` is selected for the `<Avatar>` component). Fixed forward via
  migration `028_standings_avatar_url_fix.sql` rather than editing the
  already-live `027` in place.
- Migrations: `027_ace_champion_awards.sql`, `028_standings_avatar_url_fix.sql`.
- `docs/Scoring-Standings-Final-Spec.md` is superseded;
  `docs/Scoring-Standings-Final-Spec-v2.md` is the authoritative spec.

## Pending / next

- **Admin passwords** — the three newly granted admins must use **"Forgot
  Password"** on the portal login to set their passwords (accounts were granted
  `role = 'admin'` via SQL and have no password yet).
- **Commissioner role** — approach still **under discussion**. Migration 017
  added a standalone `is_commissioner` flag that decouples the directory badge
  from `role`; the final assignment workflow is TBD.
- **`/sign-in` form (Phase 2)** — the page currently redirects unauthenticated
  visitors to the homepage (and admins through to `/admin`); Phase 2 should
  render an actual sign-in form for unauthenticated users.
