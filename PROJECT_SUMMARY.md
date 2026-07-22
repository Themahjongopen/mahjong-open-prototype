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
- **Two leaderboards:** Top Leader Score (best 7 weekly totals, each = top 2
  round scores that week) and Top Average Score (per-round average, min 5
  rounds).

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
