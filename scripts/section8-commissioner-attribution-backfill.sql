-- ============================================================
-- SECTION 8 — historical attribution backfill.  *** REVIEW — DO NOT RUN YET ***
-- ============================================================
-- Attributes EXISTING PAID registrations that have no attribution row yet to
-- their city's commissioner, source 'backfill' (kept visibly distinct from
-- 'organic_split' so incoming commissioners can see which rows predate them),
-- weight 1.0000, one row per registration.
--
-- Safe-by-design:
--   * Only paid_status = 'paid' rows (refunded/pending untouched).
--   * Only rows with NO existing attribution (NOT EXISTS guard) — so it never
--     double-writes over post-launch signups, and is safe to re-run.
--   * Only cities that HAVE a commissioner are touched, so demo-series rows
--     (their demo cities have no commissioner_cities) are naturally skipped.
--
-- Memphis is special: it now has TWO commissioners (Sandra + Vicki), but every
-- historical Memphis signup predates Vicki, so they are ALL Sandra's. Handled
-- explicitly in Part A. Every other city is handled generically in Part B, but
-- ONLY when it has exactly one active commissioner; 0-or-many are left for you
-- (the final report lists them).
--
-- ⚠️ Tell Vicki and the other incoming Memphis commissioner about this rule
--    ('backfill' = pre-existing, credited to Sandra) BEFORE running this.
-- ============================================================


-- ------------------------------------------------------------
-- STEP 1 — PREVIEW (run this alone first; it writes nothing).
-- Shows how many paid rows each part would attribute.
-- ------------------------------------------------------------
SELECT 'A: Memphis -> Sandra' AS part, count(*) AS rows_to_write
FROM public.registrations r
JOIN public.cities c ON c.id = r.city_id AND c.name = 'Memphis' AND c.state = 'TN'
WHERE r.paid_status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM public.registration_attributions ra WHERE ra.registration_id = r.id)
UNION ALL
SELECT 'B: other single-commissioner cities' AS part, count(*)
FROM public.registrations r
JOIN public.cities c ON c.id = r.city_id
JOIN (
  SELECT city_id FROM public.commissioner_referral_codes WHERE is_active GROUP BY city_id HAVING count(*) = 1
) sole ON sole.city_id = r.city_id
WHERE r.paid_status = 'paid'
  AND NOT (c.name = 'Memphis' AND c.state = 'TN')
  AND NOT EXISTS (SELECT 1 FROM public.registration_attributions ra WHERE ra.registration_id = r.id);


-- ------------------------------------------------------------
-- STEP 2 — THE BACKFILL (run only after the preview looks right).
-- ------------------------------------------------------------
BEGIN;

-- A) Memphis -> Sandra Faulkner (resolved via her unique code, so no name ambiguity).
INSERT INTO public.registration_attributions (registration_id, commissioner_profile_id, weight, source)
SELECT r.id, crc.profile_id, 1.0000, 'backfill'
FROM public.registrations r
JOIN public.cities c ON c.id = r.city_id AND c.name = 'Memphis' AND c.state = 'TN'
JOIN public.commissioner_referral_codes crc ON crc.code = 'sandra-memphis-tn'
WHERE r.paid_status = 'paid'
  AND NOT EXISTS (SELECT 1 FROM public.registration_attributions ra WHERE ra.registration_id = r.id);

-- B) Every OTHER city that has exactly one active commissioner -> that commissioner.
WITH sole AS (
  -- HAVING count(*) = 1 already guarantees exactly one row per city, so the
  -- aggregate only exists to satisfy GROUP BY. Use (array_agg(profile_id))[1],
  -- NOT min(profile_id): Postgres has no min() for uuid
  -- (ERROR 42883: function min(uuid) does not exist), which made this un-runnable.
  SELECT city_id, (array_agg(profile_id))[1] AS profile_id
  FROM public.commissioner_referral_codes
  WHERE is_active
  GROUP BY city_id
  HAVING count(*) = 1
)
INSERT INTO public.registration_attributions (registration_id, commissioner_profile_id, weight, source)
SELECT r.id, s.profile_id, 1.0000, 'backfill'
FROM public.registrations r
JOIN public.cities c ON c.id = r.city_id
JOIN sole s ON s.city_id = r.city_id
WHERE r.paid_status = 'paid'
  AND NOT (c.name = 'Memphis' AND c.state = 'TN')
  AND NOT EXISTS (SELECT 1 FROM public.registration_attributions ra WHERE ra.registration_id = r.id);

COMMIT;


-- ------------------------------------------------------------
-- STEP 3 — LEFTOVERS report: cities with 0 or >1 active commissioners that
-- still have unattributed paid registrations. Handle these by hand (decide who
-- gets credit / whether to split), then insert 'backfill' rows for them.
-- ------------------------------------------------------------
SELECT c.name, c.state,
  (SELECT count(*) FROM public.commissioner_referral_codes crc WHERE crc.city_id = c.id AND crc.is_active) AS active_commissioners,
  (SELECT count(*) FROM public.registrations r
     WHERE r.city_id = c.id AND r.paid_status = 'paid'
       AND NOT EXISTS (SELECT 1 FROM public.registration_attributions ra WHERE ra.registration_id = r.id)) AS unattributed_paid
FROM public.cities c
-- Active cities only: the demo twins (Charleston / Madison / Gulf Coast all have
-- an is_active = false demo copy) have no commissioner and carry unattributed demo
-- registrations, so without this they surfaced as 9 fake zero-commissioner problems.
WHERE c.is_active
  AND (SELECT count(*) FROM public.commissioner_referral_codes crc WHERE crc.city_id = c.id AND crc.is_active) <> 1
  AND (SELECT count(*) FROM public.registrations r WHERE r.city_id = c.id AND r.paid_status = 'paid'
         AND NOT EXISTS (SELECT 1 FROM public.registration_attributions ra WHERE ra.registration_id = r.id)) > 0
ORDER BY c.name;
