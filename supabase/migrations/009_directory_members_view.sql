-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: directory_members view
-- ============================================================
-- Exposes ONLY directory-safe member columns to authenticated players so the
-- portal directory (app/portal/directory) can list fellow members without
-- opening up the RLS-locked `profiles` / `registrations` tables.
--
-- Why a view (and why security_invoker = OFF):
--   `profiles` and `registrations` have RLS enabled with NO member-facing
--   policies — they are readable only by the service-role client (see 003/006).
--   A logged-in member therefore cannot read them directly. This view is owned
--   by the migration role (postgres) and runs with DEFINER semantics
--   (security_invoker = off), so it can read those tables while exposing only
--   a hand-picked set of safe columns. It is the single sanctioned window a
--   member gets onto other members' data.
--
--   It MUST stay security_invoker = off: with invoker semantics the querying
--   member's (empty) RLS would apply to the base tables and the view would
--   return nothing. Supabase's linter flags definer views as
--   "security_definer_view" — that warning is expected and accepted here; the
--   exposure is deliberate and column-limited.
--
-- Member scoping (matches Phase2-Portal-Spec "paid members of my city/series"):
--   A member sees only paid members who share BOTH a city and a series with one
--   of their own paid registrations. Admins see all paid members. Anyone with
--   no paid registration (and not admin) sees zero rows. The scope lives in the
--   view body via auth.uid(), so even a raw SELECT can't cross cohorts.
--
-- Safe columns only: profile_id (for profile/[id] links), full_name, city_id,
--   city_name, skill_level, is_commissioner, series_id. No email, phone, role
--   string, paid_status, timestamps, or payment data.
-- ============================================================

BEGIN;

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

-- Members query via the anon key with an authenticated JWT. Lock anon out
-- entirely (defense in depth — the auth.uid() filter already yields no rows for
-- anon) and grant read to authenticated only.
REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

COMMIT;
