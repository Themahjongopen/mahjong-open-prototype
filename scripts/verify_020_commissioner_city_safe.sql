-- ============================================================
-- Read-only verification for 020_commissioner_city.sql
-- ============================================================
-- Run this in the Supabase SQL editor BEFORE applying 020. It is pure SELECT —
-- no CREATE, ALTER, or write of any kind — so it's safe to run against
-- production as-is.
--
-- 020 backfills profiles.commissioner_city_id from each commissioner's single
-- paid registration. That backfill is only deterministic if no commissioner has
-- more than one paid registration (check 1). Checks 2–3 surface anything that
-- would leave a commissioner with a NULL city (and thus lose their directory
-- badge once the view is city-scoped), and check 4 previews the exact values the
-- backfill will write.
--
-- Run each query; the "Expected" result is noted inline.
-- ============================================================

-- 1) BLOCKER: any commissioner with more than one paid registration? The
--    UPDATE ... FROM backfill would pick an arbitrary one of these, so this
--    MUST be empty before applying.
--    Expected: 0 rows.
SELECT p.id AS profile_id, p.full_name, COUNT(*) AS paid_registrations
FROM public.profiles p
JOIN public.registrations r ON r.profile_id = p.id AND r.paid_status = 'paid'
WHERE p.role = 'commissioner'
GROUP BY p.id, p.full_name
HAVING COUNT(*) > 1;

-- 2) Commissioners with NO paid registration at all. The backfill can't set a
--    city for these, so their badge would disappear once the view requires a
--    city match. Expected: 0 rows (if any appear, decide their city before
--    applying — e.g. assign one manually).
SELECT p.id AS profile_id, p.full_name
FROM public.profiles p
WHERE p.role = 'commissioner'
  AND NOT EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.profile_id = p.id AND r.paid_status = 'paid' AND r.city_id IS NOT NULL
  );

-- 3) Sanity: standalone is_commissioner = true on a profile that is NOT
--    role = 'commissioner'. These rely purely on the flag; after 020 their badge
--    also needs commissioner_city_id set (which the backfill only fills for
--    role = 'commissioner'). Informational — flag is currently write-dead, so
--    Expected: 0 rows.
SELECT p.id AS profile_id, p.full_name, p.role
FROM public.profiles p
WHERE p.is_commissioner = true
  AND (p.role IS DISTINCT FROM 'commissioner');

-- 4) PREVIEW: exactly what the backfill will write (one city per commissioner).
--    Eyeball that each commissioner maps to the intended city.
--    Expected: one row per current commissioner, city_id non-null.
SELECT p.id AS profile_id, p.full_name, r.city_id, c.name AS city_name
FROM public.profiles p
JOIN public.registrations r ON r.profile_id = p.id AND r.paid_status = 'paid' AND r.city_id IS NOT NULL
JOIN public.cities c ON c.id = r.city_id
WHERE p.role = 'commissioner';
