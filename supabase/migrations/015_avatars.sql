-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: profile pictures (avatars)
-- ============================================================
-- PROPOSAL — review before applying.
--
-- Adds member profile photos:
--   * public `avatars` storage bucket (images only, 3 MB cap)
--   * profiles.avatar_url + registrations.avatar_url
--   * registration photo (uploaded pre-auth to avatars/registrations/…) is
--     carried onto the profile when the account is created (007 trigger)
--   * directory_members + member_series_standings views expose avatar_url so the
--     directory, seats, and standings can show the photo (no initials anywhere)
--
-- The client wants ONLY real uploaded photos — no initials, neutral blank
-- placeholder when a member has none.
-- ============================================================

BEGIN;

-- 1) Columns ---------------------------------------------------------------
ALTER TABLE public.profiles      ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.registrations ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2) Carry the registration photo onto the new profile at account creation --
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      (SELECT full_name FROM public.registrations
        WHERE lower(email) = lower(NEW.email) ORDER BY created_at DESC LIMIT 1)
    ),
    NEW.email,
    (SELECT phone FROM public.registrations
      WHERE lower(email) = lower(NEW.email) AND phone IS NOT NULL
      ORDER BY created_at DESC LIMIT 1),
    (SELECT avatar_url FROM public.registrations
      WHERE lower(email) = lower(NEW.email) AND avatar_url IS NOT NULL
      ORDER BY created_at DESC LIMIT 1)
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.registrations
     SET profile_id = NEW.id
   WHERE lower(email) = lower(NEW.email)
     AND profile_id IS NULL;

  RETURN NEW;
END;
$$;

-- 3) directory_members — add avatar_url ------------------------------------
DROP VIEW IF EXISTS public.directory_members;
CREATE VIEW public.directory_members
WITH (security_invoker = off) AS
SELECT DISTINCT
  p.id                      AS profile_id,
  p.full_name               AS full_name,
  reg.city_id               AS city_id,
  c.name                    AS city_name,
  p.skill_level             AS skill_level,
  (p.role = 'commissioner') AS is_commissioner,
  reg.series_id             AS series_id,
  p.avatar_url              AS avatar_url
FROM public.registrations reg
JOIN public.profiles p ON p.id = reg.profile_id
JOIN public.cities   c ON c.id = reg.city_id
WHERE reg.paid_status = 'paid'
  AND (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.registrations viewer
      WHERE viewer.profile_id = auth.uid()
        AND viewer.paid_status = 'paid'
        AND viewer.city_id   = reg.city_id
        AND viewer.series_id = reg.series_id
    )
  );
REVOKE ALL ON public.directory_members FROM anon;
GRANT SELECT ON public.directory_members TO authenticated;

-- 4) member_series_standings — add avatar_url ------------------------------
DROP VIEW IF EXISTS public.member_series_standings;
CREATE VIEW public.member_series_standings
WITH (security_invoker = off) AS
WITH base AS (
  SELECT DISTINCT r.series_id, r.city_id, r.profile_id AS user_id, p.full_name, p.avatar_url
  FROM public.registrations r
  JOIN public.profiles p ON p.id = r.profile_id
  WHERE r.paid_status = 'paid' AND r.profile_id IS NOT NULL
),
played AS (
  SELECT lt.series_id, ssp.user_id, COUNT(*) AS rounds_played, SUM(ssp.round_score) AS total_score
  FROM public.score_submission_players ssp
  JOIN public.score_submissions ss ON ss.id = ssp.score_submission_id AND ss.status <> 'voided'
  JOIN public.league_tables lt ON lt.id = ss.table_id
  WHERE NOT ssp.is_no_show AND NOT ssp.is_no_show_bonus
  GROUP BY lt.series_id, ssp.user_id
),
cume AS (
  SELECT series_id, user_id,
         COALESCE(SUM(weekly_top_2) FILTER (WHERE rn <= 7), 0) - COALESCE(SUM(no_show_penalty), 0) AS cumulative_score
  FROM (
    SELECT series_id, user_id, weekly_top_2, no_show_penalty,
           row_number() OVER (PARTITION BY series_id, user_id ORDER BY weekly_top_2 DESC) AS rn
    FROM public.member_weekly_scores
  ) w
  GROUP BY series_id, user_id
),
agg AS (
  SELECT b.series_id, b.city_id, b.user_id, b.full_name, b.avatar_url,
         COALESCE(pl.rounds_played, 0) AS rounds_played,
         COALESCE(pl.total_score, 0) AS total_score,
         CASE WHEN COALESCE(pl.rounds_played, 0) > 0
              THEN round(pl.total_score::numeric / pl.rounds_played, 1) ELSE 0 END AS average_score,
         COALESCE(c.cumulative_score, 0) AS cumulative_score
  FROM base b
  LEFT JOIN played pl ON pl.series_id = b.series_id AND pl.user_id = b.user_id
  LEFT JOIN cume   c  ON c.series_id  = b.series_id AND c.user_id  = b.user_id
)
SELECT agg.*,
  rank() OVER (PARTITION BY series_id, city_id ORDER BY cumulative_score DESC, average_score DESC, total_score DESC) AS cumulative_rank,
  CASE WHEN rounds_played >= 5 THEN
    rank() OVER (PARTITION BY series_id, city_id ORDER BY (rounds_played >= 5) DESC, average_score DESC, rounds_played DESC, total_score DESC)
  ELSE NULL END AS average_rank
FROM agg;
REVOKE ALL ON public.member_series_standings FROM anon, authenticated;

-- 5) Storage: public avatars bucket + policies -----------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = true, file_size_limit = 3145728, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Public read (bucket is public, but be explicit).
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Members manage only their own folder: avatars/<uid>/…
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Pre-auth registration staging: anon may upload only into avatars/registrations/…
DROP POLICY IF EXISTS "avatars_registration_staging_insert" ON storage.objects;
CREATE POLICY "avatars_registration_staging_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'registrations');

COMMIT;
