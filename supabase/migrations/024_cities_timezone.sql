-- ============================================================
-- THE MAHJONG OPEN — cities.timezone (IANA name for the venue's local time)
-- ============================================================
-- PROPOSAL — review before applying (applied by hand in the Supabase SQL editor).
--
-- table_date/table_time are stored as plain wall-clock values (the venue's local
-- start time, no zone). Code was parsing them with `new Date("YYYY-MM-DDTHH:MM")`,
-- which the JS spec resolves in the *runtime's* local timezone — the viewer's
-- phone (client) or UTC (Vercel server) — not the venue's. That shifted calendar
-- exports per-viewer and, worse, shifted the server-side 24h no-show cutoff by the
-- venue's UTC offset. Storing each city's IANA timezone lets the code resolve
-- those wall-clock times against the correct zone.
--
-- IMPORTANT (deploy ordering): apply this migration BEFORE the app code that
-- selects cities.timezone deploys — otherwise those selects error.
-- ============================================================

BEGIN;

-- 1) Column (nullable first so we can backfill, then made NOT NULL below) -----
ALTER TABLE public.cities ADD COLUMN IF NOT EXISTS timezone text;

-- 2) Backfill by state. All current cities are Central except the Eastern list.
--    Florida is deliberately Central here: our only FL cities (Pensacola, 30A)
--    are in the Central-time Panhandle, NOT Eastern FL — so a blanket "FL =
--    Eastern" would be wrong. Louisiana (Slidell) is unambiguously Central.
--    Covers every row incl. demo/inactive (matched by state, so demo Madison MS
--    -> Central, demo Charleston SC -> Eastern, etc.).
UPDATE public.cities SET timezone = 'America/Chicago'
  WHERE state IN ('MS', 'AL', 'AR', 'TN', 'TX', 'WI', 'LA', 'FL');

UPDATE public.cities SET timezone = 'America/New_York'
  WHERE state IN ('SC', 'NC', 'WV', 'GA');

-- 3) Enforce for the future: every city must carry a timezone; default Central
--    (the majority zone) so the admin "add city" form / any insert is safe even
--    if the field is somehow omitted.
ALTER TABLE public.cities ALTER COLUMN timezone SET DEFAULT 'America/Chicago';
ALTER TABLE public.cities ALTER COLUMN timezone SET NOT NULL;

COMMIT;

-- Post-apply sanity check (should return zero rows):
--   SELECT name, state, timezone FROM public.cities
--   WHERE timezone NOT IN ('America/Chicago', 'America/New_York');
