-- ============================================================
-- THE MAHJONG OPEN — Table reminder idempotency guard
-- ============================================================
-- Adds league_tables.reminder_sent_at: the timestamp at which the day-before
-- "table reminder" email batch was ATTEMPTED for a table. The daily cron
-- (/api/cron/table-reminders) only picks up tables where this is NULL and stamps
-- it after processing each one, so a retried or double-fired cron run never
-- emails the same table's seated players twice.
--
-- Additive, nullable, no backfill — completely inert until the cron ships.
-- Existing tables get NULL, i.e. eligible for their next day-before reminder.
-- Safe to apply anytime; ADD COLUMN IF NOT EXISTS makes re-runs harmless.
--
-- APPLIED to production 2026-07-31 (confirmed in the Supabase Table Editor;
-- existing rows are NULL as expected).
-- ============================================================

ALTER TABLE public.league_tables
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
