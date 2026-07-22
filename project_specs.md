# Project Specs — Mahjong Open Preview-First Redesign

## Overview
This project implements the preview-first mock-mode changes from §13 of the client brief, using existing mock data only. The goal is to make the portal/site look and feel aligned with the client's requested structure before any Supabase/backend work is done.

## In scope
- Global terminology updates:
  - Replace user-facing occurrences of **"Scramble"** with **"Mahjong Game League"**.
  - Replace user-facing occurrences of **"Season"** with **"Series"**.
- Launch state:
  - Display **Ocean Springs, MS** as the active launch city.
  - Use the first series naming convention: **"The Mahjong Open — 2026 — Series One"**.
- Marketing structure:
  - Remove the **Scramble Events** marketing page/link.
  - Update marketing copy to remove incorrect model language such as “one game per week” and “admin-approved scores.”
  - Set the primary CTA to **Register** where appropriate.
- Portal structure:
  - Remove the **Announcements / Alerts** portal feature.
  - Add a **Member Directory** route/tab under `app/portal/directory`.
  - Add **Add to Calendar** capability for tables and my tables views.
- Standings display:
  - Update the standings UI to surface average-score-oriented results and weekly top-2 leaderboard data in mock form.
- Data source:
  - Use existing mock data in `lib/data/mock.ts` only.
  - Do not wire Supabase yet.
- Preserve current auth/data stubs and keep the demo site deployable immediately.

## Not in scope
- Real Supabase integration or migrations.
- Real backend scoring engine or approvals logic beyond UI presentation.
- Payment processing and email workflows.
- Commissioned role / city-scoped backend rule enforcement.
- Writing final client-provided copy for About / Membership / FAQ / Shop.

## Implementation plan
1. Adjust mock data for Hattiesburg-only city and series naming.
2. Remove the `events` marketing route and nav links.
3. Remove portal announcements/alerts feature.
4. Add the portal directory page and directory tab.
5. Add calendar-export links or download buttons on table detail and My Tables.
6. Update marketing and portal copy to match the new model.
7. Update standings display to present average-style ranking and weekly top scores.
8. Deploy the mock-only changes to Vercel for review.

## Phase 2 — Admin Console, Roles, Referrals & Ranking

This phase extends the preview-first work into the admin experience and ranking/referral concepts from §15 of the redesign brief. The intent is to ship the UI surface for review with mock data while leaving backend logic and real payout/refund behavior for later.

### Scope for this phase

#### Preview now (mock data only)
- Add a clearly distinct Admin Console experience from the player portal, including an analytics dashboard with clearly labeled sample numbers.
- Show role-scoping in the UI for:
  - 4 co-equal admin accounts
  - one per-city commissioner role
  - player view
- Add a view-as-player toggle in the admin console header so admins/commissioners can preview the portal experience.
- Add a referral experience with:
  - a unique referral link per account
  - a "Your referrals" panel with sample rows and statuses
  - a simple admin view of referrals for future reward handling
- Add a weekly top-finisher badge on the standings page using mock data.
- Add a "Mahjong Open Rulebook" button on the portal home linking to a placeholder URL/PDF until the real handbook is available.
- Fix the homepage hero image so it no longer breaks on load (use an existing asset or placeholder image).

#### Backend / future work (do not fake real functionality)
- Real refunds, refund permissions, and payout statements must not be faked as if they move money.
- Real referral tracking and reward fulfillment must not be faked; only the UI and data-model hooks should be prepared.
- Cross-city / overall leaderboard, city-vs-overall toggle, and overall ranks should not be faked as if they are real; the UI should be prepared and data-model hooks should be added for later.
- Add data-model hooks for later implementation, including:
  - expanded role support for 4 admins + city commissioners
  - a `referred_by` field and referral type field in the registration/profile model
  - commissioner payout and refund-related fields where appropriate
  - a standings model structure that can support city + overall ranking later

### Implementation constraints
- Keep everything deployable on the existing mock data.
- Any sample analytics, referral lists, or badges must be labeled clearly as sample/mock content.
- Do not implement refund actions, real attribution, or real ranking logic as if they were live features.

## Launch 1 backend scope (approval gate)
This is the only backend work included in the first launch pass, and it is intentionally narrower than the full redesign:

