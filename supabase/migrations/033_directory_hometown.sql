-- ============================================================
-- THE MAHJONG OPEN — 033: show hometown on the member directory
-- ============================================================
-- profiles.hometown (migration 031, already live) is the player-entered "where
-- you're actually from" field, distinct from the registered league city. It was
-- already surfaced to commissioners on their roster; this exposes it on the
-- player-facing directory too, so members in multi-county regions (East Alabama,
-- Rankin County, ...) can see a member's actual town, not just the region they
-- registered under.
--
-- This makes hometown visible to every paid member in the viewer's city+series
-- cohort (not just their commissioner) — an intentional widening of visibility,
-- the point of the ask.
--
-- ── Why CREATE OR REPLACE (not the DROP+CREATE migration 032 needed) ────
-- hometown is appended as the LAST column of both roster branches, so it lands
-- at the end of the view's output column list (the final SELECT is
-- `SELECT DISTINCT roster.*`). Postgres only forbids OR REPLACE when it would
-- reorder or remove an existing column, not when a new one is appended — so no
-- DROP is required, and no dependents to worry about (nothing SELECTs from this
-- view except the app, by column name). Body is otherwise byte-identical to 029.
-- ============================================================

BEGIN;

CREATE OR REPLACE VIEW public.directory_members
WITH (security_invoker = off) AS
WITH roster AS (
  SELECT
    p.id                      AS profile_id,
    p.full_name               AS full_name,
    reg.city_id                AS city_id,
    c.name                     AS city_name,
    p.skill_level              AS skill_level,
    EXISTS (
      SELECT 1 FROM public.commissioner_cities cc
      WHERE cc.profile_id = p.id AND cc.city_id = reg.city_id
    ) AS is_commissioner,
    EXISTS (
      SELECT 1
      FROM public.registrations fr
      JOIN public.series fs ON fs.id = fr.series_id
      WHERE fr.profile_id = p.id
        AND fr.paid_status = 'paid'
        AND fs.is_founding_series = true
    ) AS is_founding_player,
    reg.series_id               AS series_id,
    p.avatar_url                AS avatar_url,
    p.hometown                  AS hometown
  FROM public.registrations reg
  JOIN public.profiles p ON p.id = reg.profile_id
  JOIN public.cities   c ON c.id = reg.city_id
  WHERE reg.paid_status = 'paid'
    AND p.show_in_directory = true

  UNION

  SELECT DISTINCT
    p.id                      AS profile_id,
    p.full_name               AS full_name,
    lt.city_id                 AS city_id,
    c.name                     AS city_name,
    p.skill_level               AS skill_level,
    EXISTS (
      SELECT 1 FROM public.commissioner_cities cc
      WHERE cc.profile_id = p.id AND cc.city_id = lt.city_id
    ) AS is_commissioner,
    EXISTS (
      SELECT 1
      FROM public.registrations fr
      JOIN public.series fs ON fs.id = fr.series_id
      WHERE fr.profile_id = p.id
        AND fr.paid_status = 'paid'
        AND fs.is_founding_series = true
    ) AS is_founding_player,
    lt.series_id                AS series_id,
    p.avatar_url                 AS avatar_url,
    p.hometown                   AS hometown
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
  'Directory-safe member roster (name, city, hometown, skill, commissioner + '
  'founding-player badges), scoped to the authenticated viewer''s own paid '
  'city+series cohort (admins see all). Commissioner badge = membership in '
  'commissioner_cities for that row''s city. Founding-player badge = any paid '
  'registration in a series flagged is_founding_series (migration 026). hometown '
  '= profiles.hometown (migration 031), player-entered, distinct from city_name. '
  'security_invoker=off by design; do not add private columns.';

-- Re-affirm grants (CREATE OR REPLACE preserves them, but keep them explicit and
-- idempotent to match every prior directory_members migration).
REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

COMMIT;
