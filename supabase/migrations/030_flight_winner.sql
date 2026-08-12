-- ============================================================
-- THE MAHJONG OPEN — Scoring v3: Champion Award redefined, Flight Winner added
-- ============================================================
-- Implements docs/Scoring-Standings-Final-Spec-v3.md (locked 2026-08-12, incl.
-- confirmed Flight Winner tiebreaker: most rounds played, then higher total_score).
-- Supersedes migration 027's champion_award_score formula and windowing.
-- Ace Award and city_series_standings ("The Mahjong Open Leader") are unchanged
-- — city_series_standings is recreated verbatim only because it must be
-- dropped/recreated in dependency order.
--
-- Design note (not explicitly in the spec, resolved against existing codebase
-- convention): weekly_champion_value's source pool is UNCHANGED from migration
-- 027 — rows where NOT is_no_show (this includes the +25 is_no_show_bonus
-- "stayed short-handed" rows as eligible for the weekly-highest calculation,
-- same as v2). Flight Winner's weekly_total_score / weekly_rounds_played use a
-- STRICTER filter — NOT is_no_show AND NOT is_no_show_bonus — matching the
-- app's existing "rounds played" definition used everywhere else (profileStats.ts,
-- the `played` CTE below, and the 5-round Flight Winner minimum itself, which is
-- the same rounds_played field). Flag/confirm if this asymmetry is unwanted.
--
-- APPLY NOTE (deviation from the build-prompt SQL): the pasted migration omitted
-- avatar_url from member_series_standings' base/agg CTEs — modeled on migration
-- 027's shape, which predates 028's restore of that column. Both standings pages
-- .select(...avatar_url...) for the <Avatar>, so recreating the view without it
-- would 400 and blank every board (the exact 027 -> 028 regression). avatar_url
-- is restored here (p.avatar_url in base, b.avatar_url in agg), same as 028.
-- ============================================================

BEGIN;

DROP VIEW IF EXISTS public.city_series_standings;
DROP VIEW IF EXISTS public.member_series_standings;
DROP VIEW IF EXISTS public.member_weekly_scores;

-- ── 1) Per-week aggregates — city-scoped throughout ──
CREATE OR REPLACE VIEW public.member_weekly_scores
WITH (security_invoker = off) AS
WITH scored AS (
  SELECT lt.series_id, lt.city_id, lt.week_number, ssp.user_id,
         ssp.round_score, ssp.is_no_show, ssp.is_no_show_bonus
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
),
champion_week AS (
  -- Weekly Champion value = single highest round that week (v3: was avg(min,max)
  -- in v2). Pool unchanged from v2: excludes no-shows only, so a stay-bonus row
  -- can still be a player's "highest" for the week.
  SELECT series_id, city_id, user_id, week_number,
         MAX(round_score) AS weekly_champion_value
  FROM scored WHERE NOT is_no_show
  GROUP BY series_id, city_id, user_id, week_number
),
pen AS (
  SELECT series_id, city_id, user_id, week_number, 25 * COUNT(*) AS no_show_penalty
  FROM scored WHERE is_no_show
  GROUP BY series_id, city_id, user_id, week_number
),
flight_week AS (
  -- Flight Winner inputs: strictly "rounds played" (excludes no-shows AND the
  -- +25 stay-bonus rows), matching the app's existing rounds_played/total_score
  -- definition used for the 5-round minimum gate.
  SELECT series_id, city_id, user_id, week_number,
         SUM(round_score) AS weekly_total_score,
         COUNT(*) AS weekly_rounds_played
  FROM scored WHERE NOT is_no_show AND NOT is_no_show_bonus
  GROUP BY series_id, city_id, user_id, week_number
),
weeks AS (
  SELECT DISTINCT series_id, city_id, user_id, week_number FROM scored
)
SELECT w.series_id, w.city_id, w.user_id, w.week_number,
       COALESCE(c.weekly_champion_value, 0) AS weekly_champion_value,
       COALESCE(p.no_show_penalty, 0) AS no_show_penalty,
       COALESCE(f.weekly_total_score, 0) AS weekly_total_score,
       COALESCE(f.weekly_rounds_played, 0) AS weekly_rounds_played
