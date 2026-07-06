# Phase 2 Spec — Member Portal (Auth + Tables + Scores + Standings)

_Drafted 2026-07-06. Status: **DRAFT — awaiting Jordan's approval before any code.**_

## What this phase delivers and who uses it
Wire the existing mock-mode member portal (`app/portal/*`) to real Supabase data behind real authentication. Users: **players** (registered + paid members), the **commissioner** (a player with a badge, one per city), and the **admin** (Shari) via the existing `/admin` console. Ships as one milestone ("full portal") on a `phase2` branch; `main` stays clean for Phase 1 fixes.

## Locked decisions (2026-07-06)
- **Auth: email + password.** Admin-triggered Supabase Auth invites → player sets a password. Includes forgot-password reset flow. (Confirm with client; magic-link was the earlier recommendation but password was chosen.)
- **Tables: players self-organize.** Any member creates a table (week, date/time, location, optional skill level); other members claim the 3 open seats. Matches the existing `creator_id` + seats schema and the mock "create table" page.
- **Scores: table creator submits for all 4 players. No admin approval.** Scores post to standings immediately. Admin can edit/void a submission after the fact (correction path, not an approval gate).
- **Scope: full portal in one milestone** — auth, directory, tables, my-tables, scores, standings, profile.

## Tech stack (unchanged)
Next.js App Router + TypeScript · Supabase (Auth + Postgres + RLS) · Resend (email, incl. Supabase Auth SMTP) · Stripe (Phase 1, untouched) · Vercel. No new third-party services.

## Schema reconciliation (must happen first)
The repo has two conflicting schema generations:
- **Migrations 001/002** (portal model: `seasons`, `city_memberships`, `scramble_tables`, `table_seats`, `score_submissions`, `standings`, `announcements`) — written pre-launch; **presumed NOT applied to the live Supabase project** (verify in the dashboard first).
- **Migration 003+** (live Phase 1 model: `profiles`, `cities`, `series`, `registrations`, `payments`).

**Plan:** retire 001/002 (mark as superseded, do not apply). New **migration 006** creates the portal tables aligned to the live model:

| Table | Purpose / key columns |
|---|---|
| `league_tables` | replaces `scramble_tables` (rename closes the old "scramble" flag). `city_id`, `series_id`, `creator_id → profiles`, `week_number`, `table_date`, `table_time`, `location_name/address`, `skill_level?`, `notes?`, `status: open/full/completed/canceled` |
| `table_seats` | `table_id`, `user_id`, `seat_number 1–4`, `canceled_at?`; unique (table,user) + (table,seat) |
| `score_submissions` | one per table, `submitted_by` (must = table creator), `status: submitted/edited/voided` (no approval states), timestamps |
| `score_submission_players` | per-player `wins`, `points`, `notes?` |
| `standings` | per (`series_id`, `user_id`): `total_points`, `total_wins`, `tables_played`, `avg_points`, `rank`, `updated_at` — recalculated on submission/edit/void |

`profiles` (from 003) already has `role: player/admin/commissioner`. **No `city_memberships` table:** membership = a `paid` row in `registrations`, linked to `profiles` **by email** at invite time (add `registrations.profile_id` nullable FK, backfilled on account creation).

**RLS:** members read portal data for their own city/series; writes limited to own seats, own tables, and creator-only score submission; admin service-role bypass stays server-side.

## Pages & flows
**Public/auth:** `/portal/login` (email+password), `/portal/set-password` (invite landing), `/portal/reset-password`. All `/portal/*` routes require a session (middleware via `proxy.ts` convention); unpaid/unknown emails get a friendly "register first" screen.

**Portal (existing pages, wired to real data):**
- **Home** — my week: my next table, standings snapshot.
- **Directory** — paid members of my city/series; commissioner badge; links to `profile/[id]`.
- **Tables** — browse open tables by week; join a seat; **create table** flow; table detail with Add-to-Calendar (exists).
- **My Tables** — joined/created tables; leave a seat (frees it); creator can cancel table.
- **Scores** — creator-only: after table date, submit wins/points for all 4 seats; locked after submit (admin fixes mistakes).
- **Standings** — average-style ranking + weekly top scores (top-2 style, per redesign scope). _Open: exact formula — confirm with client._
- **Profile** — own profile edit (name, phone); public view shows name, skill, commissioner badge.

**Admin (`/admin`):**
- Replace passcode gate with **real `role === 'admin'` gating** (passcode retired).
- Players page: re-introduce **Player↔Commissioner control** against real `profiles` (join registrations by email); **fix the city-scope bug** in the auto-demote (currently demotes across all cities in the Supabase branch).
- New: **Invite to portal** action (single + bulk "invite all paid") via Supabase Admin API; **score corrections** (edit/void a submission → standings recalc).

## Onboarding & email
- Supabase Auth emails (invite, reset) routed through **Resend custom SMTP** with branded templates (matches `buildBrandedEmail` look; sent by Supabase, not app code).
- One-time **"portal is live"** announcement via Resend to paid registrants (needs client mailing address before send — launch-blocking item already tracked).
- League-ops emails (schedule/results/renewal) stay in the backlog — **not in this milestone.**

## Explicitly out of scope
Real scoring formula changes beyond the agreed model · league-ops emails · announcements feature (removed) · referral (removed) · custom domain / live Stripe (Phase 1 launch items) · deleting mock mode for the *marketing* site (portal only).

## Definition of done
1. Migration 006 applied; 001/002 marked superseded; RLS verified with a non-admin test user.
2. A paid registrant can be invited, set a password, log in, and see only their city/series data.
3. Full loop verified in prod: create table → 3 others join → auto-`full` → creator submits scores → standings update instantly → Add-to-Calendar works.
4. `/admin` requires an admin account (passcode removed); commissioner control works city-scoped; admin can correct a score and standings recalc.
5. Mock-data imports removed from all portal pages; `npm run build` passes; E2E pass on the Vercel preview before merging `phase2` → `main`.

## Open questions (don't block build start)
- Exact standings formula (avg points? min-tables threshold? how "weekly top-2" counts).
- Password vs magic-link: confirm the email+password choice with the client (it adds reset-flow support burden).
- Can players join tables in other cities? (Assume no — city-locked.)
- Seat-leave cutoff (e.g. lock leaving <24h before table time?).

## Workflow after approval
Update `project_specs.md` → copy this spec to repo `docs/` → hand to Claude Code on branch `phase2` in build order: migration+RLS → auth+invites → directory/profile → tables+seats → scores → standings → admin changes.
