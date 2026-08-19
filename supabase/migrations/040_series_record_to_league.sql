-- ============================================================================
-- 040 — Series record rename: "Series One" -> "Fall League 2026"
-- ============================================================================
-- Client-directed (Shari, Aug 19): "series" becomes "league" everywhere the user
-- sees it. Per the approved Option A (records + labels), this renames the DB
-- *record* only — the schema keeps its names (series table, series_id columns),
-- so no FK, RLS policy, standings view, index, or type changes. All that changes
-- here is the display name shown on the register-city page and admin screens.
--
-- Naming: five leagues a year (Fall, Holiday, Winter, Spring, Summer). The active
-- record is the in-progress Fall League; the year is included so names stay
-- unique across years and archived standings remain unambiguous. The demo record
-- ("Demo — Portal Screenshots (not live)", is_active = false) is intentionally
-- left alone — it is an internal screenshot fixture, not a real league.
--
-- Data-only UPDATE, matched on the exact current name so it is idempotent and a
-- no-op once applied (or if the name was already changed).
UPDATE public.series
SET name = 'Fall League 2026'
WHERE name = 'The Mahjong Open — 2026 — Series One';