FROM weeks w
LEFT JOIN champion_week c USING (series_id, city_id, user_id, week_number)
LEFT JOIN pen           p USING (series_id, city_id, user_id, week_number)
LEFT JOIN flight_week   f USING (series_id, city_id, user_id, week_number);

-- ── 2) Series standings — Ace + Champion + Flight Winner, city-scoped ──
CREATE OR REPLACE VIEW public.member_series_standings
WITH (security_invoker = off) AS
WITH base AS (
  SELECT DISTINCT r.series_id, r.city_id, r.profile_id AS user_id, p.full_name, p.avatar_url
  FROM public.registrations r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.paid_status = 'paid' AND r.profile_id IS NOT NULL
),
scored AS (
  SELECT lt.series_id, lt.city_id, ssp.user_id, ssp.round_score, ssp.is_no_show
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
),
played AS (
  SELECT lt.series_id, lt.city_id, ssp.user_id,
         COUNT(*) AS rounds_played,
         SUM(ssp.round_score) AS total_score
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
  WHERE NOT ssp.is_no_show AND NOT ssp.is_no_show_bonus
  GROUP BY lt.series_id, lt.city_id, ssp.user_id
),
ace AS (
  SELECT series_id, city_id, user_id, MAX(round_score) AS ace_award_score
  FROM scored WHERE NOT is_no_show
  GROUP BY series_id, city_id, user_id
),
champion AS (
  -- v3: sum ALL weeks (no rn <= 7 windowing) minus all no-show penalties.
  SELECT series_id, city_id, user_id,
         COALESCE(SUM(weekly_champion_value), 0) - COALESCE(SUM(no_show_penalty), 0) AS champion_award_score
  FROM public.member_weekly_scores
  GROUP BY series_id, city_id, user_id
),
-- Flight Winner: rank each user's weeks worst-to-best by the 3-tier drop
-- priority (tier 0 = played-for-nothing, worse the more rounds; tier 1 = true
-- skip, protected; tier 2 = normal week, worse the lower the points/rounds
-- ratio). drop_priority = 1 is the single dropped week; sum the rest.
weekly_priority AS (
  SELECT series_id, city_id, user_id, week_number, weekly_total_score, weekly_rounds_played,
         row_number() OVER (
           PARTITION BY series_id, city_id, user_id
           ORDER BY
             CASE
               WHEN weekly_rounds_played > 0 AND weekly_total_score = 0 THEN 0
               WHEN weekly_rounds_played = 0 THEN 1
               ELSE 2
             END ASC,
             CASE WHEN weekly_rounds_played > 0 AND weekly_total_score = 0
                  THEN weekly_rounds_played END DESC,
             CASE WHEN weekly_rounds_played > 0 AND weekly_total_score > 0
                  THEN weekly_total_score::numeric / weekly_rounds_played END ASC
         ) AS drop_priority
  FROM public.member_weekly_scores
),
flight AS (
  SELECT series_id, city_id, user_id,
         SUM(weekly_total_score) AS flight_points,
         SUM(weekly_rounds_played) AS flight_rounds
  FROM weekly_priority
  WHERE drop_priority > 1
  GROUP BY series_id, city_id, user_id
),
agg AS (
  SELECT b.series_id, b.city_id, b.user_id, b.full_name, b.avatar_url,
         COALESCE(pl.rounds_played, 0) AS rounds_played,
         COALESCE(pl.total_score, 0) AS total_score,
         CASE WHEN COALESCE(pl.rounds_played, 0) > 0
              THEN round(pl.total_score::numeric / pl.rounds_played, 1) ELSE 0 END AS average_score,
         COALESCE(a.ace_award_score, 0) AS ace_award_score,
         COALESCE(c.champion_award_score, 0) AS champion_award_score,
         CASE WHEN COALESCE(fl.flight_rounds, 0) > 0
              THEN round(fl.flight_points::numeric / fl.flight_rounds, 2) ELSE 0 END AS flight_winner_score
  FROM base b
  LEFT JOIN played   pl ON pl.series_id = b.series_id AND pl.city_id = b.city_id AND pl.user_id = b.user_id
  LEFT JOIN ace       a ON a.series_id  = b.series_id AND a.city_id  = b.city_id AND a.user_id  = b.user_id
  LEFT JOIN champion  c ON c.series_id  = b.series_id AND c.city_id  = b.city_id AND c.user_id  = b.user_id
  LEFT JOIN flight   fl ON fl.series_id = b.series_id AND fl.city_id = b.city_id AND fl.user_id = b.user_id
)
SELECT agg.*,
  rank() OVER (
    PARTITION BY series_id, city_id
    ORDER BY ace_award_score DESC
  ) AS ace_award_rank,
  rank() OVER (
    PARTITION BY series_id, city_id
    ORDER BY champion_award_score DESC, total_score DESC
  ) AS champion_award_rank,
  -- Flight Winner: 5-round series-wide minimum to qualify (same rounds_played
  -- field as the gate). Non-qualifying rows are pushed out of the ranking
  -- window via NULLS LAST, then the CASE blanks their displayed rank entirely.
  -- Tiebreak (confirmed 2026-08-12): most rounds played, then higher total_score.
  CASE WHEN rounds_played >= 5 THEN
    rank() OVER (
      PARTITION BY series_id, city_id
      ORDER BY
        (CASE WHEN rounds_played >= 5 THEN flight_winner_score END) DESC NULLS LAST,
        (CASE WHEN rounds_played >= 5 THEN rounds_played END) DESC NULLS LAST,
        (CASE WHEN rounds_played >= 5 THEN total_score END) DESC NULLS LAST
    )
  END AS flight_winner_rank
