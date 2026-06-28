# The Mahjong Open — Portal & Website Redesign Brief

**Purpose:** Hand this document to Claude Code. It compares what the live prototype does *today* against what the client (Shari Kelly) specified in the discovery questionnaire, flags every place they differ, and gives concrete, file-level code-change recommendations to align the build with the client's intent.

**How to read each section:** every area is laid out as **Current state → Client wants → The gap → Recommended change (real files)** so Claude Code can act on it directly.

---

## 0. Inputs & ground truth

| Source | What it is | Where |
|---|---|---|
| Live prototype | Next.js app, deployed on Vercel | `github.com/jordanpaulco-37/mahjong-open-prototype` (branch `main`), `mahjong-open-prototype.vercel.app` |
| Discovery questionnaire | The 95-question form the client answered | `Mahjong-Open-Discovery-Questionnaire.md` |
| Client responses | Shari Kelly's actual answers (submitted 2026-06-24) | Google Form Excel export |

**Important framing for Claude Code:** the API routes (`app/api/**`) are demo stubs that return `{ ok: true }` and all data comes from `lib/data/mock.ts`. There is **no real backend logic or scoring engine yet**. So most "recommendations" below are *build*, not *rewrite* — but the data model (`supabase/migrations/001_initial_schema.sql`) and the mock data encode assumptions that conflict with the client's rules and must be changed first, because the UI and (eventual) backend follow from them.

> Branding note: the pink/sage/petrol palette, Bodoni Moda + Quicksand fonts, and new logo SVGs in `public/assets/` are already in the repo (the recent "Rebrand + restructure" commit). This brief does **not** re-spec visuals — it's about content, structure, and portal logic. The client has newer brand colors/logos and is mid-swap; treat `app/globals.css` color tokens and `public/assets/*` as in-flux, not as requirements.

---

## 1. Executive summary — the big shifts

The prototype was built around a **weekly, cumulative-points, admin-approved** league. The client's actual model is a **flexible, unlimited-play, average-score, self-reported** league. The five changes that ripple through everything:

1. **Unlimited games, not one-per-week.** Players play as much as they want during the 8 weeks. The `week_number` (1–9) scaffolding and "one game per week" copy must go.
2. **Average score + top-2-per-week leaderboard, not cumulative total points.** This is the single biggest logic change. Standings rank on *average* score with specific bonuses and a no-show penalty.
3. **No admin approval of scores.** The four players agree at the table; the proposer enters all scores; they post immediately. Remove the entire approval workflow.
4. **Per-city "Commissioner" model.** Each city is fully separate (own members, standings, leader) and run by a paid Commissioner — a role the current two-value `player|admin` model doesn't support.
5. **Trim the surface area.** Remove the *Scramble Events* marketing tab and the *Announcements* portal feature; add a *Member Directory* and *Add to Calendar*.
6. **Rename throughout.** "Scramble" → **Mahjong Game League**; "Season" → **Series** (each 8-week period — e.g., "The Mahjong Open — 2026 — Series One"). See §1.5.

Plus: launch is **Hattiesburg only** (with admins able to add cities as more commissioners sign on), pricing is a fixed **$80 / 8 weeks**, and several pages await copy the client will email.

---

## 1.5 Global terminology changes (apply site-wide)

Two brand-wide wording changes. Apply to **all user-facing copy** (site + portal). For code identifiers (table/column/variable names), renaming is *recommended* for consistency but optional pre-launch — at minimum, no old term should ever reach the UI.

**"Scramble" → "Mahjong Game League"**
- Remove the word *scramble* everywhere in user-facing copy. The 8-week competitive program run under The Mahjong Open brand is the **Mahjong Game League**.
- Affected copy/UI: the "How It Works" program description, homepage, any "scramble format/program" phrasing. (The "Scramble Events" marketing page is removed entirely — see §3.)
- Code identifiers (optional rename, recommended): the DB table `scramble_tables`, related types, and any `MOCK_TABLES` text.

