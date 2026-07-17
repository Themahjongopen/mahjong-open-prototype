-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: profile attributes
-- ============================================================
-- PROPOSAL — review before applying (paste in Supabase SQL editor like 009).
--
-- Adds two persistent player attributes to `profiles`, per the profile-page
-- decisions:
--   1. skill_level — promoted from a per-registration value to a durable player
--      attribute. Backfilled from each profile's most recent registration.
--   2. notification_preferences — a flexible JSONB bag so new notification types
--      can be added later without another migration. The app owns the canonical
--      key list + defaults; the column just persists overrides.
--
-- Also repoints the directory_members view (009) to read skill_level from
-- profiles, so the profile is the single source of truth. registrations.skill_
-- level is KEPT as the point-in-time record of what a player signed up as; it is
-- not dropped.
--
-- Writes to profiles stay service-role-only (no new RLS): the profile edit form
-- will submit to a server route that updates the caller's OWN row (auth.uid()),
-- consistent with the rest of the portal.
-- ============================================================

BEGIN;

-- 1) Persistent skill level -------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS skill_level text
    CHECK (skill_level IN ('beginner', 'intermediate', 'advanced'));

-- Backfill from each profile's most recent registration that carries a skill.
UPDATE public.profiles p
   SET skill_level = (
     SELECT r.skill_level
       FROM public.registrations r
      WHERE r.profile_id = p.id
        AND r.skill_level IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT 1
   )
 WHERE p.skill_level IS NULL;

-- 2) Notification preferences (flexible JSONB) ------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Directory now reflects profiles.skill_level (single source of truth) ----
DROP VIEW IF EXISTS public.directory_members;

CREATE VIEW public.directory_members
WITH (security_invoker = off) AS
SELECT DISTINCT
  p.id                      AS profile_id,
  p.full_name               AS full_name,
  reg.city_id               AS city_id,
  c.name                    AS city_name,
  p.skill_level             AS skill_level,
  (p.role = 'commissioner') AS is_commissioner,
  reg.series_id             AS series_id
FROM public.registrations reg
JOIN public.profiles p ON p.id = reg.profile_id
JOIN public.cities   c ON c.id = reg.city_id
WHERE reg.paid_status = 'paid'
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
  'to the authenticated viewer''s own paid city+series cohort (admins see all). '
  'security_invoker=off by design; do not add private columns.';

REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

COMMIT;
