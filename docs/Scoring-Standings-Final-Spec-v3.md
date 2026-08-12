# Scoring & Standings — Final Locked Spec v3 (Champion Award redefined · Flight Winner added)
_Supersedes `docs/Scoring-Standings-Final-Spec-v2.md`. Source: Shari, Aug 11 2026 — a request to change how Champion Award is calculated and add a third individual prize, worked through against a real hand-drawn example ("Player A") to pin down exact mechanics rather than going by description alone. Ace Award and City-vs-City ("The Mahjong Open Leader") are unchanged from v2._

> **Why a v3 doc (not an edit in place):** v1 and v2 are kept as historical record. This file is the authoritative current reference.

> **Status: NOT yet built.** This spec is the reference; the code still implements v2. Implementation is blocked on the open tiebreaker item below.

---

## ⚠️ One open item — not yet confirmed
**Flight Winner has no confirmed tiebreaker.** Every other award has one (see the table below). Recommend defaulting to the same rule Champion Award and City-vs-City effectively use in spirit — but this has NOT been confirmed by Shari and should not be built until it is. Flag this explicitly before implementation.

---

## What changed from v2 (at a glance)

| v2 (retired) | v3 (current) |
|---|---|
| **Champion Award** — best-7-of-8 weekly *avg(lowest, highest)* values, minus penalties | **Champion Award** — ALL 8 weekly *highest-round* values, summed (no week dropped), minus penalties |
| — | **Flight Winner** — NEW. Total points ÷ total rounds across your best 7 of 8 weeks (one combined average, not an average of 8 separate weekly averages). 5-round series minimum to qualify. |
| Average score — informational only, no ranking | **Unchanged, still informational-only** — do not confuse with Flight Winner. `average_score` is your average across every round you've ever played, all 8 weeks, no drop, no ranking. Flight Winner is a *separate, ranked* number: your average across only your best 7 of 8 weeks. |
| Ace Award, City-vs-City | **Unchanged** — not part of this request. |

---

## Terminology (additions/changes from v2)

| Term | Definition |
|---|---|
| **Champion Award** *(redefined)* | Sum of a player's weekly-highest-round value across **all 8 weeks** (no week dropped), minus all no-show penalties |
| **Weekly Champion value** *(redefined)* | For one week: the player's single **highest** round score that week (was: average of lowest+highest) |
| **Flight Winner** *(new)* | Total points scored ÷ total rounds played, summed across the player's best 7 of 8 weeks (1 week excluded — see drop-week rule below) |
| **Drop week** *(new, Flight Winner only)* | The 1 of 8 weeks excluded from Flight Winner's calculation — see priority rule below. Does **not** apply to Champion Award, which now uses all 8 weeks. |

---

## Player Awards (three leaderboards now, per city + series)

### 1. Ace Award — unchanged from v2
Single highest individual round score across the series, no minimum, no tiebreaker (ties share rank).

### 2. Champion Award — redefined
**How it works:**
1. For each of the 8 weeks, take the player's single highest round score that week (0 if they didn't play).
2. Sum **all 8** — no week is dropped.
3. Subtract 25 points for every no-show anywhere in the series.

- No minimum rounds to qualify.
- **Tiebreaker:** higher total points across all rounds played (`total_score DESC`) — unchanged from v2.

