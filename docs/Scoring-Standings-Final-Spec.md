# Scoring & Standings — Final Locked Spec
_Sources: Shari's completed questionnaire (July 2026) + The Mahjong Open Handbook 2026 Edition + Jordan's clarifications July 17, 2026. All rules below are final and approved for the Phase 2 portal build._

---

## Terminology (use consistently throughout the portal)

| Term | Definition |
|---|---|
| **Game** | One individual game of American Mahjong within a round |
| **Round** | One official session: 4 registered members, 4 games. The unit tracked in the portal. |
| **Week** | A 7-day period; a player may play any number of rounds in a week |
| **Series** | An 8-week season |
| **Weekly score** | A player's top 2 round scores for a given week, summed |
| **Season total** | Sum of a player's best 7 weekly scores (the Cumulative Standing) |
| **Round average** | Total round score points across all rounds played ÷ rounds played (the Average Standing) |

---

## Two Leaderboards

The portal displays **two separate, simultaneous leaderboards**. Both are always visible on the standings page; both update in real time after each score submission. Two separate end-of-series prizes are awarded — one for each leaderboard.

### 1. Cumulative Standings ("Top Leader Score" prize)

**How it works:**
1. Each week: take the player's top 2 round scores → sum them → that's the weekly score.
2. At season end: take the player's best 7 of their 8 weekly scores and sum them → that's their Cumulative Standing.
3. Rank players highest to lowest by Cumulative Standing.

**Example:** Riley's weekly scores: 140, 120, 100, 90, 80, 150, 60, 110. Drop the 60. Season total = 790.

### 2. Average Standings ("Top Average Score" prize)

**How it works:**
1. Sum every round score the player has earned across the entire series (including rounds during the "drop week").
2. Divide by the total number of rounds played.
3. Rank players highest to lowest by this average.

**Display rule:** Shows **0** (not hidden) until the player has completed at least **5 rounds**. Even a 0-score round counts toward the 5. This prevents a player who plays 2 high-scoring rounds from jumping to the top of the average leaderboard.

**Example:** Riley plays 18 rounds total, scores 2,160 points. Average = 120.0.

---

## Score Entry (by Round Host)

The Round Host submits scores via the portal after each round. Entry is **one total score per player per round** — the sum of that player's NMJL card points across all 4 games in the round, plus any bonus points already applied.

### Bonus Points (applied at the table, included in the total the host enters)

| Bonus | Points | Notes |
|---|---|---|
| Self-Picked Mahjong | +10 | Awarded to the winner only when they draw their own winning tile |
| Jokerless Mahjong | +25 | Awarded to the winner only when their winning hand contains no jokers. **NOT awarded for Singles & Pairs hands.** |
| Wall Game | +10 | Awarded to **every player at the table** when no one declares Mahjong before the wall is exhausted |

> ⚠️ **Handbook correction needed:** The current Handbook 2026 Edition lists Jokerless as +20. The correct value is **+25**. Update the handbook and the Quick Reference Guide before publishing.

The portal does not need to break bonuses out separately — players calculate them at the table and the host enters the final total. The reference list above should appear in the score entry UI as a reminder.

---

## No-Show Workflow

### Normal cancellation (no penalty)

1. Player removes themselves from a round in the portal → their seat reopens automatically.
2. Any registered member may claim the open seat.
3. If the seat is filled before the round begins → the round plays normally with 4 players. **No penalty for the cancelling player. No bonus for the others.** The cancelling player simply isn't in this round.

The portal does not enforce *who* finds the replacement — the cancelling player is responsible per league etiquette, but the system only cares whether the seat is filled by game time.

### No-show (penalty applies)

A no-show occurs in any of these cases:
- Player cancels within 24 hours and no replacement fills the seat by game time.
- Player never cancels and simply doesn't appear.
- Player arrives more than 20 minutes after the scheduled start time.

**When the host submits scores, they mark the absent player as "no-show."** The system then:
- Applies **−25 points** to the no-show player's weekly score for that week.
- Applies **+25 points** to each of the 3 players who stayed.

The 3 remaining players' +25 entries are recorded as their score for that round (even if the round didn't officially play, since a 3-player game doesn't count for standings). The host submits the no-show record; the system handles the math.

If the round plays as a 3-player social game instead, it does **not** count toward any player's standings. Only 4-player official rounds count.

---

## No-Show Penalty Math — The Drop-Week Problem

**The rule:** A no-show penalty (−25) must follow the player even if the week it occurred in is their "drop week" (the worst weekly score that gets dropped from the season total).

**Implementation — store penalties separately:**

In the database, a player's weekly record has two distinct fields:
- `top_2_score` — the sum of their best 2 round scores for that week (0 if they played no rounds that week)
- `no_show_penalty` — 25 if they had a no-show that week, 0 otherwise

**Cumulative Standing formula:**
```
SUM(best 7 weekly top_2_scores) − SUM(ALL no_show_penalties across all 8 weeks)
```

The drop week excludes that week's `top_2_score` from the sum, but **all** `no_show_penalties` from all 8 weeks are always subtracted. The penalty is inescapable.

**Example:**
- Week 5: player no-shows. `top_2_score` = 0, `no_show_penalty` = 25. Weekly net = −25.
- Week 5 is their worst week and gets dropped.
- Cumulative = SUM(best 7 weekly `top_2_scores`) − 25 (the week 5 penalty still counts).

