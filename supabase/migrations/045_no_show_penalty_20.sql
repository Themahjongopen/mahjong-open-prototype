-- ============================================================
-- THE MAHJONG OPEN — 045: no-show penalty −25 -> −20
-- ============================================================
-- Client rules change (Shari, Aug 20): the no-show weekly penalty drops from 25
-- to 20, and the +25 stay bonus drops to 0 (the bonus change is in app code —
-- NO_SHOW_STAY_BONUS = 0 — not here). The penalty is derived on read in
-- member_weekly_scores.pen and subtracted by member_series_standings.champion, so
-- this single literal change applies to every already-recorded no-show
-- immediately, no data backfill for the penalty. (The stored +25 bonus rows ARE
-- backfilled separately, out of band, after commissioner notifications.)
--
-- Per CLAUDE.md (# Database & migrations -> ## View rewrites), this definition was
-- diffed clause by clause against the prior definition (migration 030 — the last
-- to define member_weekly_scores; 032 and 041 did NOT touch it).
--   CHANGED:  pen CTE literal  `25 * COUNT(*)` -> `20 * COUNT(*)`, and the two
--             now-stale comments that described the bonus as "+25" (the bonus is
--             now 0; the rows still exist, flagged is_no_show_bonus).
--   CARRIED FORWARD BYTE-IDENTICAL: the view header + security_invoker=off; the
--             scored, champion_week, flight_week, and weeks CTEs (every filter
--             — champion_week `WHERE NOT is_no_show`; flight_week `WHERE NOT
--             is_no_show AND NOT is_no_show_bonus` — is keyed on the FLAGS, not the
--             value, so the −20 change alters no exclusion); the final SELECT,
--             COALESCEs, column list/order, and the three LEFT JOINs; the REVOKE.
-- Columns are unchanged, so CREATE OR REPLACE is valid — no drop, and the
-- dependent views (member_series_standings, city_series_standings) resolve it at
-- query time and need no recreation. NOT touched: member_series_standings,
-- city_series_standings.
-- ============================================================

BEGIN;

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
  -- Weekly Champion value = single highest round that week. Pool excludes
  -- no-shows only, so a stay-bonus row is still in the pool — but as of the −20/0
  -- change it is 0, so it can no longer inflate a player's weekly best (a 0 only
  -- wins the week when it is their sole round, contributing 0 either way).
  SELECT series_id, city_id, user_id, week_number,
         MAX(round_score) AS weekly_champion_value
  FROM scored WHERE NOT is_no_show
  GROUP BY series_id, city_id, user_id, week_number
),
pen AS (
  SELECT series_id, city_id, user_id, week_number, 20 * COUNT(*) AS no_show_penalty
  FROM scored WHERE is_no_show
  GROUP BY series_id, city_id, user_id, week_number
),
flight_week AS (
  -- Flight Winner inputs: strictly "rounds played" (excludes no-shows AND the
  -- stay-bonus rows, now 0), matching the app's existing rounds_played/total_score
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

REVOKE ALL ON public.member_weekly_scores FROM anon, authenticated;

COMMIT;
