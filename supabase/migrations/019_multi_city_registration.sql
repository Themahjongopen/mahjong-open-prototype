-- ============================================================
-- THE MAHJONG OPEN — Multi-city registration · Stage 1 (schema only)
-- ============================================================
-- PROPOSAL — review before applying. Run by hand in the Supabase SQL editor.
-- SCHEMA-ONLY: no app code ships with this, same as 018 (the SQL landed ahead
-- of its app-layer work).
--
-- Eventual goal: let one player hold a PAID registration in more than one city
-- within the SAME series. Today registrations has, from 003:
--     UNIQUE (email, series_id)      -- unnamed -> registrations_email_series_id_key
-- which blocks a second registration in a series even for a different city.
-- This loosens it to:
--     UNIQUE (email, series_id, city_id)
-- so a player can register once PER CITY, but still not twice for the same city.
--
-- ── SAFETY: pure loosening, cannot fail on current data ─────
-- The new key is a SUPERSET of the old key's columns, so every pair of rows the
-- old (email, series_id) constraint already allowed stays unique under the wider
-- (email, series_id, city_id) key. No existing row can violate the new rule, so
-- ADD CONSTRAINT cannot fail. Run scripts/verify_019_multi_city_safe.sql FIRST
-- to confirm against the real table (expected: zero (email, series_id, city_id)
-- duplicates) rather than just trusting the argument.
--
-- ── INERT BY ITSELF: applying this alone changes no live behavior ──
-- app/api/register/route.ts enforces one-registration-per-(email, series) at the
-- APPLICATION layer, independent of this constraint: it looks up an existing
-- registration by (email, series_id) and UPDATEs that row (swapping city_id)
-- instead of inserting a second one. So no multi-city row can be created until
-- the Stage 2 app change lands; the DB constraint is only a backstop today.
-- (Verified by reading register/route.ts, not assumed.)
--
-- ── CAVEAT for Stage 2: NULLABLE city_id + NULL-distinct ────
-- city_id is NULLABLE (ON DELETE SET NULL). Postgres treats NULLs as DISTINCT in
-- a UNIQUE, so this constraint would NOT dedupe two rows that both have
-- city_id IS NULL. In practice city_id is never null — the register form
-- requires a city, and a city that has registrations can't be deleted (see
-- /api/admin/cities, which forces deactivate-instead-of-delete). Flagging for
-- completeness; the verify script counts any NULL-city rows so this is checked
-- against real data before applying. If NULL-city rows ever exist and must be
-- deduped, Postgres 15+ `UNIQUE NULLS NOT DISTINCT` is the tool — deliberately
-- NOT used here to keep the change minimal.
--
-- Reversible: to roll back, DROP the new constraint and re-ADD
-- UNIQUE (email, series_id).
-- ============================================================

BEGIN;

ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_email_series_id_key,
  ADD CONSTRAINT registrations_email_series_id_city_id_key
    UNIQUE (email, series_id, city_id);

COMMIT;
