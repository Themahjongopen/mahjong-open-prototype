-- ============================================================
-- THE MAHJONG OPEN — Flight Winner: drop the worst week only at 8 weeks
-- ============================================================
-- Bug (present since Flight Winner was introduced in migration 030, carried
-- unchanged through 032): the `flight` CTE filtered `WHERE drop_priority > 1`
-- UNCONDITIONALLY, so it always discarded a player's single worst week no matter
-- how many weeks they had played. A player with 1 week had their only week
-- dropped -> flight_points/flight_rounds NULL -> the COALESCE guard fell to ELSE 0
-- -> flight_winner_score = 0. With the whole league at Week 1, every player read
-- 0.00, and the rank (all tied at 0) fell through to the rounds_played tiebreaker.
--
-- Client rule: drop the worst week ONLY once a player has all 8 weeks. Before
-- that, average every week they've played (1 week -> that week; 4 weeks -> all 4;
-- 8 weeks -> best 7).
--
-- Fix: two clauses change, nothing else.
--   1. weekly_priority CTE gains `count(*) OVER (PARTITION BY series_id, city_id,
--      user_id) AS week_count` — how many weekly rows the player has.
--   2. flight CTE's filter `WHERE drop_priority > 1` becomes
--      `WHERE week_count <= 7 OR drop_priority > 1` — keep every week at 7 or
--      fewer; at 8 drop exactly the worst (drop_priority = 1).
--
-- Per CLAUDE.md (# Database & migrations -> ## View rewrites), this definition was
-- diffed clause by clause against migration 032. CARRIED FORWARD BYTE-IDENTICAL:
-- the view header + security_invoker=off; the base, scored, played, ace, and
-- champion CTEs; the weekly_priority row_number()/3-tier ORDER BY drop ranking;
-- the agg CTE incl. skill_level and all of average_score/ace/champion; every
-- output column and the ace/champion/flight rank() windows incl. the 5-round gate
-- and the rounds_played->total_score tiebreakers; the REVOKE. CHANGED: only the
-- two flight clauses above. NOT touched: member_weekly_scores, city_series_standings.
--
-- Columns and their order are identical to 032 (the change is inside CTEs only),
-- so CREATE OR REPLACE is valid — no drop, no dependent-object risk.
-- ============================================================

BEGIN;

CREATE OR REPLACE VIEW public.member_series_standings
WITH (security_invoker = off) AS
WITH base AS (
  SELECT DISTINCT r.series_id, r.city_id, r.profile_id AS user_id, p.full_name, p.skill_level, p.avatar_url
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
-- ratio). drop_priority = 1 is the single worst week; week_count is how many
-- weeks the player has, so the flight CTE can drop it ONLY at 8 weeks.
weekly_priority AS (
  SELECT series_id, city_id, user_id, week_number, weekly_total_score, weekly_rounds_played,
         count(*) OVER (
           PARTITION BY series_id, city_id, user_id
         ) AS week_count,
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
  -- Keep every week at 7 or fewer; at 8 drop exactly the worst (drop_priority=1).
  SELECT series_id, city_id, user_id,
         SUM(weekly_total_score) AS flight_points,
         SUM(weekly_rounds_played) AS flight_rounds
  FROM weekly_priority
  WHERE week_count <= 7 OR drop_priority > 1
  GROUP BY series_id, city_id, user_id
),
agg AS (
  SELECT b.series_id, b.city_id, b.user_id, b.full_name, b.skill_level, b.avatar_url,
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

REVOKE ALL ON public.member_series_standings FROM anon, authenticated;

COMMENT ON VIEW public.member_series_standings IS
  'Per series+city standings, v3 (migration 030) + skill_level (032) + Flight Winner conditional drop (034): Ace Award (highest single round_score, no minimum, no tiebreaker), Champion Award (sum of ALL 8 weekly-highest-round values minus no-show penalties, tiebreak = total_score), and Flight Winner (combined points/rounds ratio; the single worst week is dropped ONLY once a player has all 8 weeks — at 7 or fewer weeks every week counts; 5-round series-wide minimum, tiebreak = rounds_played then total_score) — all scoped per city. Carries full_name, skill_level, avatar_url for display. Computed on read; service-role only.';

COMMIT;
