-- ============================================================
-- 043 — Correct week_number on the 2 HELD, completed+scored Fall League tables
-- ============================================================
-- Companion to 042. That migration corrected the 10 mislabeled tables that carried
-- no scores and DELIBERATELY EXCLUDED these two completed, scored tables so the
-- affected commissioners could be notified before their standings moved. That
-- notification has happened; this migration applies the same date-derived rule to
-- the held pair. Kept as a separate migration (not folded into 042) so the "held,
-- then released after notification" step is its own auditable record.
--
-- Both tables are dated 2026-08-17 = week 1 of Fall League 2026 (start 2026-08-17),
-- but were labeled week 2 — which split each player's rounds across two week buckets
-- and inflated the Champion award (a per-week sum of bests). Setting them to week 1
-- collapses each player's Champion back to their true best week.
--
--   7f7294a5-86ca-4d8e-9d9f-c0ad7ced8c70  Denton County · Lisa's Home · Aug 17 (wk 2 -> 1)
--   af20a7a7-92c9-4bc5-8427-73b278b0f602  Southwest Georgia · Marriott · Aug 17 (wk 2 -> 1)
--
-- Applied via the admin set_week path (HTTP 200, derived week, no confirm) as the
-- operation of record; this file is the idempotent audit copy (guarded
-- `AND week_number <> 1`, so a re-run is a no-op). Only league_tables.week_number
-- changes — no score_submissions / score_submission_players row is touched
-- (verified byte-identical before/after); standings are computed on read.
--
-- Verified after applying (by user_id, not name — one Denise Smith user_id appears
-- in two cities' standings):
--   Sheila Fleming          Ace 60   Champion 95 -> 60   (champ rank  3 -> 12)
--   Betsy Calzada           Ace 50   Champion 85 -> 50   (champ rank  5 -> 23)
--   Jacquie Tracy           Ace 45   Champion 80 -> 45   (champ rank  6 -> 26)
--   Lisa Doucet             Ace 45   Champion 45 -> 45   (no change)
--   Janet Campbell          Ace 120  Champion 165 -> 120 (champ rank  1 -> 1)
--   Patsy Hancock           Ace 55   Champion 100 -> 55  (champ rank  2 -> 3)
--   Esther Marie Lawrence   Ace 45   Champion 65 -> 45   (champ rank  4 -> 6)
--   Denise Smith            Ace 10   Champion 20 -> 10   (champ rank  9 -> 9)
-- Every Ace award unchanged; the Fall League mislabeled-table query now returns 0.

BEGIN;

UPDATE public.league_tables SET week_number = 1 WHERE id = '7f7294a5-86ca-4d8e-9d9f-c0ad7ced8c70' AND week_number <> 1; -- Denton County · Lisa's Home · Aug 17
UPDATE public.league_tables SET week_number = 1 WHERE id = 'af20a7a7-92c9-4bc5-8427-73b278b0f602' AND week_number <> 1; -- Southwest Georgia · Marriott · Aug 17

COMMIT;
