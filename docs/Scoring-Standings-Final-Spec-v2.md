# Scoring & Standings — Final Locked Spec v2 (Ace Award · Champion Award · City-vs-City)
_Supersedes `docs/Scoring-Standings-Final-Spec.md`. Sources: Shari + Jordan, Aug 2026 — a legal/wording requirement forced a change to the two headline award names and formulas, and added a city-vs-city competition. All rules below are final and approved. Series One had not started scoring when this landed (the score tables were empty), so the swap carried no live data to reconcile._

> **Why a v2 doc (not an edit in place):** the original spec is kept as a historical record. This file is the authoritative current reference.

---

## What changed from v1 (at a glance)

| v1 (retired) | v2 (current) |
|---|---|
| **Top Leader Score** — best-7-of-8 weekly *top-2-summed* totals, minus penalties | **Champion Award** — best-7-of-8 weekly *avg(lowest, highest)* values, minus penalties |
| **Top Average Score** — per-round average, min. 5 rounds, ranked | *Retired as a ranked leaderboard.* Average score survives only as an informational profile stat (no minimum, no ranking) |
| — | **Ace Award** — NEW. A player's single highest round score all series |
| "No combined leaderboard; each city its own standing" (explicitly out of scope) | **City-vs-City** — NEW, and a **direct reversal** of that scope line (see below) |

> ⚠️ **Scope reversal, called out explicitly:** v1's *"What Is NOT in Scope"* section stated **"Cross-city standings (each city is its own standing; no combined leaderboard)."** v2 **reverses** that decision — a cross-city competition ("The Mahjong Open Leader") is now in scope and built. This is a genuine feature addition, not a rename; flagged here so it is never mistaken for a smaller change.

---

## Terminology (use consistently throughout the portal)

| Term | Definition |
|---|---|
| **Game** | One individual game of American Mahjong within a round |
| **Round** | One official session: 4 registered members, 4 games. The unit tracked in the portal. |
| **Week** | A 7-day period; a player may play any number of rounds in a week |
| **Series** | An 8-week season |
| **Ace Award** | A player's single highest individual round score across the entire series |
| **Champion Award** | Sum of a player's best 7 of 8 *weekly Champion values*, minus all no-show penalties |
| **Weekly Champion value** | For one week: the average of that player's lowest and highest round score that week — `(min + max) / 2` |
| **City score** | The sum of the top 3 individual round scores recorded by anyone registered in that city, that series |
| **The Mahjong Open Leader** | Title/recognition awarded to the city with the highest city score (`city_rank = 1`) |

---

## Player Awards (two leaderboards, per city + series)

The portal displays **two separate, simultaneous player leaderboards**, both scoped to a single city within a series (a multi-city player has a separate standing in each city they register in). Both update live after each score submission.

### 1. Ace Award

**How it works:** take every round score the player recorded this series (excluding no-shows) and keep the single highest one. That's their Ace Award score.

- **No minimum rounds** to qualify — one played round is enough.
- **No tiebreaker at all** — players with the same Ace Award score **share the same rank number** (a standard SQL `rank()`, so ties produce e.g. two `#1`s and the next player is `#3`).

**Example:** Riley's round scores this series: 60, 145, 90, 110, 132. Ace Award = **145**.

### 2. Champion Award

**How it works:**
1. For each week the player played, compute the **weekly Champion value** = `round((lowest round score that week + highest round score that week) / 2, 1)`. (Over non-no-show rows; stay-bonus `+25` rows are included, exactly as the old Cumulative weekly value included them.)
2. Take the player's **best 7 of their 8** weekly Champion values and sum them (the worst week — or a missed week, valued 0 — is dropped).
3. Subtract **all** no-show penalties (`25 × no-show rows`) across **all 8** weeks — a penalty in a dropped week still counts (inescapable), identical to the retired Top Leader Score.

- **No minimum rounds** to qualify.
- **Tiebreaker:** the player with the **higher total points across all rounds played** wins the tie (`champion_award_score DESC, total_score DESC`).
- Champion Award scores can be **fractional** (they are built from `avg(min, max)` values), e.g. `790.5`. Display with one decimal.

**Example:** A player's 8 weekly Champion values: 140, 120, 100, 90, 80, 150, 60, 110. Drop the 60. Sum of best 7 = **790**. No penalties → Champion Award = 790.0. (If a week had, say, a lone round of 131 → weekly value `(131+131)/2 = 131.0`, and fractions flow through to a `.5` total.)

**Engineering note:** Champion Award reuses the *exact* weekly-bucketing / best-7-of-8 / penalties-across-all-8-weeks machinery the old Top Leader Score used. Only the per-week value changed: `SUM(top 2 round scores)` → `avg(min round, max round)`.

---

## City-vs-City — "The Mahjong Open Leader"

A brand-new, series-wide competition across cities.

