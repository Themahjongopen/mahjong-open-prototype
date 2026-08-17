-- ============================================================
-- Refund payment-status backfill.  *** REVIEW — DO NOT RUN YET ***
-- ============================================================
-- Corrects historical data: registrations marked paid_status = 'refunded' whose
-- linked payment row was never flipped off status = 'succeeded'. Until the refund
-- route was fixed, marking a registration refunded only touched registrations —
-- the payment row stayed 'succeeded', so its original charge kept counting toward
-- the admin revenue tiles (revenueThisSeries / revenueThisMonth / revenueToday all
-- filter payments.status = 'succeeded'). This flips those stragglers to 'refunded'.
--
-- Run order: ship the code fix FIRST, THEN run this. That way no in-flight refund
-- between the two steps can re-open a gap this backfill just closed.
--
-- Safe-by-design:
--   * Only touches payment rows whose registration is ALREADY paid_status =
--     'refunded' AND whose payment is currently status = 'succeeded'.
--   * status = 'refunded' is a valid payments.status value (migration 003 check).
--   * Idempotent: once flipped, no row matches status = 'succeeded' for an
--     already-refunded registration, so re-running is a no-op.
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1 — PREVIEW (run this alone first; it writes nothing).
-- rows_to_fix   = how many historical payment rows will be corrected.
-- dollars_to_fix = the gross total those rows represent — sanity-check this
--                  against the refunds you know you've issued before running.
-- ------------------------------------------------------------
SELECT
  count(*)                                  AS rows_to_fix,
  '$' || to_char(COALESCE(sum(p.amount_cents), 0) / 100.0, 'FM999,999,990.00') AS dollars_to_fix
FROM public.payments p
JOIN public.registrations r ON r.id = p.registration_id
WHERE r.paid_status = 'refunded'
  AND p.status = 'succeeded';


-- ------------------------------------------------------------
-- STEP 2 — THE BACKFILL (run only after the preview looks right).
-- Scoped to succeeded payments of already-refunded registrations, so it cannot
-- touch anything unrelated, and is a no-op on re-run.
-- ------------------------------------------------------------
UPDATE public.payments
SET status = 'refunded'
WHERE status = 'succeeded'
  AND registration_id IN (
    SELECT id FROM public.registrations WHERE paid_status = 'refunded'
  );


-- ------------------------------------------------------------
-- STEP 3 — VERIFY (run after the update; expects 0 rows).
-- Any remaining rows would be succeeded payments still attached to a refunded
-- registration — there should be none.
-- ------------------------------------------------------------
SELECT count(*) AS remaining_succeeded_for_refunded
FROM public.payments p
JOIN public.registrations r ON r.id = p.registration_id
WHERE r.paid_status = 'refunded'
  AND p.status = 'succeeded';
