-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: per-city commissioner designation
-- ============================================================
-- PROPOSAL — review before applying. SQL-only; the companion app-layer work
-- (PUT /api/admin/players requiring an explicit cityId + writing
-- profiles.commissioner_city_id, and the admin players page city picker) ships
-- with this change on the same branch — apply this migration first.
--
-- Why: a commissioner is the commissioner OF A CITY, but that link was never
-- stored. The PUT handler guessed the city from the target's most-recent paid
-- registration (ORDER BY created_at DESC LIMIT 1). Harmless while every player
-- had exactly one registration; migration 019 now lets a player register in
-- multiple cities, so the guess could silently promote/demote the wrong city's
-- commissioner. This adds an explicit commissioner_city_id and makes the
-- directory badge honor it.
--
-- ── 1) profiles.commissioner_city_id (nullable FK) ──────────
-- Nullable: only commissioners carry a value; NULL means "not a commissioner of
-- any city" (all non-commissioners, and the default for new profiles). ON
-- DELETE defaults to NO ACTION — a city with a commissioner can't be hard
-- deleted anyway (cities are deactivated, not deleted; see /api/admin/cities).
--
-- ── 2) Backfill existing commissioners ─────────────────────
-- Set commissioner_city_id from each current commissioner's single paid
-- registration. SAFE + DETERMINISTIC today because no commissioner has more than
-- one paid registration (confirm with scripts/verify_020_commissioner_city_safe.sql
-- BEFORE applying — check 1 must return 0 rows). For a single-city commissioner
-- this reproduces exactly what the old LIMIT 1 guess resolved to, so the badge
-- they show today is unchanged.
--
-- ── 3) directory_members — city-scope the commissioner badge ─
-- Recreated identically to 018 EXCEPT the is_commissioner output column, which
-- now also requires the roster row's city to match the profile's
-- commissioner_city_id, in BOTH the registrant branch (reg.city_id) and the
-- admin-seat branch (lt.city_id). Everything else — columns, roster CTE,
-- show_in_directory filter, visibility rule, grants, security_invoker=off — is
-- unchanged from 018. NO-OP for current data: every commissioner has one city,
-- so the badge still shows in exactly that city.
--
-- Reversible: to roll back, recreate directory_members from 018 and
-- ALTER TABLE public.profiles DROP COLUMN commissioner_city_id.
-- ============================================================

BEGIN;

-- 1) Which city this profile is the commissioner of (NULL = none).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commissioner_city_id uuid REFERENCES public.cities(id);

-- 2) Backfill current commissioners from their single paid registration.
UPDATE public.profiles p
SET commissioner_city_id = r.city_id
FROM public.registrations r
WHERE p.role = 'commissioner'
  AND p.commissioner_city_id IS NULL
  AND r.profile_id = p.id
  AND r.paid_status = 'paid'
  AND r.city_id IS NOT NULL;

-- 3) Recreate directory_members; only the is_commissioner expression changes.
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
    (lt.city_id = p.commissioner_city_id
      AND (p.role = 'commissioner' OR p.is_commissioner = true)) AS is_commissioner,
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
  '(non-canceled) seat at a table in that city/series. Commissioner badge shows '
  'only in the profile''s commissioner_city_id (role = ''commissioner'' OR the '
  'standalone is_commissioner flag). security_invoker=off by design; do not add '
  'private columns.';

REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

COMMIT;
