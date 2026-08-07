-- Per-series "auto-invite paid registrants" switch.
-- When true, a newly paid registration for that series is sent its portal invite
-- automatically from the Stripe webhook (no admin click). Defaults false so every
-- existing series and every newly created one keeps today's fully-manual behavior
-- until an admin deliberately turns it on. Purely additive — nothing changes until
-- the toggle is flipped.
BEGIN;

ALTER TABLE public.series
  ADD COLUMN IF NOT EXISTS auto_invite_enabled boolean NOT NULL DEFAULT false;

COMMIT;
