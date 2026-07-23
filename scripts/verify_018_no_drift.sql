-- ============================================================
-- Read-only verification for 018_admin_cross_city.sql
-- ============================================================
-- Run this in the Supabase SQL editor BEFORE applying 018. It is pure SELECT
-- — no CREATE, ALTER, or write of any kind — so it's safe to run against
-- production as-is.
--
-- It recomputes member_series_standings entirely inline under the NEW
-- (per-city regrouped + admin-UNION) logic from 018, then FULL OUTER JOINs
-- that against the CURRENT LIVE public.member_series_standings view (i.e.
-- today's actual on-disk view, pre-migration) and surfaces only the rows that
-- differ.
--
-- Expected result: 0 rows. Every regular player has rounds in exactly one
-- city (their own registration's city), so regrouping by city is a no-op for
-- them — old and new numbers should be byte-identical for every series/city
-- combination in the data, not just one hand-picked city. Any row this query
-- returns for a non-admin is a real problem; investigate before applying 018.
--
-- To restrict to one city/series while eyeballing (e.g. the city named in the
-- catch-up notes as having no admin scoring activity yet), add at the very
-- end:
--   AND COALESCE(old.city_id, new.city_id) = '<city-uuid>'
-- ============================================================

WITH new_scored AS (
  SELECT lt.series_id, lt.city_id, lt.week_number, ssp.user_id,
         ssp.round_score, ssp.is_no_show
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
),
new_top2 AS (
  SELECT series_id, city_id, user_id, week_number, SUM(round_score) AS weekly_top_2
  FROM (
    SELECT series_id, city_id, user_id, week_number, round_score,
           row_number() OVER (PARTITION BY series_id, city_id, user_id, week_number ORDER BY round_score DESC) AS rn
    FROM new_scored WHERE NOT is_no_show
  ) r
  WHERE rn <= 2
  GROUP BY series_id, city_id, user_id, week_number
),
new_pen AS (
  SELECT series_id, city_id, user_id, week_number, 25 * COUNT(*) AS no_show_penalty
  FROM new_scored WHERE is_no_show
  GROUP BY series_id, city_id, user_id, week_number
),
new_weeks AS (
  SELECT DISTINCT series_id, city_id, user_id, week_number FROM new_scored
),
new_weekly AS (
  SELECT w.series_id, w.city_id, w.user_id, w.week_number,
         COALESCE(t.weekly_top_2, 0) AS weekly_top_2,
         COALESCE(p.no_show_penalty, 0) AS no_show_penalty
  FROM new_weeks w
  LEFT JOIN new_top2 t USING (series_id, city_id, user_id, week_number)
  LEFT JOIN new_pen  p USING (series_id, city_id, user_id, week_number)
),
new_base AS (
  SELECT DISTINCT r.series_id, r.city_id, r.profile_id AS user_id, p.full_name, p.avatar_url,
         false AS is_admin_row
  FROM public.registrations r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.paid_status = 'paid' AND r.profile_id IS NOT NULL AND p.show_in_directory = true

  UNION

  SELECT DISTINCT lt.series_id, lt.city_id, ssp.user_id, p.full_name, p.avatar_url,
         true AS is_admin_row
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
  JOIN public.profiles p ON p.id = ssp.user_id AND p.role = 'admin'
),
new_played AS (
  SELECT lt.series_id, lt.city_id, ssp.user_id,
         COUNT(*) AS rounds_played,
         SUM(ssp.round_score) AS total_score
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
  WHERE NOT ssp.is_no_show AND NOT ssp.is_no_show_bonus
  GROUP BY lt.series_id, lt.city_id, ssp.user_id
),
new_cume AS (
  SELECT series_id, city_id, user_id,
         COALESCE(SUM(weekly_top_2) FILTER (WHERE rn <= 7), 0)
           - COALESCE(SUM(no_show_penalty), 0) AS cumulative_score
  FROM (
    SELECT series_id, city_id, user_id, weekly_top_2, no_show_penalty,
           row_number() OVER (PARTITION BY series_id, city_id, user_id ORDER BY weekly_top_2 DESC) AS rn
    FROM new_weekly
  ) w
  GROUP BY series_id, city_id, user_id
),
new_agg AS (
  SELECT b.series_id, b.city_id, b.user_id, b.full_name, b.avatar_url, b.is_admin_row,
         COALESCE(pl.rounds_played, 0) AS rounds_played,
         COALESCE(pl.total_score, 0) AS total_score,
         CASE WHEN COALESCE(pl.rounds_played, 0) > 0
              THEN round(pl.total_score::numeric / pl.rounds_played, 1) ELSE 0 END AS average_score,
         COALESCE(c.cumulative_score, 0) AS cumulative_score
  FROM new_base b
  LEFT JOIN new_played pl ON pl.series_id = b.series_id AND pl.city_id = b.city_id AND pl.user_id = b.user_id
  LEFT JOIN new_cume   c  ON c.series_id  = b.series_id AND c.city_id  = b.city_id AND c.user_id  = b.user_id
),
new_standings AS (
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
  FROM new_agg agg
)
SELECT
  COALESCE(old.series_id, new.series_id)      AS series_id,
  COALESCE(old.city_id, new.city_id)          AS city_id,
  COALESCE(old.user_id, new.user_id)          AS user_id,
  COALESCE(old.full_name, new.full_name)      AS full_name,
  CASE WHEN old.user_id IS NULL THEN 'NEW_ROW_ONLY_UNDER_018 -- expected ONLY for admins'
       WHEN new.user_id IS NULL THEN 'ROW_DISAPPEARED_UNDER_018 -- investigate!'
       ELSE 'FIELD_MISMATCH -- investigate!' END AS diff_type,
  new.is_admin_row,
  old.rounds_played    AS old_rounds_played,    new.rounds_played    AS new_rounds_played,
  old.total_score      AS old_total_score,      new.total_score      AS new_total_score,
  old.average_score    AS old_average_score,    new.average_score    AS new_average_score,
  old.cumulative_score AS old_cumulative_score, new.cumulative_score AS new_cumulative_score,
  old.cumulative_rank  AS old_cumulative_rank,  new.cumulative_rank  AS new_cumulative_rank,
  old.average_rank     AS old_average_rank,     new.average_rank     AS new_average_rank
FROM public.member_series_standings old
FULL OUTER JOIN new_standings new
  ON new.series_id = old.series_id AND new.city_id = old.city_id AND new.user_id = old.user_id
WHERE
  -- a true field mismatch on a row present both before and after
  (old.user_id IS NOT NULL AND new.user_id IS NOT NULL AND (
      old.rounds_played    IS DISTINCT FROM new.rounds_played
   OR old.total_score      IS DISTINCT FROM new.total_score
   OR old.average_score    IS DISTINCT FROM new.average_score
   OR old.cumulative_score IS DISTINCT FROM new.cumulative_score
   OR old.cumulative_rank  IS DISTINCT FROM new.cumulative_rank
   OR old.average_rank     IS DISTINCT FROM new.average_rank
  ))
  -- or a row that existed before and vanished under the new logic (should be impossible)
  OR (old.user_id IS NOT NULL AND new.user_id IS NULL)
  -- or a brand-new row that ISN'T an admin (should also be impossible — only
  -- admins gain new base rows under 018)
  OR (old.user_id IS NULL AND new.user_id IS NOT NULL AND new.is_admin_row = false)
ORDER BY diff_type, series_id, city_id, user_id;

-- ── How to read the result ──────────────────────────────────
-- 0 rows              -> clean. No drift for any regular player, in any city,
--                        under any series. 018's per-city regrouping is a
--                        confirmed no-op for existing data; safe to apply.
-- FIELD_MISMATCH      -> a regular player's numbers changed. STOP — do not
--                        apply 018 until this is understood.
-- ROW_DISAPPEARED     -> should be impossible (registrants can't vanish from
--                        `base`). STOP if this ever shows up.
-- NEW_ROW_ONLY, is_admin_row = false -> should also be impossible. STOP.
--
-- (This query deliberately filters OUT admin NEW_ROW_ONLY rows — an admin
-- gaining a standings row in a city they've scored in is the entire point of
-- 018, not a defect. If you want to eyeball those too, drop the
-- "is_admin_row = false" condition on the last OR clause.)
