-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: standings (computed views)
-- ============================================================
-- PROPOSAL — review before applying.
--
-- The two leaderboards, computed ON READ per the locked spec (they "update live
-- after each host score submission" — so no cached table, no recalc triggers).
-- Retires the placeholder `standings` table from migration 006.
--
-- Scope: standings are per SERIES + CITY ("each city is its own standing; no
-- combined leaderboard"). Week bucket = league_tables.week_number (1–8).
-- Voided submissions are excluded everywhere.
--
-- Read path: the portal standings page + profileStats read these via the
-- service-role client and filter to the viewer's city+series (same pattern as
-- tables/scores). The views are therefore locked to service-role — anon and
-- authenticated are revoked.
--
-- ── Row model recap (migration 011) ─────────────────────────
--   round_score       player's total for the round
--   is_no_show=true   absent — 0 score, drives a −25 weekly penalty, NOT a
--                     played round
--   is_no_show_bonus  +25 for a player who stayed in a short-handed round —
--                     counts toward the weekly (Cumulative) total but is NOT a
--                     played round (excluded from averages)
--
-- ── Cumulative ("Top Leader Score") ─────────────────────────
--   weekly_top_2   = sum of a player's best 2 round_scores that week
--                    (over is_no_show=false rows, i.e. normal + stay-bonus)
--   no_show_penalty= 25 × (is_no_show rows that week)
--   cumulative     = SUM(best 7 of 8 weekly_top_2) − SUM(ALL weekly penalties)
--                    penalties are subtracted across ALL weeks, so a penalty in
--                    a dropped week still counts (inescapable).
--
-- ── Average ("Top Average Score") ───────────────────────────
--   played rounds  = rows where NOT is_no_show AND NOT is_no_show_bonus
--   average        = SUM(round_score over played) / COUNT(played)
--   5-round gate   = <5 played → average shows 0 and is UNRANKED (listed below)
--
-- ── Ranks + end-of-series tiebreakers ───────────────────────
--   cumulative_rank: cumulative DESC, then average DESC, then total_score DESC
--   average_rank   : (only ≥5 rounds) average DESC, then rounds DESC, then total
--
-- All paid members of the series appear (even with 0 rounds), so the roster is
-- complete; 0-round players sort to the bottom with average_rank NULL.
-- ============================================================

BEGIN;

-- Retire the unused placeholder table (empty; only profileStats read its rank,
-- and that switches to member_series_standings in the same change).
DROP TABLE IF EXISTS public.standings CASCADE;

-- ── Per-week aggregates ─────────────────────────────────────
CREATE OR REPLACE VIEW public.member_weekly_scores
WITH (security_invoker = off) AS
WITH scored AS (
  SELECT lt.series_id, lt.city_id, lt.week_number, ssp.user_id,
         ssp.round_score, ssp.is_no_show
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
),
top2 AS (
  SELECT series_id, user_id, week_number, SUM(round_score) AS weekly_top_2
  FROM (
    SELECT series_id, user_id, week_number, round_score,
           row_number() OVER (PARTITION BY series_id, user_id, week_number ORDER BY round_score DESC) AS rn
    FROM scored WHERE NOT is_no_show
  ) r
  WHERE rn <= 2
  GROUP BY series_id, user_id, week_number
),
pen AS (
  SELECT series_id, user_id, week_number, 25 * COUNT(*) AS no_show_penalty
  FROM scored WHERE is_no_show
  GROUP BY series_id, user_id, week_number
),
weeks AS (
  SELECT DISTINCT series_id, city_id, user_id, week_number FROM scored
)
SELECT w.series_id, w.city_id, w.user_id, w.week_number,
       COALESCE(t.weekly_top_2, 0) AS weekly_top_2,
       COALESCE(p.no_show_penalty, 0) AS no_show_penalty
FROM weeks w
LEFT JOIN top2 t USING (series_id, user_id, week_number)
LEFT JOIN pen  p USING (series_id, user_id, week_number);

-- ── Series standings (both leaderboards + ranks) ────────────
CREATE OR REPLACE VIEW public.member_series_standings
WITH (security_invoker = off) AS
WITH base AS (   -- every paid member of a series, with their city + name
  SELECT DISTINCT r.series_id, r.city_id, r.profile_id AS user_id, p.full_name
  FROM public.registrations r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.paid_status = 'paid' AND r.profile_id IS NOT NULL
),
played AS (      -- played-round totals (exclude no-show + stay-bonus)
  SELECT lt.series_id, ssp.user_id,
         COUNT(*) AS rounds_played,
         SUM(ssp.round_score) AS total_score
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
  WHERE NOT ssp.is_no_show AND NOT ssp.is_no_show_bonus
  GROUP BY lt.series_id, ssp.user_id
),
cume AS (        -- best-7-of-8 weekly totals minus all penalties
  SELECT series_id, user_id,
         COALESCE(SUM(weekly_top_2) FILTER (WHERE rn <= 7), 0)
           - COALESCE(SUM(no_show_penalty), 0) AS cumulative_score
  FROM (
    SELECT series_id, user_id, weekly_top_2, no_show_penalty,
           row_number() OVER (PARTITION BY series_id, user_id ORDER BY weekly_top_2 DESC) AS rn
    FROM public.member_weekly_scores
  ) w
  GROUP BY series_id, user_id
),
agg AS (
  SELECT b.series_id, b.city_id, b.user_id, b.full_name,
         COALESCE(pl.rounds_played, 0) AS rounds_played,
         COALESCE(pl.total_score, 0) AS total_score,
         CASE WHEN COALESCE(pl.rounds_played, 0) > 0
              THEN round(pl.total_score::numeric / pl.rounds_played, 1) ELSE 0 END AS average_score,
         COALESCE(c.cumulative_score, 0) AS cumulative_score
  FROM base b
  LEFT JOIN played pl ON pl.series_id = b.series_id AND pl.user_id = b.user_id
  LEFT JOIN cume   c  ON c.series_id  = b.series_id AND c.user_id  = b.user_id
)
SELECT agg.*,
  rank() OVER (
    PARTITION BY series_id, city_id
    ORDER BY cumulative_score DESC, average_score DESC, total_score DESC
  ) AS cumulative_rank,
  CASE WHEN rounds_played >= 5 THEN
    rank() OVER (
      PARTITION BY series_id, city_id
      ORDER BY (rounds_played >= 5) DESC, average_score DESC, rounds_played DESC, total_score DESC
    )
  ELSE NULL END AS average_rank
FROM agg;

-- Service-role only (the portal reads these server-side and filters by cohort).
REVOKE ALL ON public.member_weekly_scores FROM anon, authenticated;
REVOKE ALL ON public.member_series_standings FROM anon, authenticated;

COMMENT ON VIEW public.member_series_standings IS
  'Per series+city standings: cumulative (best-7-of-8 weekly top-2 minus all no-show penalties) and average (min 5 rounds), with ranks + tiebreakers. Computed on read; service-role only.';

COMMIT;