FROM agg;

-- ── 3) City-vs-city — unchanged, already correctly scoped ──
CREATE OR REPLACE VIEW public.city_series_standings
WITH (security_invoker = off) AS
WITH roster AS (
  SELECT DISTINCT r.series_id, r.city_id, c.name AS city_name
  FROM public.registrations r
  JOIN public.cities c ON c.id = r.city_id
  WHERE r.paid_status = 'paid'
),
scored AS (
  SELECT lt.series_id, lt.city_id, ssp.round_score, ssp.is_no_show
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
),
top3 AS (
  SELECT series_id, city_id, SUM(round_score) AS city_score
  FROM (
    SELECT series_id, city_id, round_score,
           row_number() OVER (PARTITION BY series_id, city_id ORDER BY round_score DESC) AS rn
    FROM scored WHERE NOT is_no_show
  ) r
  WHERE rn <= 3
  GROUP BY series_id, city_id
)
SELECT roster.series_id, roster.city_id, roster.city_name,
       COALESCE(top3.city_score, 0) AS city_score,
       rank() OVER (
         PARTITION BY roster.series_id
         ORDER BY COALESCE(top3.city_score, 0) DESC
       ) AS city_rank
FROM roster
LEFT JOIN top3 ON top3.series_id = roster.series_id AND top3.city_id = roster.city_id;

REVOKE ALL ON public.member_weekly_scores    FROM anon, authenticated;
REVOKE ALL ON public.member_series_standings FROM anon, authenticated;
REVOKE ALL ON public.city_series_standings   FROM anon, authenticated;

COMMENT ON VIEW public.member_series_standings IS
  'Per series+city standings, v3: Ace Award (highest single round_score, no minimum, no tiebreaker), Champion Award (sum of ALL 8 weekly-highest-round values minus no-show penalties, tiebreak = total_score), and Flight Winner (best-7-of-8 combined points/rounds ratio via 3-tier drop-week rule, 5-round series-wide minimum, tiebreak = rounds_played then total_score) — all scoped per city, so a multi-city player gets independent numbers in each city they are registered in. Includes avatar_url (restored, migration 028). Computed on read; service-role only.';

COMMIT;
