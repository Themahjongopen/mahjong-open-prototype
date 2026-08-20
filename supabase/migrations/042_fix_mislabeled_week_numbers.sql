-- ============================================================
-- 042 — Correct mislabeled week_number on 10 unscored Fall League tables
-- ============================================================
-- week_number was host-set and never validated against table_date, so some tables
-- were labeled a different week than their date (root cause of the Champion award
-- over-counting — Sheila Fleming 60/95). Migration 7accd74 made the create route
-- server-authoritative and added an admin correction path; this corrects the bad
-- DATA that already exists.
--
-- Scope: the 10 mislabeled tables that carry NO submitted scores. Each is set to
-- the week its table_date falls in (seriesWeekForDate against the Aug 17 start).
-- Idempotent — the guard `AND week_number <> <target>` makes a re-run a no-op, and
-- this was already applied out-of-band as the approved scripted update; the file
-- is the audit record.
--
-- DELIBERATELY EXCLUDED — the 2 COMPLETED, SCORED mislabeled tables, held pending
-- commissioner notification before their standings move (they will be corrected
-- separately, on the same date-derived rule):
--   7f7294a5-86ca-4d8e-9d9f-c0ad7ced8c70  Denton County · Lisa's Home · Aug 17 (wk 2 -> 1)
--   af20a7a7-92c9-4bc5-8427-73b278b0f602  Southwest Georgia · Marriott · Aug 17 (wk 2 -> 1)
--
-- Only league_tables.week_number changes — no score row is touched, and standings
-- are computed on read, so the corrected week reflects immediately.

BEGIN;

UPDATE public.league_tables SET week_number = 1 WHERE id = 'a8472df3-1091-4e75-b595-14e8abaf8af9' AND week_number <> 1; -- Franklin · Mahjong club of TN · Aug 21
UPDATE public.league_tables SET week_number = 1 WHERE id = 'dc4eb3bb-edce-424e-9bf1-654b299a9420' AND week_number <> 1; -- Charleston · Rooted bottle & bar · Aug 19
UPDATE public.league_tables SET week_number = 1 WHERE id = '2f31e7ba-25e8-4bac-946d-fd459b487b86' AND week_number <> 1; -- Hattiesburg · Brandy Fairley-Briarwood · Aug 22
UPDATE public.league_tables SET week_number = 2 WHERE id = '7698465f-a062-4aab-a41b-d1903b30026b' AND week_number <> 2; -- Charleston · Bees Ferry Library · Aug 29
UPDATE public.league_tables SET week_number = 1 WHERE id = '3c78b067-e73f-4f11-bd8d-b93c1d047d73' AND week_number <> 1; -- Fort Wayne · Two Bamboo · Aug 19
UPDATE public.league_tables SET week_number = 2 WHERE id = 'd75924c7-bb48-4695-b32a-a6533a3e2fef' AND week_number <> 2; -- Hattiesburg · Brandy Fairley-Briarwood · Aug 24
UPDATE public.league_tables SET week_number = 1 WHERE id = 'ecd89eee-d599-4e21-b7e8-3d9b7623b336' AND week_number <> 1; -- Charleston · North Creek Village · Aug 23
UPDATE public.league_tables SET week_number = 1 WHERE id = '52735219-33bd-4ed7-9d94-9a4352a1fac0' AND week_number <> 1; -- Charleston · Rita's Place · Aug 23
UPDATE public.league_tables SET week_number = 1 WHERE id = 'bf40e798-d820-432f-83bb-663ad0d51b12' AND week_number <> 1; -- Golden Triangle · Sherwood · Aug 17
UPDATE public.league_tables SET week_number = 1 WHERE id = '1a586a12-6aac-4c1a-b8cc-bf96073a1805' AND week_number <> 1; -- Northwest · South Point Grocery · Aug 18

COMMIT;