**"Season" → "Series"**
- Each 8-week tournament period is a **Series**, not a season. Naming convention: **"The Mahjong Open — 2026 — Series One"** (then Series Two, etc.).
- Affected copy/UI: anywhere the app shows "season," "Spring 2026," "this season," "end of season," "season standings," etc. → use "series."
- Code identifiers (optional rename, recommended): the `seasons` table, `season_id` FKs, `MOCK_SEASONS`, the quarter/`season_index` field, the "end-of-season results" notification label.

> Note: sections below still use the current code names (`scramble_tables`, `seasons`, `season_id`) because that's what's in the repo today. Apply the renames per this section as you touch each file; the priority is that **no "scramble" or "season" string is visible to users.**

---

## 2. Brand, cities & series

**Current state**
- Mock cities are `Los Angeles`, `New York`, `San Francisco` (`lib/data/mock.ts` → `MOCK_CITIES`). Cities are **data-driven** (`cities` table) and an admin "Cities" page already exists at `app/admin/cities/page.tsx`.
- Series (currently coded as "seasons") are named `Spring 2026`, quarter-based (`quarter` 1–4), `total_weeks: 8` (`MOCK_SEASONS`, schema `seasons`).

**Client wants**
- **Launch with Hattiesburg only** shown as the active city in the portal, with admins able to **easily add a new city/state** as more city commissioners sign up.
- Year-1 target cities (add as commissioners come on): Meridian, Ocean Springs, Hattiesburg, Madison, Starkville, Oxford (all MS). Expansion: FL, AL, LA.
- **5 series per year**, each **8 weeks**. First series: **"The Mahjong Open — 2026 — Series One," Aug 17 – Oct 11.**
- Brand voice: *hospitable, welcoming, flexible*; tone *warm & welcoming*.

**The gap**
- Demo cities/series names are placeholders. The `quarter` (1–4) field can't represent 5 series/year. Nothing currently restricts the portal to a single launch city — but the data model and admin Cities page already support multiple cities, so this is a seeding/display concern, not a rebuild.

**Recommended change — single launch city, easy to add more**
- Yes, this is straightforward *because cities are already data-driven.* Seed **only Hattiesburg** with `is_active = true` in `lib/data/mock.ts` / `cities` (omit the others, or set `is_active = false`). Ensure the portal's city selector/queries show only **active** cities, so today it displays Hattiesburg alone.
- Admins add a city through the existing **`app/admin/cities/page.tsx`**: wire its form to insert a `cities` row (`name`, `state`, `slug`, `is_active = true`). New active cities then appear automatically — **no per-city code change.**
- Pair each new city with its Commissioner (see §7) and its own Series.
- Series naming: replace quarter-based "Spring 2026" with the `<brand> — <year> — Series <N>` convention. In `supabase/migrations/001_initial_schema.sql`, drop/replace the `quarter` CHECK on `seasons` (use a `series_number integer`); keep `total_weeks default 8`. Add a `commission_rate` later (see §7).
- Seed the first series: "The Mahjong Open — 2026 — Series One," Aug 17 – Oct 11, for Hattiesburg.

---

## 3. Marketing site — pages, nav & copy

**Current state** — Marketing pages (`app/(marketing)/`): Home, How It Works, **Scramble Events** (`events/`), Shop Our Favorites (`shop/`), Contact. Nav (`components/marketing/Nav.tsx`) links: How It Works, **Scramble Events**, Contact, Shop Our Favorites.

**Client wants**
- **Remove the Scramble Events tab entirely** (asked twice — Q50, Q57).
- Most important visitor action: **Register**.
- Homepage: how it works, register link, "the basics."
- Contact: `Themahjongopen@gmail.com`.
- Shop "Our Favorites": keep — she has product links to send.
- No blog, no educational resources, no extra pages.
- Admires `mahjongparlour.com` (reference for look/feel).
- About / Membership / FAQ / Shop copy: **she will email the wording** (not yet provided).

