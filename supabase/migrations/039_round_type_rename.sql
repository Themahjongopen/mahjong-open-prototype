-- ============================================================================
-- 039 — Round type rename: Social -> Casual, Focused -> Mindful
-- ============================================================================
-- Client-directed (Shari, Aug 19). "Social" and "Focused" were named in opposing
-- counsel's letter; they are renamed to "Casual" and "Mindful". Lightning is
-- unchanged. round_type is a display-only label (no scoring, capacity, time-limit,
-- or filtering behavior depends on it — verified across the codebase), so existing
-- rows are converted outright; the old values have no historical dependency.
--
-- round_type is a text column with a CHECK constraint (migration 012), not an enum.
-- Renaming the two values means: drop the old constraint, convert existing rows,
-- add the new constraint. Idempotent — safe to re-run.
--
-- ⚠️ DEPLOY COORDINATION: the app validates and writes round_type against the same
-- value set (CreateTableForm / TableDetailClient options, ROUND_TYPES in the two
-- /api/tables routes). Apply this migration together with the code deploy that
-- ships those values. If they drift apart, only table CREATE/EDIT is affected for
-- that window (viewing, joining, scoring, and standings never read round_type);
-- everything else keeps working.

-- Drop the existing constraint (auto-named league_tables_round_type_check by the
-- ADD COLUMN ... CHECK in 012). IF EXISTS so a re-run is a no-op.
ALTER TABLE public.league_tables DROP CONSTRAINT IF EXISTS league_tables_round_type_check;

-- Convert existing rows. No-ops on re-run (no rows left on the old values).
UPDATE public.league_tables SET round_type = 'casual'  WHERE round_type = 'social';
UPDATE public.league_tables SET round_type = 'mindful' WHERE round_type = 'focused';

-- Re-add the constraint with the new value set. Named explicitly so it is
-- deterministic and this migration stays idempotent (drop-if-exists above).
ALTER TABLE public.league_tables
  ADD CONSTRAINT league_tables_round_type_check
  CHECK (round_type IN ('casual', 'mindful', 'lightning'));
