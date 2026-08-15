-- ============================================================
-- THE MAHJONG OPEN — 037: league_tables.area (free-text metro area)
-- ============================================================
-- A free-text "area" (part of town) on each table so players in large metros
-- (Memphis, East Alabama, Central Arkansas) can filter Open Tables to the part
-- of town they'll actually drive to. Series One is free text with autocomplete;
-- a fixed per-city list is the Series Two follow-up.
--
-- NULLABLE, no default — DELIBERATELY, even though the create form will require
-- it later. The ~105 tables that already exist have no area; a NOT NULL
-- constraint would break every read of them and stop the league functioning.
-- Existing tables render normally everywhere with a null area and stay joinable.
--
-- Numbered 037 (036 was attribution_audit).
--
-- SAFE TO APPLY AHEAD OF THE CODE: nothing selects this column until the feature
-- ships, so applying this migration alone changes no behavior. The column must
-- exist BEFORE the read/write code deploys (that code selects `area`), so this
-- migration is applied first.
-- ============================================================

ALTER TABLE public.league_tables
  ADD COLUMN IF NOT EXISTS area text;

-- The autocomplete + admin-merge queries scan tables by city and group by area;
-- this composite index serves "areas used in this city" without a full scan.
CREATE INDEX IF NOT EXISTS league_tables_city_area_idx
  ON public.league_tables (city_id, area);
