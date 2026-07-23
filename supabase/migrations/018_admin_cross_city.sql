-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: admin cross-city standings + directory
-- ============================================================
-- PROPOSAL — review before applying. SQL-only: the companion app-layer work
-- (lib/portal/adminCity.ts admin-city context, POST /api/portal/admin-city,
-- AdminCitySwitcher in the app bar; tables/standings/directory/profile/
-- my-stats resolving the admin's active city) ships separately once this is
-- reviewed and applied — do not ship the app code before this lands.
--
-- Why: admins have no city_id of their own (the Tables page already
-- special-cases this — see AdminCityPicker / getOpenTables' override param).
-- member_series_standings and directory_members, however, still compute as if
-- a series had one combined roster across all its cities. That was harmless
-- only because no admin had ever scored a round or held a directory seat. An
-- admin who travels to score/participate in a second city would incorrectly
-- get pooled into a single series-wide bucket instead of ranking per city.
-- This migration makes both views genuinely per-city.
--
-- ── Per-city regrouping (the integrity fix) ─────────────────
-- member_weekly_scores: top2/pen grouping gains city_id —
--   (series_id, user_id, week_number) → (series_id, city_id, user_id, week_number).
--   Output columns unchanged.
-- member_series_standings: played + cume CTEs group by (series_id, city_id,
--   user_id); agg joins base <-> played <-> cume on city too. Ranks are
--   already PARTITION BY (series_id, city_id), so the rank *logic* itself
--   doesn't change — only what rolls up into each partition's inputs.
--
-- NO-OP FOR REGULAR PLAYERS: every registrant has rounds in exactly one city
-- (their own registration's city), so per-city grouping produces
-- byte-identical rounds_played/total_score/average_score/cumulative_score/
-- ranks for them. The only rows this can newly affect are admins. Run
-- scripts/verify_018_no_drift.sql BEFORE applying this migration to confirm
-- that with real production data.
--
-- ── Admin activity UNION (the new coverage) ─────────────────
-- member_series_standings.base: UNION admin activity — non-voided score rows
--   for a profile with role='admin' — so an admin ranks per city they've
--   ACTUALLY SCORED in. Admins have no paid registration, so there's no
--   double-count; an admin simply doesn't appear on a city's board until
--   they've scored there.
-- directory_members: restructured into a `roster` CTE — paid registrants
--   (show_in_directory-filtered) UNION admins with an ACTIVE SEAT
--   (table_seats.canceled_at IS NULL) at a table in that city/series — then
--   the existing visibility rule (is_admin() OR viewer paid in that
--   city+series) applied ONCE in the outer WHERE, instead of duplicated per
--   UNION branch. show_in_directory stays a registrant-only opt-out; it does
--   not gate admin rows.
--
--   NOTE on the two different admin criteria (deliberate — flagging for your
--   review, not hiding it): standings require the admin to have SCORED
--   (score_submission_players), because that's literally what the
--   leaderboard measures. Directory requires only an ACTIVE SEAT
--   (table_seats), because the directory is a "who's around" roster rather
--   than a scoring leaderboard — an admin who joined a table but hasn't had a
--   round scored yet should still show as present in that city. If you'd
--   rather these two match exactly (e.g. both score-based, or both
--   seat-based), say so and I'll align them before you apply this.
--
-- All grants and security_invoker=off semantics are unchanged from 013/017.
-- ============================================================

BEGIN;

-- ── 1) member_weekly_scores — per-city regrouping ───────────
-- Column set is unchanged from 013, so CREATE OR REPLACE is safe here (no
-- 42P16 — that only bites when the output column list/types change).
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
  SELECT series_id, city_id, user_id, week_number, SUM(round_score) AS weekly_top_2
  FROM (
    SELECT series_id, city_id, user_id, week_number, round_score,
           row_number() OVER (PARTITION BY series_id, city_id, user_id, week_number ORDER BY round_score DESC) AS rn
    FROM scored WHERE NOT is_no_show
  ) r
  WHERE rn <= 2
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
       COALESCE(t.weekly_top_2, 0) AS weekly_top_2,
       COALESCE(p.no_show_penalty, 0) AS no_show_penalty
FROM weeks w
LEFT JOIN top2 t USING (series_id, city_id, user_id, week_number)
LEFT JOIN pen  p USING (series_id, city_id, user_id, week_number);

-- ── 2) member_series_standings — per-city regrouping + admin UNION ──
-- Output column set is unchanged from 016/017 (series_id, city_id, user_id,
-- full_name, avatar_url, rounds_played, total_score, average_score,
-- cumulative_score, cumulative_rank, average_rank), but DROP ... CASCADE +
-- CREATE is used anyway to match the established 016 pattern for this view
-- (it depends on member_weekly_scores above; safer to rebuild it fresh than
-- rely on CREATE OR REPLACE across a CTE restructure this size). Re-grants
-- after, same as 016/017.
DROP VIEW IF EXISTS public.member_series_standings CASCADE;

CREATE VIEW public.member_series_standings
WITH (security_invoker = off) AS
WITH base AS (   -- every paid, directory-visible registrant (in their own city)
                 -- UNION admins who've scored in a city, so they rank THERE
  SELECT DISTINCT r.series_id, r.city_id, r.profile_id AS user_id, p.full_name, p.avatar_url
  FROM public.registrations r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.paid_status = 'paid' AND r.profile_id IS NOT NULL AND p.show_in_directory = true

  UNION

  SELECT DISTINCT lt.series_id, lt.city_id, ssp.user_id, p.full_name, p.avatar_url
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
  JOIN public.profiles p ON p.id = ssp.user_id AND p.role = 'admin'
),
played AS (      -- played-round totals (exclude no-show + stay-bonus), per city
  SELECT lt.series_id, lt.city_id, ssp.user_id,
         COUNT(*) AS rounds_played,
         SUM(ssp.round_score) AS total_score
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
  WHERE NOT ssp.is_no_show AND NOT ssp.is_no_show_bonus
  GROUP BY lt.series_id, lt.city_id, ssp.user_id
),
cume AS (        -- best-7-of-8 weekly totals minus all penalties, per city
  SELECT series_id, city_id, user_id,
         COALESCE(SUM(weekly_top_2) FILTER (WHERE rn <= 7), 0)
           - COALESCE(SUM(no_show_penalty), 0) AS cumulative_score
  FROM (
    SELECT series_id, city_id, user_id, weekly_top_2, no_show_penalty,
           row_number() OVER (PARTITION BY series_id, city_id, user_id ORDER BY weekly_top_2 DESC) AS rn
    FROM public.member_weekly_scores
  ) w
  GROUP BY series_id, city_id, user_id
),
agg AS (
  SELECT b.series_id, b.city_id, b.user_id, b.full_name, b.avatar_url,
         COALESCE(pl.rounds_played, 0) AS rounds_played,
         COALESCE(pl.total_score, 0) AS total_score,
         CASE WHEN COALESCE(pl.rounds_played, 0) > 0
              THEN round(pl.total_score::numeric / pl.rounds_played, 1) ELSE 0 END AS average_score,
         COALESCE(c.cumulative_score, 0) AS cumulative_score
  FROM base b
  LEFT JOIN played pl ON pl.series_id = b.series_id AND pl.city_id = b.city_id AND pl.user_id = b.user_id
  LEFT JOIN cume   c  ON c.series_id  = b.series_id AND c.city_id  = b.city_id AND c.user_id  = b.user_id
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
  'Per series+city standings: cumulative (best-7-of-8 weekly top-2 minus all no-show penalties) and average (min 5 rounds), with ranks + tiebreakers. Roster is paid, directory-visible registrants UNION admins who have scored in that city. Computed on read; service-role only.';

-- ── 3) directory_members — roster restructure ───────────────
-- registrants (show_in_directory-filtered) UNION admins with an active seat,
-- visibility rule applied once in the outer WHERE instead of per-branch.
DROP VIEW IF EXISTS public.directory_members;

CREATE VIEW public.directory_members
WITH (security_invoker = off) AS
WITH roster AS (
  SELECT
    p.id                      AS profile_id,
    p.full_name               AS full_name,
    reg.city_id               AS city_id,
    c.name                    AS city_name,
    p.skill_level             AS skill_level,
    (p.role = 'commissioner' OR p.is_commissioner = true) AS is_commissioner,
    reg.series_id             AS series_id,
    p.avatar_url              AS avatar_url
  FROM public.registrations reg
  JOIN public.profiles p ON p.id = reg.profile_id
  JOIN public.cities   c ON c.id = reg.city_id
  WHERE reg.paid_status = 'paid'
    AND p.show_in_directory = true

  UNION

  SELECT DISTINCT
    p.id                      AS profile_id,
    p.full_name               AS full_name,
    lt.city_id                AS city_id,
    c.name                    AS city_name,
    p.skill_level             AS skill_level,
    (p.role = 'commissioner' OR p.is_commissioner = true) AS is_commissioner,
    lt.series_id              AS series_id,
    p.avatar_url              AS avatar_url
  FROM public.table_seats ts
  JOIN public.league_tables lt ON lt.id = ts.table_id
  JOIN public.profiles p ON p.id = ts.user_id AND p.role = 'admin'
  JOIN public.cities c ON c.id = lt.city_id
  WHERE ts.canceled_at IS NULL
)
SELECT DISTINCT roster.*
FROM roster
WHERE
  public.is_admin()
  OR EXISTS (
    SELECT 1
    FROM public.registrations viewer
    WHERE viewer.profile_id = auth.uid()
      AND viewer.paid_status = 'paid'
      AND viewer.city_id   = roster.city_id
      AND viewer.series_id = roster.series_id
  );

COMMENT ON VIEW public.directory_members IS
  'Directory-safe member roster (name, city, skill, commissioner badge), scoped '
  'to the authenticated viewer''s own paid city+series cohort (admins see all). '
  'Roster = paid, show_in_directory registrants UNION admins with an active '
  '(non-canceled) seat at a table in that city/series. '
  'security_invoker=off by design; do not add private columns.';

REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

COMMIT;
