-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: Founding Player badge
-- ============================================================
-- Why: recognize anyone who registered (and paid) for Series One, the
-- league's launch season. Computed live from registrations + series, NOT
-- backfilled onto profiles — no re-run risk, always reflects current data.
--
-- ── 1) series.is_founding_series ─────────────────────────────
-- Marks the ONE series that counts as "founding." Defaults false for every
-- future series (Series Two and beyond never need this touched again).
--
-- ── 2) Backfill: flag the existing Series One row ────────────
-- Scoped by name match (safe today — there's exactly one series row and its
-- name is "The Mahjong Open — 2026 — Series One" per migration 003). If this
-- returns 0 rows when applied, STOP and set the flag manually by id instead
-- of guessing further — do not loosen the match.
--
-- ── 3) directory_members — add is_founding_player ────────────
-- Recreated identically to 020 PLUS one new computed column:
-- is_founding_player = EXISTS a paid registration for this profile in any
-- series where is_founding_series = true. Profile-level (not scoped to the
-- row's own city/series), matching the "carries the badge everywhere going
-- forward" intent — a founding player stays a founding player in Series Two
-- and beyond, and even in a directory row for a different city if they
-- register elsewhere later. Added to BOTH branches of the roster UNION.
--
-- Reversible: to roll back, recreate directory_members from 020,
-- ALTER TABLE public.series DROP COLUMN is_founding_series.
-- ============================================================

BEGIN;

-- 1) Founding-series flag.
ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS is_founding_series boolean NOT NULL DEFAULT false;

-- 2) Flag the existing Series One row.
UPDATE public.series
SET is_founding_series = true
WHERE name ILIKE '%Series One%'
  AND is_founding_series = false;

-- 3) Recreate directory_members; adds is_founding_player, everything else unchanged from 020.
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
    (reg.city_id = p.commissioner_city_id
      AND (p.role = 'commissioner' OR p.is_commissioner = true)) AS is_commissioner,
    EXISTS (
      SELECT 1
      FROM public.registrations fr
      JOIN public.series fs ON fs.id = fr.series_id
      WHERE fr.profile_id = p.id
        AND fr.paid_status = 'paid'
        AND fs.is_founding_series = true
    )                          AS is_founding_player,
    reg.series_id             AS series_id,
    p.avatar_url               AS avatar_url
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
    (lt.city_id = p.commissioner_city_id
      AND (p.role = 'commissioner' OR p.is_commissioner = true)) AS is_commissioner,
    EXISTS (
      SELECT 1
      FROM public.registrations fr
      JOIN public.series fs ON fs.id = fr.series_id
      WHERE fr.profile_id = p.id
        AND fr.paid_status = 'paid'
        AND fs.is_founding_series = true
    )                          AS is_founding_player,
    lt.series_id              AS series_id,
    p.avatar_url               AS avatar_url
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
  'Directory-safe member roster (name, city, skill, commissioner + founding-player '
  'badges), scoped to the authenticated viewer''s own paid city+series cohort '
  '(admins see all). Roster = paid, show_in_directory registrants UNION admins '
  'with an active (non-canceled) seat at a table in that city/series. '
  'Commissioner badge shows only in the profile''s commissioner_city_id. '
  'Founding-player badge = any paid registration in a series flagged '
  'is_founding_series (profile-level, not city/series-scoped). '
  'security_invoker=off by design; do not add private columns.';

REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

COMMIT;