**The gap**
- Events page exists and is linked; must be removed.
- Marketing copy contains model assumptions that are now wrong (see §5/§6): the Events page states **"One game per week"** and Home states scores are **"approved by league admins"** and **"Points stack across all 8 weeks."** All three contradict the client.

**Recommended change**
- Delete `app/(marketing)/events/page.tsx` and remove the `/events` link from `navLinks` in `components/marketing/Nav.tsx` (and any footer link in `components/marketing/Footer.tsx`).
- Home (`app/(marketing)/page.tsx`): rewrite the feature cards — replace "approved by league admins" / "Points stack across all 8 weeks" (around lines 24–32) with the average-score + self-reported model; replace the "Earn points all season" framing.
- Update Contact page to the real email.
- Leave placeholders/TODOs on About, Membership/Registration, FAQ, and Shop pages flagged "awaiting client copy" (see §11).
- Set the primary CTA everywhere to **Register**.

---

## 4. Membership, registration & payments

**Current state**
- Schema models `city_memberships` (status, paid_status, skill_level) and `payments` (amount cents, provider `stripe`). Registration is a stub (`app/api/register/route.ts` returns `{ ok: true }`); `RegisterModal.tsx` exists. `profiles` stores `full_name`, `email` only.

**Client wants**
- **$80 for 8 weeks**, unlimited play; includes player directory access, prize/award eligibility, special-event invites.
- **Auto-renew:** not specified — treat as **off / manual** (5 discrete seasons/year).
- Join **up to 2 weeks after start**, same price, no proration.
- **No refunds after day 1** of a season; full refund if a city doesn't hit minimum players.
- Registration collects: **Name, Email, Phone, City, Skill level** (+ "Other").
- Waivers/terms: **not sure yet** (leave a toggle/placeholder).
- After registering: **welcome email** explaining what's coming and when the portal opens.

**The gap**
- `profiles` has no **phone**. Pricing isn't represented as a fixed product. No "registration opens/closes 2 weeks in" logic. No minimum-players → refund concept. Payment provider stub only.

**Recommended change**
- Add `phone text` to `profiles` (migration) and to the register form/modal + `api/register`.
- Encode price as a constant/config ($80) and surface it on Membership/Home; wire `payments.amount = 8000`.
- Add a `min_players` (or `min_registrations`) field to `seasons`/`cities` to support the refund-if-not-met rule; add a `registration_closes_at` (start + 14 days) concept.
- Keep Stripe as provider (already assumed) but the actual checkout is still to be built — flag as a dependency for go-live.
- Implement the **welcome email** as the post-registration action (see §8).
- **Registration flow / auth (recommended):** keep the **password off the initial register page** — that page collects player info + payment only. Recommend **passwordless / magic-link login** (Supabase email link) given the client's "simplicity / user-friendly" priority and broad-age audience; alternative is a **"set your password" link in the welcome email** after payment. Account credentials come *after* registration/payment, not on the first screen. Finalize the auth method in Stage 2 (Supabase auth config). **Open decision — confirm with client.**

---

## 5. Tables & scheduling — unlimited play

**Current state**
- `scramble_tables` has `week_number integer CHECK (between 1 and 9)`, one `table_date`/`table_time`, `status open|full|completed|canceled`. UI ("Schedule" tab → `app/portal/tables/`) and mock data are organized **by week** (Week 1–4). Events page copy: **"One game per week."**

**Client wants**
- **Unlimited rounds** during the 8 weeks — "play 4 games to complete the round," propose rounds at local businesses or homes, anytime.
- Players **create / join open tables** (already matches).
- A round needs **4 players**; if someone cancels < 24h without a replacement it's a **no-show**.
- Proposers provide equipment (tiles, racks, mats, dice) unless arranged otherwise.
- City communication via **GroupMe** (external — not a portal feature to build, but reference it).

