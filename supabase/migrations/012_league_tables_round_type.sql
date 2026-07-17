-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: table round type
-- ============================================================
-- Adds an optional round "type" to league_tables (Social / Focused /
-- Lightning), set by the host on the Create Table form. Purely descriptive —
-- no impact on scoring or standings. Nullable so existing tables are unaffected;
-- new tables always carry one (the form requires a choice). Follows the
-- text + CHECK convention used elsewhere (skill_level, status) rather than a
-- Postgres enum type.
-- ============================================================

BEGIN;

ALTER TABLE public.league_tables
  ADD COLUMN IF NOT EXISTS round_type text
    CHECK (round_type IN ('social', 'focused', 'lightning'));

COMMIT;