- Build the public-facing site and a working registration flow that saves a registration to Supabase.
- Do not build the portal, tables, scores, standings, referrals, or commissioner tooling in this pass.
- Use a fresh, focused migration only for launch-critical entities:
  - `profiles` with `phone` and the minimum user fields needed for registration.
  - `cities` seeded with `Ocean Springs, MS` as the active launch city, with a simple structure that can later accept `Meridian`.
  - `series` seeded with `The Mahjong Open — 2026 — Series One` and the Aug 17–Oct 11 window.
  - `registrations` (or `memberships`) storing name, email, phone, city, skill level, and paid status.
  - `payments` storing payment records for a registration.
- Keep the registration experience focused on the client-required fields:
  - Name
  - Email
  - Phone number
  - City (dropdown with initial seeded options: Ocean Springs, MS and Meridian, MS; editable later if the client changes launch cities)
  - Skill level
  - Optional placeholder for a waiver/terms toggle until the client confirms wording.
- Remove the preferred game day field from the Launch 1 registration form.
- Mock the payment step for now so the registration can be saved while Stripe is still pending.
- Do not start from the old `001_initial_schema.sql`/`002_rls_policies.sql` baseline for this launch; create a new focused migration that only includes the launch-1 data model.
- Preserve the current mock preview UI as needed, but the backend path for Launch 1 must be real Supabase-backed registration storage.

## Go-Live & Post-Launch — July 22, 2026

The site is **live in production at https://themahjongopen.com** (canonical host
`https://www.themahjongopen.com`).

### Completed this session
- **Launched to production** — site live at themahjongopen.com; the `COMING_SOON`
  env var was **deleted** in Vercel (coming-soon gate off).
- **Search visibility** — `SITE_INDEXABLE=true` added in Vercel (site is now
  indexable). **Google Search Console verified** — verification meta tag added to
  `app/layout.tsx` (`verification.google` in the metadata object) — and the
  **sitemap submitted**.
- **Waitlist blast sent** — launch announcement emailed to the waitlist.
- **Admin access granted** (via SQL, `profiles.role = 'admin'`) to
  `shariskelly@gmail.com`, `abirdsong75@gmail.com`, and `afgolfgirl@gmail.com`.
- **Supabase auth config** — Site URL updated to
  `https://www.themahjongopen.com`; production redirect URLs added.
- **Stripe webhook fix** — the confirmation/owner emails now show the real amount
  charged (`session.amount_total / 100`) instead of the series list price, so
  coupon registrations correctly display **$0.00**.
- **Mobile scroll fix** — `RegisterModal` capped at `90vh` with an inner
  `overflow-y: auto` region so the submit button is reachable on narrow
  (375px) viewports.

### Pending / follow-up
- **Admin passwords** — the three newly granted admins must use **"Forgot
  Password"** on the portal login to set their passwords (SQL-granted accounts
  have no password yet).
- **Commissioner role** — assignment approach still **under discussion**.
  Migration 017 added a standalone `is_commissioner` flag decoupling the
  directory badge from `role`; the final workflow is TBD.
- **`/sign-in` page (Phase 2)** — currently redirects unauthenticated visitors to
  the homepage (admins pass through to `/admin`). Phase 2 should render an actual
  sign-in **form** for unauthenticated users.

## Review checklist
- [ ] `app/(marketing)` no longer includes Scramble Events.
- [ ] Portal bottom nav shows Directory instead of Alerts.
- [ ] `app/portal/directory` exists and shows a member roster.
- [ ] Table detail and My Tables include Add to Calendar actions.
- [ ] Marketing copy stops referencing weekly cadence and admin approval.
- [ ] Standings view reflects average/top-2 style ranking in mock mode.
- [ ] Active city data is seeded to Ocean Springs, MS only.
- [ ] Phase 2 admin console UI and mock-only preview features are included.
- [ ] Backend/future items are documented as pending data-model work rather than faux functionality.
- [ ] No Supabase or backend logic changes are required for this preview.

## Notes
- `CLAUDE.md` in this repo currently points to `AGENTS.md`; the actual design brief is documented in `docs/Portal-Redesign-Brief-from-Client-Responses.md`.
- This spec is intentionally limited to the preview-first visual/structural changes requested by the client.