**The gap**
- The whole **`week_number` 1–9 structure** imposes a weekly cadence the client doesn't use. "One game per week" copy is wrong. Nothing models a **no-show vs. cancellation-with-replacement** distinction or the 24-hour rule.

**Recommended change**
- Make `week_number` **optional/derived** (or drop it): tables are dated within the season window, not bucketed into mandated weeks. If kept for reporting, compute it from `table_date` rather than enforcing one-per-week. Relax/remove the `between 1 and 9` cap.
- Add cancellation/no-show handling on `table_seats`: the existing `canceled_at` is a start, but add the **24-hour, replacement-found?** logic that feeds the scoring penalty (§6). Consider a `seat_status` (`active | canceled_replaced | no_show`).
- Add equipment/notes prompts to the create-table form (`app/portal/tables/create/page.tsx`) — proposer indicates if they're supplying tiles.
- Rewrite all "weekly" / "one game per week" copy (Events page already slated for deletion; check Home, How It Works, portal Schedule labels).

---

## 6. Scoring & standings — the core logic change

**Current state** (`MOCK_STANDINGS`, `score_submission_players`, schema `standings`)
- Per-player record has `wins` + `points`. Standings store `total_points`, `total_wins`, `tables_played`, `rank`, ordered by **cumulative `total_points`**. No averages, no bonuses, no penalties.

**Client wants** (Q31–Q35, Q37 — quote them verbatim in code comments)
- **Leaderboard = top 2 scores for the week** go onto the leaderboard.
- **Ranking metric = average score across all games played** (not cumulative total).
- **Bonuses:** jokerless hand **+10**, self-drawn **+5**.
- **No-show round:** the players who showed up get **+25**; the no-show player gets **−25**. A no-show = cancels within 24h **without** finding a replacement.
- **Missed game** generally = **−25** to the offender. Repeat offenders handled by the city Commissioner.
- **Tiebreaker:** overall ties broken by **average score**; average-score ties broken by **highest single score**.
- **Rankings reset each season.**

**The gap**
- This is a **fundamentally different scoring engine.** Current model sums points; client ranks by *average* with a "top-2-per-week" leaderboard view, bonus point types, and a signed no-show penalty. None of it exists.

**Recommended change**
- Redesign the standings computation:
  - Store per-game scores (keep `score_submission_players.points`), then compute **`average_score`** per player per season as the ranking key. Add `average_score numeric`, `games_played integer`, `best_score integer` to `standings`; demote `total_points` to a secondary stat.
  - Add a **weekly leaderboard view** that surfaces each player's **top 2 scores for that week**.
  - Add bonus fields to score entry: capture **jokerless (+10)** and **self-drawn (+5)** per game so the total per game reflects them.
  - Model the **no-show** as a score row: +25 to attendees, −25 to the no-show, written by the proposer.
  - Implement tiebreakers in the sort: `average_score DESC, best_score DESC`.
  - Reset standings per season (already implied by `season_id` scoping — ensure no carry-forward).
- Add real logic to `app/api/scores/route.ts` (currently a stub) and the recompute on submit.

---

## 7. Roles, admin & approvals

**Current state**
- `profiles.role` is `'player' | 'admin'` only. Full admin suite exists (`app/admin/`): Dashboard, Cities, Seasons, Players, Tables, **Scores (approval)**, **Announcements**. Score submissions carry an **approval workflow** (`status pending|approved|rejected|edited`, `approved_by`, `AdminApprovalCard.tsx`, `app/api/admin/scores/[id]/approve/route.ts`).

**Client wants**
- **No score approval** — the 4 players agree at the table; the **table proposer enters all scores**; they're final.
- Each city is **separate** with its own **Commissioner** who runs that city's league and is **paid a commission**.
- Admins should be able to **access the leaderboard to produce their own reports** (no elaborate reporting suite required).

**The gap**
- Role model can't express a **city-scoped Commissioner**. The **approval workflow contradicts** the self-reported model and should be removed. Reporting needs are lighter than what's scaffolded.

