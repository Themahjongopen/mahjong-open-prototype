-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: hide-from-directory toggle
-- ============================================================
-- Adds a per-member `show_in_directory` flag (default true) and threads it
-- through the two member-facing views so a member who opts out disappears from
-- BOTH the portal directory and the standings leaderboards.
--
-- Only the filter is added — the view bodies are otherwise identical to their
-- originals (009_directory_members_view.sql / 013_standings_views.sql), so
-- columns, scoping, grants, and security_invoker=off semantics are preserved.
-- ============================================================

BEGIN;

-- 1) New opt-out flag on profiles (visible by default).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_in_directory boolean NOT NULL DEFAULT true;

-- 2) Recreate directory_members with the show_in_directory filter.
--    (Same DROP+CREATE+grant pattern as 009; DROP wipes grants so we re-grant.)
DROP VIEW IF EXISTS public.directory_members;

CREATE VIEW public.directory_members
WITH (security_invoker = off) AS
SELECT DISTINCT
  p.id                      AS profile_id,
  p.full_name               AS full_name,
  reg.city_id               AS city_id,
  c.name                    AS city_name,
  reg.skill_level           AS skill_level,
  (p.role = 'commissioner') AS is_commissioner,
  reg.series_id             AS series_id
FROM public.registrations reg
JOIN public.profiles p ON p.id = reg.profile_id
JOIN public.cities   c ON c.id = reg.city_id
WHERE reg.paid_status = 'paid'
  AND p.show_in_directory = true
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.registrations viewer
      WHERE viewer.profile_id = auth.uid()
        AND viewer.paid_status = 'paid'
        AND viewer.city_id   = reg.city_id
        AND viewer.series_id = reg.series_id
    )
  );

COMMENT ON VIEW public.directory_members IS
  'Directory-safe member roster (name, city, skill, commissioner badge), scoped '
  'to the authenticated viewer''s own paid city+series cohort (admins see all), '
  'excluding members who opted out via show_in_directory. '
  'security_invoker=off by design; do not add private columns.';

REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

-- 3) Recreate member_series_standings with the show_in_directory filter.
--    Only the `base` CTE changes (adds AND p.show_in_directory = true); every
--    other CTE, column, rank, and tiebreaker is unchanged. Depends on the
--    unchanged member_weekly_scores view. CREATE OR REPLACE preserves grants,
--    but we re-REVOKE for parity with 013.
CREATE OR REPLACE VIEW public.member_series_standings
WITH (security_invoker = off) AS
WITH base AS (   -- every paid, directory-visible member of a series, with their city + name
  SELECT DISTINCT r.series_id, r.city_id, r.profile_id AS user_id, p.full_name
  FROM public.registrations r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.paid_status = 'paid' AND r.profile_id IS NOT NULL AND p.show_in_directory = true
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

REVOKE ALL ON public.member_series_standings FROM anon, authenticated;

COMMENT ON VIEW public.member_series_standings IS
  'Per series+city standings: cumulative (best-7-of-8 weekly top-2 minus all no-show penalties) and average (min 5 rounds), with ranks + tiebreakers. Excludes members who opted out via show_in_directory. Computed on read; service-role only.';

COMMIT;