---

## 5-Round Minimum Details

- "5 rounds" = 5 individual round sittings (sessions), regardless of which weeks they fall in.
- A round where the player scored 0 still counts as one of the 5.
- A no-show does **not** count as a round played (the player wasn't there).
- Until 5 rounds are completed: Average Standing shows **0** on the leaderboard (player is visible, not hidden).
- Once 5 rounds are completed: the average calculates normally and updates after every subsequent round.

---

## End-of-Season Tiebreakers

### Cumulative Standings tie
If two players have the same season total:
1. **Higher Average Standing wins** (achieved the same total with a higher per-round average = more efficient).
2. If still tied: **higher total points across all rounds played** (more total scoring volume).

### Average Standings tie
If two players have the same per-round average:
1. **More rounds played wins** (maintained the same average over more rounds = more consistent).
2. If still tied: **higher total points across all rounds played**.

---

## End-of-Series Prizes

Two prizes only. Both are mahjong merchandise (tiles, racks, mat, etc.). Prize value scales with the number of players in the series and is revealed mid-series — players are told "Mahjong Merch" at registration; partners know the breakdown.

| Prize | Winner |
|---|---|
| Top Leader Score | Highest Cumulative Standing (best 7 weekly totals) |
| Top Average Score | Highest Average Standing (per-round average, min. 5 rounds) |

The portal does **not** need to display prize values. At season end, the two winners are surfaced on the standings page.

---

## Player Profile Page — Additions

The existing `/portal/profile/[id]` page spec should be extended to include the following stats sections (modeled on Shari's reference screenshot from another league portal):

### Editable fields
- Name
- Skill level (Beginner / Intermediate / Advanced)
- Notification preferences (requires a `notifications` settings column or table — lightweight addition)

### All-Time Stats (aggregate across every series the player has participated in)
- Rounds played
- Total score
- Average score

### Current Season Stats
- Rounds played
- Total score
- Average score
- Current Cumulative rank
- Current Average rank

All-time stats require a cross-series query (aggregate across all rounds regardless of `series_id`). Current season stats use the existing series-scoped standings data.

---

## Standings Page Layout

The standings page displays both leaderboards simultaneously. Suggested layout:

**Cumulative Standings** (primary / top of page)
Columns: Rank · Player Name · City · Season Total · Rounds Played

**Average Standings** (below, or second tab)
Columns: Rank · Player Name · City · Average · Rounds Played
Note: players under 5 rounds show "—" in Rank and "0" in Average, listed below ranked players.

Both tables update live after each host score submission.

---

## Copy Fixes Required (website)

The following pages currently describe standings inconsistently. All should be updated to reflect the two-leaderboard model and the correct scoring rules:

| Location | Current (wrong) | Fix to |
|---|---|---|
| `app/(marketing)/page.tsx:29` | "average score over the full series" | Reflect both Cumulative (best 7 weeks total) and Average (per-round average) |
| `app/(marketing)/page.tsx:94–95` | FAQ "How do standings work?" (visible + FAQPage JSON-LD) | Same — describe both leaderboards |
| `app/(marketing)/how-it-works/page.tsx:105` | "average score across all games played" | Same |
| Portal `app/portal/standings/page.tsx:78` | Phase 2 mock — will be replaced by real standings | Build per this spec |
| Handbook Quick Reference + Scoring section | Jokerless = +20 | Jokerless = **+25** |

How It Works Step 03 ("Sign up for your weekly table") also still uses the old weekly-table cadence framing — this is a separate copy fix awaiting Shari's sign-off on the "rounds vs. tables" terminology.

---

## Database Notes for Claude Code

The existing `league_tables` / scores schema (from migration 006) will need adjustments to support this spec. Key requirements:

- **Score entry unit:** one row per player per round (not per game). Store `round_score` (int) and `is_no_show` (bool).
- **Weekly aggregation:** compute on read (or via a view): group by `player_id` + ISO week → top 2 `round_score` values summed = `weekly_top_2`. Also sum `no_show_penalty` (25 × count of is_no_show rows) per week.
- **Cumulative Standing:** SUM of best 7 `weekly_top_2` values − SUM of ALL `no_show_penalty` values across all 8 weeks.
- **Average Standing:** SUM of all `round_score` values (where `is_no_show = false`) ÷ COUNT of rounds played (where `is_no_show = false`).
- **5-round gate:** COUNT of rows where `is_no_show = false` < 5 → show 0 for average, list below ranked players.
- **All-time stats on profile:** same queries without `series_id` filter.
- The `+25` bonus for players who stayed during a no-show: record as a special round entry (`is_no_show_bonus = true`) so it shows on the player's record but is excluded from Average Standing calculations (they didn't actually play a round).

---

## What Is NOT in Scope for This Build

- Tracking individual game scores within a round (the portal works at the round level).
- Enforcing who finds a replacement (etiquette rule, not a system rule).
- Prize amounts or percentage splits (TBD per series, revealed mid-series, not shown in the portal).
- Cross-city standings (each city is its own standing; no combined leaderboard).
- Weekly tiebreakers (explicitly not needed — only end-of-series tiebreakers above apply).