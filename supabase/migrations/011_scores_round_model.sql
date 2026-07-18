-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: round-level scoring model
-- ============================================================
-- PROPOSAL — review before applying (paste in Supabase SQL editor like 010).
--
-- Aligns score entry with the locked spec (docs/Scoring-Standings-Final-Spec.md):
-- one row per player per ROUND (a round = one table = 4 players, 4 games; the
-- unit the portal tracks), storing the player's total round score plus no-show
-- flags. Individual game scores within a round are NOT tracked (out of scope).
--
-- WHAT STAYS
--   * score_submissions remains the per-round container: one per table,
--     submitted_by = the table's host, status submitted/edited/voided. There is
--     NO approval gate — a submitted round posts immediately; admins edit/void.
--     (The mock's pending/approved ScoreStatus + approval UI get deleted in the
--     build step, not re-worded.)
--   * Existing RLS (migration 006) already covers these tables; new columns need
--     no policy changes.
--
-- WHAT CHANGES on score_submission_players (the per-player round row)
--   * points  -> round_score : the player's total for the round, including the
--       table bonuses (self-pick +10, jokerless +25, wall +10) the host already
--       summed at the table. The portal stores only the final total.
--   * DROP wins : games within a round aren't tracked.
--   * + is_no_show       : this player didn't show (or arrived >20 min late).
--       Drives a -25 weekly penalty (derived: 25 x count of is_no_show rows/week)
--       and is excluded from "rounds played" / averages.
--   * + is_no_show_bonus : the flat +25 recorded for a player who STAYED when
--       someone else no-showed (the round becomes a 3-player game that doesn't
--       count as a played round). Counts toward the weekly/Cumulative total but
--       is excluded from Average Standing (it wasn't a real round played).
--
-- The scores tables are currently empty, so the rename is lossless.
--
-- STANDINGS ARE NOT IN THIS MIGRATION. The two leaderboards (Cumulative =
-- best-7-of-8 weekly top-2 minus all no-show penalties; Average = per-round avg,
-- min 5 rounds) are computed on read via VIEWS in the *standings* step, joining
-- score_submission_players -> score_submissions -> league_tables (week_number,
-- series_id). The columns below are exactly what those views consume. The
-- placeholder `standings` table (006) will be retired then, and profileStats
-- will move off standings.rank at that point.
-- ============================================================

BEGIN;

-- 1) points -> round_score (idempotent).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'score_submission_players' AND column_name = 'points'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'score_submission_players' AND column_name = 'round_score'
  ) THEN
    ALTER TABLE public.score_submission_players RENAME COLUMN points TO round_score;
  END IF;
END $$;

-- 2) Drop per-game wins; ensure round_score + no-show flags exist.
ALTER TABLE public.score_submission_players
  DROP COLUMN IF EXISTS wins,
  ADD COLUMN IF NOT EXISTS round_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_no_show boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_no_show_bonus boolean NOT NULL DEFAULT false;

-- 3) Integrity: a row can't be both an absence and a stay-bonus; scores are
--    non-negative (the -25 no-show penalty is derived on read, never stored as a
--    negative round_score).
ALTER TABLE public.score_submission_players
  DROP CONSTRAINT IF EXISTS score_players_noshow_xor,
  ADD CONSTRAINT score_players_noshow_xor CHECK (NOT (is_no_show AND is_no_show_bonus));

ALTER TABLE public.score_submission_players
  DROP CONSTRAINT IF EXISTS score_players_score_nonneg,
  ADD CONSTRAINT score_players_score_nonneg CHECK (round_score >= 0);

COMMIT;
