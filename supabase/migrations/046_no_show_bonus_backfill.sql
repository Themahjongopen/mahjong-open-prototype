-- ============================================================
-- THE MAHJONG OPEN — 046: backfill stored stay-bonus rows 25 -> 0
-- ============================================================
-- Companion to 045 (penalty −25 -> −20). The stay bonus changed +25 -> 0 in app
-- code (NO_SHOW_STAY_BONUS = 0), which fixes NEW no-show rounds; this corrects the
-- 15 already-stored is_no_show_bonus rows (all Fall League 2026, Week 1) that were
-- written at 25. Ran out of band as a scripted update AFTER the five affected
-- cities' commissioners were notified (ranks move); this file is the idempotent
-- audit record (guard `round_score = 25`, so a re-run matches 0 rows).
--
-- Scope: ONLY is_no_show_bonus rows still at 25 — no is_no_show row and no real
-- round score is touched (verified: the SHA of every non-no-show/non-bonus
-- round_score was identical before and after). The −20 penalty needs no backfill;
-- it is derived on read by 045.
--
-- Affected players (Ace/Champion drop where the +25 was serving as their single
-- highest "round" with no game played): Fort Wayne — Ida Owen 25->0; North
-- Tarrant — Addy Bailey 25->0, Jodi Merkel 25->10; Midland — Erica Watkins &
-- Kalie Lewis 25->0; Northwest — Linda McKnight 25->0. The other 9 bonus rows are
-- players whose real game round already outscored the bonus (no change). Verified
-- after: all 20 affected players (incl. the 5 absent players now at −20 Champion)
-- match the predicted values.

BEGIN;

UPDATE public.score_submission_players
SET round_score = 0
WHERE is_no_show_bonus = true
  AND round_score = 25;

COMMIT;