**Recommended change**
- Extend `profiles.role` to include `'commissioner'` (or add a `city_commissioners` join table mapping a user to a city — cleaner for multi-city). Scope admin views by city for commissioners.
- **Remove the approval path:** delete/disable `app/admin/scores/`, `AdminApprovalCard.tsx`, `app/api/admin/scores/[id]/approve/route.ts`; drop `score_submissions.status/approved_by/approved_at` (scores post as final). Update `app/portal/scores/` to reflect "submitted = final."
- Add `commission_rate`/payout tracking to support paid commissioners (future, but reserve the field).
- Keep admin Cities/Seasons/Players/Tables; simplify Scores to a read/export of the leaderboard.

---

## 8. Notifications

**Current state** — No notification system implemented (stubs only).

**Client wants**
- **Players:** Welcome email, Registration confirmation, Payment receipt, **Weekly table reminders**, End-of-season results.
- **Admins:** **New registration** only.
- Automate: **registration confirmation** and **real-time scoring**.
- Explicitly **not** wanted: score-submission reminders, leaderboard-update blasts, event invites as notifications (she didn't select them).

**The gap** — Entire transactional-email layer to build; scope is *narrow* — don't over-build.

**Recommended change**
- Add a transactional email integration (e.g., Resend/Postmark) triggered on: register (welcome + confirmation), payment success (receipt), a scheduled weekly table reminder, and season end (results).
- Admin/commissioner email on new registration only.
- "Real-time scoring" = standings recompute immediately on score submit (ties to §6), no admin step.

---

## 9. Member directory & profiles

**Current state** — No directory page exists (no route under `app/portal/`). Profiles are minimal; portal capabilities are Standings, Scores, Tables, Announcements.

**Client wants**
- Players can **view a member directory** and the **leaderboard**, **edit their profile**, create/join tables, and **add to calendar**.
- **No public profiles** (Q72 = No) — i.e., a roster/directory is fine, but not rich public-facing competitive profiles.

**The gap** — Directory and "add to calendar" don't exist; need to reconcile "view member directory" with "no public profiles" (interpretation: a simple member roster within the logged-in portal, not public web profiles).

**Recommended change**
- Add `app/portal/directory/page.tsx` — a member roster (name, city, maybe skill level) visible to logged-in members only, sourced from `city_memberships` + `profiles`. Keep it minimal per "no public profiles."
- Add **"Add to calendar"** (ICS download / Google Calendar link) on table detail (`app/portal/tables/[id]/`) and "My Tables."
- Profile edit page so players can update name/phone/skill.

---

## 10. Portal structure — tabs

**Current state** — `components/portal/BottomTabBar.tsx`: Home, Standings, **Schedule** (→ `/portal/tables`), Scores, **Alerts** (→ `/portal/announcements`). Also routes: `my-tables`, `payment`, `tables/create`, `tables/[id]`.

**Client wants** — Keep Dashboard, Open Tables, Create Table, Standings, My Tables, Scores. **Delete Announcements.** Add **Member Directory** and **Add to Calendar** capability.

**The gap** — Announcements tab/feature must be removed; Directory tab added.

**Recommended change**
- In `BottomTabBar.tsx`, **replace the "Alerts"/Announcements tab with "Directory"** (`/portal/directory`); remove `app/portal/announcements/page.tsx`.
- Remove `app/admin/announcements/`, `components/marketing` announcement bits, `MOCK_ANNOUNCEMENTS`, and the `announcements` table from the schema (or leave the table dormant but hide all UI — recommend full removal for clarity).
- Confirm tab labels match the client's mental model (she lists "Open Tables" + "Create Table" + "My Tables" — currently consolidated under "Schedule"; consider surfacing them as she expects).

---

## 11. Content the client still owes (do not invent)

These were answered with "I'll email you the wording" — **leave clearly-marked placeholders; do not fabricate copy:**
- **About page** copy (Q53)
- **Membership / Registration page** copy (Q54)
- **FAQ** content (Q55) — anchor around her noted FAQs: how scoring works, how proposing works, how often you can play.
- **Shop "Our Favorites"** product links (Q58)
- **The Mahjong Open Handbook** (official rules & policies) — referenced as the participation rulebook; link when provided.

---

## 12. Data-model change checklist (SQL)

Apply to `supabase/migrations/` (new migration, don't edit 001 in place once live):

1. `profiles`: add `phone text`; extend `role` to allow `'commissioner'` (or add `city_commissioners` table).
2. `seasons`: drop/replace `quarter`; consider `season_index`; add `min_players`, `registration_closes_at`.
3. `scramble_tables`: relax/remove `week_number` cap; derive week from `table_date` if needed.
4. `table_seats`: add `seat_status` (`active | canceled_replaced | no_show`) to drive no-show scoring.
5. `score_submissions`: **remove** `status/approved_by/approved_at/admin_notes` (no approval). `score_submission_players`: add `jokerless boolean`, `self_drawn boolean` (or a bonus column) per game.
6. `standings`: add `average_score numeric`, `games_played integer`, `best_score integer`; rank by `average_score DESC, best_score DESC`.
7. `announcements`: drop (feature removed).
8. Seed **Hattiesburg only** (active) and the first series — **"The Mahjong Open — 2026 — Series One," Aug 17 – Oct 11**; other cities added later via the admin Cities page.

---

## 13. Suggested implementation order

> **Preview-first (do this BEFORE Supabase).** The client wants to *see* the changes in the mock portal before any backend is set up. Since the app runs entirely on mock data (`lib/data/mock.ts`), implement the **visual/structural** changes first — they need no backend and can be deployed for review immediately:
> 1. Global terminology (§1.5): "Scramble" → "Mahjong Game League", "Season" → "Series".
> 2. Hattiesburg-only active city (§2) + Series naming.
> 3. Remove Scramble Events tab (§3) and Announcements/Alerts (§10); add Member Directory + Add to Calendar (§9).
> 4. Marketing copy fixes (§3) — pricing, drop "one game per week" / "admin-approved" lines.
> 5. Standings *display* — average score + top-2-per-week using mock numbers (§6, UI only).
> Deploy to Vercel and review. **Then** move to the backend work below (data model, real scoring, payments, auth, emails) when wiring Supabase.

**Backend sequence (once Supabase is being set up):**

1. **Data model first** (§12) — everything else depends on it.
2. **Scoring engine** (§6) + remove approval (§7) — the highest-risk, highest-value logic.
3. **Unlimited-play tables** (§5) + portal tab changes (§10) + directory (§9).
4. **Marketing trim & copy** (§3) — remove Events, fix wrong model copy, wire real cities/price.
5. **Registration + payments + welcome email** (§4, §8).
6. **Commissioner role & per-city scoping** (§7) — needed before multi-city launch.
7. Drop in client-supplied copy (§11) as it arrives.

---

## 14. Open questions to confirm with the client

- "Top 2 scores for the week go into leaderboard" + "average based on all games" — confirm the leaderboard *shows* weekly top-2 while *ranking* uses season-long average. (Best guess encoded in §6.)
- Auto-renew membership: assumed **off**. Confirm.
- "Member directory" vs. "no public profiles": assumed **logged-in-only roster**. Confirm visibility.
- Waivers/terms at registration: client unsure — build as an optional, toggleable acceptance step.
- Whether `week_number` should be fully removed or retained purely for reporting.
- **Registration password / login method** — recommend **passwordless magic-link** (or "set password" via welcome email after payment); the password should **not** be on the initial register page. Confirm the client's preference before building auth in Stage 2.

---

## 15. Admin Console, Roles, Referrals & Ranking (Phase 2)

> This phase extends the app **beyond the preview-first batch**. Items tagged **[Preview now]** can be built with mock data and reviewed immediately. Items tagged **[Backend]** or **[Future]** need Supabase/Stripe (or multi-city data) to truly function — build the UI with clearly-labeled sample data where useful, and design the data model so the real version drops in later. **Do not fake functionality that could mislead** (e.g., a refund button that looks like it moves money).

### 15.1 Roles & access model
- Three roles: **Admin**, **Commissioner**, **Player**.
- **Admins — 4 co-equal accounts** (owner + 3 partners), all with identical full powers — there is **no single super-owner**. Extend `profiles.role` accordingly (and support multiple admin accounts). Admins can:
  - Add states & cities; create/manage commissioners.
  - See **all** analytics across every city.
  - Manage payment status — **player refunds** and **city-wide refunds** (when a city misses its minimum). **Refunds are admin-only.**
  - Export CSV; view **all** commissioner payout reports.
- **Commissioners — one per city, scoped to their own city.** Manage their city's players, tables, scores, standings, analytics, and their own payout report. **Cannot issue refunds.** Use a `city_commissioners` mapping (user ↔ city) or a city-scoped role.
- **Players** — the existing portal experience.

### 15.2 Admin console — distinct from the player portal  *(layout + analytics: [Preview now] with mock data)*
- Make it visibly its own space: lean into the existing dark "Admin view" header, brand it **"Admin Console,"** distinct layout from the player portal. Remove the old pending-score-approval widget (no approvals anymore).
- **Analytics dashboard:**
  - KPI cards: registrations (this series + all-time), active players, revenue this month, revenue this series, active cities, table fill rate.
  - Charts: signups over time, revenue by city, revenue by month, no-shows (use recharts or similar).
  - Financials: gross revenue (`$80 × paid registrations`), per-city breakdown, **commissioner payouts** (`commission % × that city's revenue`), net, refunds.
- **Management tools:** Cities & states (add/edit, assign commissioner) · Commissioners (create / assign city / set commission % / activate) · Series (dates, `$80` price, min players, open/close registration, active vs. complete) · Players (roster / search / payment status).
- **Admin-only:** refunds (player + city-wide), CSV export, commissioner **payout statements**, a simple audit trail.
- **[Backend]** Real numbers, refunds, and payouts require Supabase + Stripe; build the dashboard now with clearly-labeled sample data.

### 15.3 View-as-player toggle  *([Preview now])*
- Anyone who also plays (admins + commissioners) can toggle into their own **player portal view** and back — a simple mode switch in the console header.

### 15.4 Referrals — all roles  *(link + "your referrals" UI: [Preview now] · tracking: [Backend])*
- Unique **referral link** per account (admin, commissioner, player).
- Two referral types with **different (TBD) rewards:** **refer a player** (joins your city) vs. **refer a city** (brings on a new city / commissioner). Reward values are not decided yet — build the *capability*, not specific prizes.
- Per-user **"Your referrals"** view (your link + who you've referred + status). Admin view of **all** referrals to issue rewards.
- **[Backend]** Attribution (recording who referred whom at signup) and reward fulfillment need Supabase. Build the link + "Your referrals" UI with sample data now, and add a `referred_by` field (+ referral type) to the registration/profile model so real tracking drops in later.

### 15.5 Standings & ranking
- **[Preview now]** Weekly **top-finisher achievement badge** on the standings page (matches the client's chosen badge — "Top finisher"). Show with mock data.
- **[Future / cross-city]** Toggle on the standings page between **city standings** and **overall (cross-city) standings**.
- **[Future / cross-city]** City-vs-city competitions. Design the standings data model so a cross-city / national leaderboard is possible — don't hard-scope everything to a single city/series.

### 15.6 Portal home additions
- **[Future / cross-city]** Show the player's **city rank** and **overall rank** on the portal home (overall depends on the cross-city leaderboard; city rank can come earlier).
- **[Preview now]** A **"Mahjong Open Rulebook"** button on the portal home, linking to the handbook. The client is providing it soon — point to a placeholder now and swap in the real link/PDF on arrival. Ties to the Handbook item in §11.
