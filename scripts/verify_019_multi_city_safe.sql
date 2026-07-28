-- ============================================================
-- Read-only verification for 019_multi_city_registration.sql
-- ============================================================
-- Run this in the Supabase SQL editor BEFORE applying 019. It is pure SELECT —
-- no CREATE, ALTER, or write of any kind — so it's safe to run against
-- production as-is.
--
-- 019 LOOSENS registrations' uniqueness from (email, series_id) to
-- (email, series_id, city_id). Because the new key is a superset of the old
-- one, no existing row can violate it — these three checks confirm that
-- explicitly against the real data instead of just asserting it.
--
-- Run each query; every one should return the "Expected" result noted inline.
-- ============================================================

-- 1) The constraint 019 will DROP. Confirms it exists with the name 019 targets
--    (registrations_email_series_id_key) and covers exactly (email, series_id),
--    so the DROP hits the right object.
--    Expected: one 'u' (unique) row -> UNIQUE (email, series_id).
SELECT con.conname AS constraint_name,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public'
  AND rel.relname = 'registrations'
  AND con.contype = 'u';

-- 2) Would the NEW UNIQUE (email, series_id, city_id) fail on today's data?
--    Any (email, series_id, city_id) group with more than one row would block
--    the ADD. (This is impossible given the current (email, series_id)
--    constraint, but confirm against the real table.)
--    Expected: 0 rows.
SELECT email, series_id, city_id, COUNT(*) AS row_count
FROM public.registrations
GROUP BY email, series_id, city_id
HAVING COUNT(*) > 1;

-- 3) Rows where the NULL-distinct caveat would matter (city_id IS NULL). These
--    are NOT deduped by the new constraint. Informational only.
--    Expected: 0 rows (the register form always sets a city; cities with
--    registrations can't be deleted). Any rows here are worth a look before
--    Stage 2 changes the enforcement.
SELECT id, email, series_id, created_at
FROM public.registrations
WHERE city_id IS NULL;
