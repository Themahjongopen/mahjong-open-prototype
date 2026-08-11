-- ============================================================
-- THE MAHJONG OPEN — 029: let one commissioner lead more than one city
-- ============================================================
-- profiles.commissioner_city_id (migration 020) is a single nullable FK — one
-- city per profile. Promoting the same profile to a second city overwrote the
-- first. This replaces it with a many-to-many join table (mirrors the multi-city
-- PLAYER model from migration 019). The old column is intentionally KEPT (not
-- dropped) so this is reversible without a second migration; a later cleanup
-- migration can drop it once nothing reads/writes it.
--
-- ── directory_members deviation from the build-prompt SQL ────
-- The prompt's directory_members recreation was modeled on 020's shape and
-- omitted the is_founding_player column that migration 026 added (and that
-- app/portal/(shell)/directory + profile/[id] both .select()). Recreating the
-- view without it would break those pages exactly like the 027/028 avatar_url
-- regression. So is_founding_player is restored here (same EXISTS expression as
-- 026), alongside the is_commissioner change to commissioner_cities membership.
-- ============================================================

BEGIN;

-- 1) Many-to-many: one profile can lead more than one city.
CREATE TABLE IF NOT EXISTS public.commissioner_cities (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city_id    uuid NOT NULL REFERENCES public.cities(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, city_id)
);

-- 2) Backfill from the existing single-city column — every current commissioner
--    keeps exactly the one city they already lead, so this is a no-op for
--    today's data (verify with a query mirroring
--    scripts/verify_020_commissioner_city_safe.sql before applying).
INSERT INTO public.commissioner_cities (profile_id, city_id)
SELECT id, commissioner_city_id
FROM public.profiles
WHERE role = 'commissioner' AND commissioner_city_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3) directory_members — swap the single-column comparison for set membership.
--    Identical to 020/026's shape otherwise (roster CTE, show_in_directory
--    filter, visibility rule, grants, security_invoker=off all unchanged),
--    INCLUDING is_founding_player from migration 026.
DROP VIEW IF EXISTS public.directory_members;

CREATE VIEW public.directory_members
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
    p.avatar_url                AS avatar_url
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
    p.avatar_url                 AS avatar_url
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
  '(admins see all). Commissioner badge = membership in commissioner_cities for '
  'that row''s city (replaces the single commissioner_city_id column — a profile '
  'may now lead more than one city). Founding-player badge = any paid registration '
  'in a series flagged is_founding_series (migration 026). security_invoker=off by '
  'design; do not add private columns.';

REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;
REVOKE ALL ON public.commissioner_cities FROM anon, authenticated; -- service-role only, same as profiles

COMMIT;