**How a city's score is computed:**
- Look at **every individual round score** recorded by anyone registered in that city for the series (excluding no-shows).
- Take the **top 3 single round scores** — literally the 3 highest `round_score` rows city-wide, **even if the same player produced more than one of them** (this is *not* top-3-players'-totals).
- Sum those 3 values = the **city score**.

- **No floor / minimum** to qualify.
- **No tiebreaker specified** — cities with the same score share a rank.
- **Live-updating** on the standings page (not reveal-gated — Shari deferred to "whatever is easiest," and live requires no extra reveal-state plumbing).
- The city with `city_rank = 1` is crowned **The Mahjong Open Leader** (title/badge of recognition).

**Example:** In Gulf Coast this series, the three highest single round scores anyone posted are 152, 149 (same player), and 144. City score = **445**.

---

## Informational stats (no longer ranked)

`rounds_played`, `total_score`, and `average_score` remain on the profile page as raw informational numbers. They are **no longer** tied to any minimum or ranking:
- The old **5-round gate** is gone. It existed only to protect the retired Average Standing's ranking fairness; nothing plays that role now, so `average_score` is shown directly even below 5 rounds.
- `rounds_played` / `total_score` still count only real played rounds (neither a no-show nor a stay-bonus).

---

## End-of-Series Tiebreakers (summary)

| Award | Rank order | Tiebreak |
|---|---|---|
| **Ace Award** | highest single round score | *none* — ties share a rank |
| **Champion Award** | highest best-7-of-8 total (minus penalties) | higher `total_score` across all rounds played |
| **City-vs-City** | highest city score (sum of top 3 city-wide round scores) | *none* — ties share a rank |

---

## End-of-Series Prizes

| Prize | Winner |
|---|---|
| Ace Award | Highest single round score in the city (per city + series) |
| Champion Award | Highest best-7-of-8 weekly avg(min,max), minus penalties (per city + series) |
| The Mahjong Open Leader | City with the highest city score (per series, across all cities) |

Prize values are not shown in the portal (unchanged from v1).

---

## Database Notes for Claude Code

Implemented in migration `027_ace_champion_awards.sql`, which **drops and recreates** the migration 013 views (a plain `CREATE OR REPLACE VIEW` cannot rename existing view columns, so the two 013 views are dropped in dependency order first). All three views are **computed on read** and **service-role only** (`security_invoker = off`; `anon` + `authenticated` revoked) — the app reads them server-side and filters by cohort.

- **`member_weekly_scores`** — per (series, city, user, week): `weekly_champion_value = round((MIN(round_score) + MAX(round_score)) / 2, 1)` over non-no-show rows, plus `no_show_penalty = 25 × no-show rows`.
- **`member_series_standings`** — per (series, city, user): `ace_award_score = MAX(round_score)` (non-no-show); `champion_award_score = SUM(best 7 weekly_champion_value) − SUM(all no_show_penalty)`; plus informational `rounds_played` / `total_score` / `average_score`. Ranks are partitioned by `(series_id, city_id)`:
  - `ace_award_rank = rank() OVER (ORDER BY ace_award_score DESC)` — no tiebreak.
  - `champion_award_rank = rank() OVER (ORDER BY champion_award_score DESC, total_score DESC)`.
- **`city_series_standings`** — per (series, city): `city_score = SUM` of the top-3 `round_score` rows city-wide (non-no-show), `city_rank = rank() OVER (PARTITION BY series_id ORDER BY city_score DESC)`. Every city with ≥1 paid registration appears (0 if unscored).

**Read-side note:** `champion_award_score`, `average_score`, and `city_score` are `numeric` and come back from PostgREST as strings — coerce with `Number(...)` before calling `.toFixed()` (as the standings lib/API mappers do).

---

## Copy locations updated for v2

- `app/(marketing)/page.tsx` — "Track your scores" card, "Climb the standings" card, and the "How do standings work?" FAQ (which also feeds the FAQPage JSON-LD via `FAQS.map`), plus the multi-city section.
- `app/(marketing)/how-it-works/page.tsx` — Step 06 body and the "How the leaderboard works" scoring paragraph.
- Portal `app/portal/(shell)/standings/page.tsx` + admin `app/admin/standings/page.tsx` — both leaderboard labels + the new City Leaderboard section.
- `app/portal/(shell)/profile/[id]/page.tsx` — season stat grid (Ace Award / Champion Award + ranks).

---

## Still NOT in Scope (carried over from v1, minus the reversed line)

- Tracking individual game scores within a round (portal works at the round level).
- Enforcing who finds a replacement (etiquette, not a system rule).
- Prize amounts or percentage splits (revealed mid-series, not shown in the portal).
- Weekly tiebreakers (only end-of-series tiebreakers apply).

_(The v1 line "Cross-city standings … no combined leaderboard" is **removed from this list** — it is now in scope and built as City-vs-City above.)_