**Worked example (Player A, confirmed against Shari's own numbers):** weekly highest-round values across 8 weeks: 80, 0, 75, 0, 100, 25, 45, 50 → sum = **375**. (No no-shows in this example, so 375 stands as-is.)

### 3. Flight Winner — new
**How it works:**
1. For each of the 8 weeks, compute two raw numbers: that week's **total points** (sum of round scores played that week) and that week's **rounds played**.
2. Identify the 1 "drop week" using the priority rule below.
3. Sum total points across the remaining 7 weeks. Sum rounds played across those same 7 weeks. Divide: `flight_winner_score = (sum of 7 weeks' points) / (sum of 7 weeks' rounds)`.

**Drop-week priority rule** (confirmed via the Player A example, where two weeks tied at 0 points):
- A week where the player **played rounds but scored 0 total** ranks **worse** than a week where they **didn't play at all** (true skip) — a true skip is relatively protected.
- Among weeks tied in the "played but scored 0" tier, drop whichever has **more rounds played**.
- A true skip week (0 rounds played) is only ever the drop week when it is uniquely the lowest — i.e., every other week scored above 0.
- (Consistency note, not a new rule: if a player has *more than one* true-skip week, only one is formally "the drop week," but the others don't distort the ratio anyway — a 0-points/0-rounds week contributes nothing to either the numerator or denominator.)

- **Minimum to qualify:** 5 total rounds played across the whole series (same series-wide gate the old retired Average Standing used) — below that, not ranked.
- Scoped per city, same as Ace and Champion Award.
- **Tiebreaker: not yet confirmed** — see the open item at the top of this doc.

**Worked example (Player A, using the confirmed drop-week rule):**

| Week | Points | Rounds | Note |
|---|---|---|---|
| 1 | 130 | 3 | |
| 2 | 0 | 3 | tied-lowest tier, more rounds → **DROP WEEK** |
| 3 | 125 | 3 | |
| 4 | 0 | 2 | tied-lowest tier, fewer rounds → kept |
| 5 | 130 | 3 | |
| 6 | 25 | 2 | |
| 7 | 90 | 3 | |
| 8 | 50 | 1 | |

Drop week 2. Remaining 7 weeks: points = 130+125+0+130+25+90+50 = 550; rounds = 3+3+2+3+2+3+1 = 17.
Flight Winner score = 550 ÷ 17 = **32.35** (not the 30.55 on the original worksheet — that number came from dropping week 4 instead, before the tiebreak rule was confirmed. 32.35 is the correct figure under the locked rule.)

---

## City-vs-City — "The Mahjong Open Leader" — unchanged from v2
No changes requested. Still: sum of the top 3 individual round scores city-wide, no floor, no tiebreaker (ties share rank).

---

## Informational stats — unchanged from v2, but now easy to confuse with Flight Winner
`rounds_played`, `total_score`, and `average_score` remain informational-only on the profile page, no minimum, no ranking. **`average_score` is NOT the same number as Flight Winner** — `average_score` is every round ever played, all 8 weeks, no drop; Flight Winner is a separate, ranked, best-7-of-8 number with a 5-round minimum. Worth being deliberate about how these are labeled next to each other on the profile page so a player doesn't see two different "average" numbers and assume they're the same stat.

---

## End-of-Series Tiebreakers (summary)

| Award | Rank order | Tiebreak |
|---|---|---|
| **Ace Award** | highest single round score | *none* — ties share a rank |
| **Champion Award** | highest sum of all 8 weekly-highest values (minus penalties) | higher `total_score` across all rounds played |
| **Flight Winner** | highest total-points-÷-total-rounds across best 7 of 8 weeks | **⚠️ NOT YET CONFIRMED** |
| **City-vs-City** | highest city score | *none* — ties share a rank |

---

## End-of-Series Prizes

| Prize | Winner |
|---|---|
| Ace Award | Highest single round score in the city (per city + series) |
| Champion Award | Highest sum of all 8 weekly-highest values, minus penalties (per city + series) |
| Flight Winner | Highest best-7-of-8 combined points-÷-rounds average (per city + series), 5-round minimum |
| The Mahjong Open Leader | City with the highest city score (per series, across all cities) |

That's 4 total distinct titles/leaderboards — 3 individual (Ace, Champion, Flight) + 1 city-level (Mahjong Open Leader), matching Shari's "3 prizes" (the city one isn't counted as a player prize).

---

## Database Notes for Claude Code (not yet built — sketch only)

This will need a new migration dropping/recreating `member_weekly_scores` and `member_series_standings` (same dependency-order pattern as migration 027). `city_series_standings` is untouched.

- **`member_weekly_scores`** changes:
  - `weekly_champion_value` formula changes from `round((MIN+MAX)/2.0, 1)` to `MAX(round_score)` — simpler, not more complex.
  - New per-week columns needed for Flight Winner: `weekly_total_score` (SUM of round_score that week, non-no-show) and `weekly_rounds_played` (COUNT of non-no-show rounds that week).
- **`member_series_standings`** changes:
  - `champion_award_score`: **drop the `rn <= 7` windowing entirely** — just `SUM(weekly_champion_value)` across all 8 weeks, minus `SUM(no_show_penalty)` across all 8 weeks. This is a simplification vs. today's code.
  - New `flight_winner_score`: needs the 3-tier drop-week priority described above, expressed as a composite sort key, e.g. (pseudocode): `tier = CASE WHEN weekly_rounds_played > 0 AND weekly_total_score = 0 THEN 0 WHEN weekly_rounds_played = 0 THEN 1 ELSE 2 END`, then `ORDER BY tier ASC, (CASE WHEN tier = 0 THEN weekly_rounds_played END) DESC, (CASE WHEN tier = 2 THEN weekly_total_score::numeric / NULLIF(weekly_rounds_played,0) END) ASC` — row 1 of that order is the drop week; sum points/rounds over the other 7.
  - New `flight_winner_rank`, gated on series-wide `rounds_played >= 5` (NULL rank below that, matching how the old Average Standing gate worked) — **rank order/tiebreak SQL can't be finalized until the open tiebreaker question above is answered.**
- **Read-side:** `flight_winner_score` will come back from PostgREST as a numeric string like the other computed scores — coerce with `Number(...)` before `.toFixed()`.

## Copy locations that will need updating once this is built
Same surfaces v2 touched, plus one new one:
- `app/(marketing)/page.tsx` — "Track your scores"/"Climb the standings" cards, "How do standings work?" FAQ, multi-city section.
- `app/(marketing)/how-it-works/page.tsx` — Step 06 body, scoring paragraph.
- Portal `app/portal/(shell)/standings/page.tsx` + admin `app/admin/standings/page.tsx` — now THREE leaderboards to show, not two.
- `app/portal/(shell)/profile/[id]/page.tsx` — season stat grid needs a third award (Flight Winner) added alongside Ace/Champion, and the `average_score` info-stat label should be reviewed so it doesn't read as a duplicate of Flight Winner (see the note above).
- **New:** the handbook "Scoring & Standings" page copy drafted earlier in this project needs a correction — the Champion Award paragraph drafted said "your best 7 of 8 weekly values are added together — your one lowest week is dropped," which was accurate under v2 but is now wrong under v3 (no week is dropped for Champion Award anymore). A new Flight Winner paragraph also needs to be added to that page. Happy to redraft both once this spec is confirmed.

## Still NOT in Scope (carried over from v2)
- Tracking individual game scores within a round.
- Enforcing who finds a replacement (etiquette, not a system rule).
- Prize amounts or percentage splits.
- Weekly tiebreakers (only end-of-series tiebreakers apply) — **and Flight Winner's own end-of-series tiebreaker is still open, see top of doc.**
