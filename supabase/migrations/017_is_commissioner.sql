-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: standalone commissioner badge
-- ============================================================
-- Decouples the commissioner badge from the `role` field: a member can now be
-- flagged as a commissioner (profiles.is_commissioner = true) independently of
-- their role, so e.g. someone with role = 'admin' can still display as a
-- commissioner in the directory.
--
-- directory_members is recreated identically to 016_show_in_directory.sql
-- EXCEPT its is_commissioner output column, which now also honors the new flag:
--   (p.role = 'commissioner' OR p.is_commissioner = true)
-- Everything else — columns, show_in_directory filter, scoping, grants, and
-- security_invoker=off semantics — is unchanged.
-- ============================================================

BEGIN;

-- 1) New standalone commissioner flag on profiles (off by default).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_commissioner boolean NOT NULL DEFAULT false;

-- 2) Recreate directory_members; only the is_commissioner expression changes.
--    (Same DROP+CREATE+grant pattern as 016; DROP wipes grants so we re-grant.)
DROP VIEW IF EXISTS public.directory_members;

CREATE VIEW public.directory_members
WITH (security_invoker = off) AS
SELECT DISTINCT
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
  'excluding members who opted out via show_in_directory. Commissioner badge is '
  'role = ''commissioner'' OR the standalone is_commissioner flag. '
  'security_invoker=off by design; do not add private columns.';

REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

COMMIT;
