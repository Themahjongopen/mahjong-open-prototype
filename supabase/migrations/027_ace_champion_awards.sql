-- ============================================================
-- THE MAHJONG OPEN — Ace Award, Champion Award & City-vs-City
-- ============================================================
-- Scoped per city throughout — champion_week/pen/ace/champion are all keyed by
-- (series_id, city_id, user_id, ...), fixing a bug where a multi-city player
-- scoring in two cities the same week got that week's value double-counted.
-- city_series_standings is unchanged — already correctly scoped.
--
-- Series One has not started scoring — score_submission_players is empty for
-- the real series, so this is still a clean apply, no data reconciliation.
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
         ssp.round_score, ssp.is_no_show
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
),
champion_week AS (
  SELECT series_id, city_id, user_id, week_number,
         round((MIN(round_score) + MAX(round_score)) / 2.0, 1) AS weekly_champion_value
  FROM scored WHERE NOT is_no_show
  GROUP BY series_id, city_id, user_id, week_number
),
pen AS (
  SELECT series_id, city_id, user_id, week_number, 25 * COUNT(*) AS no_show_penalty
  FROM scored WHERE is_no_show
  GROUP BY series_id, city_id, user_id, week_number
),
weeks AS (
  SELECT DISTINCT series_id, city_id, user_id, week_number FROM scored
)
SELECT w.series_id, w.city_id, w.user_id, w.week_number,
       COALESCE(c.weekly_champion_value, 0) AS weekly_champion_value,
       COALESCE(p.no_show_penalty, 0) AS no_show_penalty
FROM weeks w
LEFT JOIN champion_week c USING (series_id, city_id, user_id, week_number)
LEFT JOIN pen           p USING (series_id, city_id, user_id, week_number);

-- ── 2) Series standings — Ace Award + Champion Award, city-scoped ──
CREATE OR REPLACE VIEW public.member_series_standings
WITH (security_invoker = off) AS
WITH base AS (
  SELECT DISTINCT r.series_id, r.city_id, r.profile_id AS user_id, p.full_name
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
  SELECT series_id, city_id, user_id,
         COALESCE(SUM(weekly_champion_value) FILTER (WHERE rn <= 7), 0)
           - COALESCE(SUM(no_show_penalty), 0) AS champion_award_score
  FROM (
    SELECT series_id, city_id, user_id, weekly_champion_value, no_show_penalty,
           row_number() OVER (PARTITION BY series_id, city_id, user_id ORDER BY weekly_champion_value DESC) AS rn
    FROM public.member_weekly_scores
  ) w
  GROUP BY series_id, city_id, user_id
),
agg AS (
  SELECT b.series_id, b.city_id, b.user_id, b.full_name,
         COALESCE(pl.rounds_played, 0) AS rounds_played,
         COALESCE(pl.total_score, 0) AS total_score,
         CASE WHEN COALESCE(pl.rounds_played, 0) > 0
              THEN round(pl.total_score::numeric / pl.rounds_played, 1) ELSE 0 END AS average_score,
         COALESCE(a.ace_award_score, 0) AS ace_award_score,
         COALESCE(c.champion_award_score, 0) AS champion_award_score
  FROM base b
  LEFT JOIN played   pl ON pl.series_id = b.series_id AND pl.city_id = b.city_id AND pl.user_id = b.user_id
  LEFT JOIN ace       a ON a.series_id  = b.series_id AND a.city_id  = b.city_id AND a.user_id  = b.user_id
  LEFT JOIN champion  c ON c.series_id  = b.series_id AND c.city_id  = b.city_id AND c.user_id  = b.user_id
)
SELECT agg.*,
  rank() OVER (
    PARTITION BY series_id, city_id
    ORDER BY ace_award_score DESC
  ) AS ace_award_rank,
  rank() OVER (
    PARTITION BY series_id, city_id
    ORDER BY champion_award_score DESC, total_score DESC
  ) AS champion_award_rank
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
  'Per series+city standings: Ace Award (highest single round_score, no minimum, no tiebreaker) and Champion Award (best-7-of-8 weekly avg(min,max) minus all no-show penalties, tiebreak = total_score) — all scoped per city, so a multi-city player gets independent numbers in each city they are registered in. Computed on read; service-role only.';

COMMENT ON VIEW public.city_series_standings IS
  'Per-series city competition: city_score = sum of the top 3 individual round_score values recorded by anyone registered in that city. No floor. Winning city (city_rank = 1) is "The Mahjong Open Leader". Computed on read; service-role only.';

COMMIT;
