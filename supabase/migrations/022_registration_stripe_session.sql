-- ============================================================
-- THE MAHJONG OPEN — registrations.stripe_session_id
-- ============================================================
-- Stores the Stripe Checkout Session id of a registration's CURRENT open
-- session. Lets the admin "resend registration link" flow (and any future
-- session bookkeeping) expire THIS registration's exact session, rather than
-- searching Stripe by email — which is ambiguous, since a multi-city player can
-- have several open pending sessions (one per city) at once.
--
-- Additive, nullable, no backfill (same pattern as 021). Old rows keep NULL and
-- are handled gracefully (the resend route just skips the old-session-expire
-- step when it's NULL). Safe to apply anytime; IF NOT EXISTS makes re-runs
-- harmless. Apply BEFORE the app code that writes this column deploys.
--
-- APPLIED to production 2026-08-01 (confirmed in the Supabase SQL editor;
-- existing rows are NULL as expected).
-- ============================================================

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS stripe_session_id text;
