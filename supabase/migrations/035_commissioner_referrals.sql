-- ============================================================
-- THE MAHJONG OPEN — 035: commissioner referral links + attribution (Phase 1)
-- ============================================================
-- Gives every commissioner a readable referral code per city, records who a
-- registration is attributed to, and adds a per-city flag for markets where
-- commissioners split independently (Memphis today).
--
-- Numbered 035 (034 was table_invites).
--
-- Phase 2 (NOT here): admin attribution-reassignment UI, per-commissioner revenue
-- view, refund-exclusion, historical backfill of pre-existing registrations.
--
-- RLS: both new tables get RLS ON with NO permissive policies — every read/write
-- goes through the service-role client in API routes, same posture as
-- table_invites (034) and commissioner_cities (029).
-- ============================================================

BEGIN;

-- ---- 1. cities.split_commission ---------------------------------------------
-- Default FALSE so 21 of 22 cities are unchanged and the registration form
-- renders byte-identical. Flipping a city's flag is the entire rollout/rollback
-- lever — no deploy required.
ALTER TABLE public.cities
  ADD COLUMN IF NOT EXISTS split_commission boolean NOT NULL DEFAULT false;

-- ---- 2. commissioner_referral_codes -----------------------------------------
-- One readable code per commissioner per city. Codes are public by design (they
-- get printed and spoken aloud), so nothing here is secret.
CREATE TABLE public.commissioner_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commissioner_referral_codes_one_per_city UNIQUE (profile_id, city_id)
);
CREATE INDEX commissioner_referral_codes_city_id_idx ON public.commissioner_referral_codes(city_id);
ALTER TABLE public.commissioner_referral_codes ENABLE ROW LEVEL SECURITY;

-- ---- 3. registration_attributions -------------------------------------------
-- A SEPARATE table (not a column on registrations) because an organic split
-- produces multiple rows per registration. weight is FROZEN at write time: never
-- divide by today's commissioner count at read time, or adding a 4th Memphis
-- commissioner in October would silently rewrite what the other three earned in
-- August. commissioner_profile_id is nullable so an unattributed row can exist.
CREATE TABLE public.registration_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  commissioner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  weight numeric(5,4) NOT NULL DEFAULT 1.0000,
  source text NOT NULL, -- one of: link, dropdown, organic_split, backfill, manual
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registration_attributions_registration_id_idx ON public.registration_attributions(registration_id);
CREATE INDEX registration_attributions_commissioner_idx ON public.registration_attributions(commissioner_profile_id);
ALTER TABLE public.registration_attributions ENABLE ROW LEVEL SECURITY;

-- ---- 4. Readable code generation --------------------------------------------
-- slugify: lower-case, strip accents, collapse every run of non-alphanumerics to
-- a single hyphen, trim. Accent handling needs no unaccent extension: NFD
-- decomposition splits an accented letter into its base letter + a combining
-- mark (e.g. 'é' -> 'e' + U+0301); the base letter is [a-z] and survives, while
-- the combining mark is non-alphanumeric and is folded away by the same pass that
-- handles spaces and punctuation.
CREATE OR REPLACE FUNCTION public.slugify(input text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT trim(both '-' FROM
    regexp_replace(
      normalize(lower(coalesce(input, '')), NFD),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

-- generate_commissioner_code: "<firstname>-<city>", e.g. "sandra-memphis". On
-- collision append a short random suffix ("sandra-memphis-k4"); after many tries
-- fall back to a longer suffix so this can never loop forever.
CREATE OR REPLACE FUNCTION public.generate_commissioner_code(p_profile_id uuid, p_city_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_first text;
  v_city  text;
  v_base  text;
  v_code  text;
  v_tries int := 0;
BEGIN
  SELECT split_part(coalesce(full_name, ''), ' ', 1) INTO v_first
  FROM public.profiles WHERE id = p_profile_id;
  SELECT coalesce(slug, name) INTO v_city
  FROM public.cities WHERE id = p_city_id;

  v_base := trim(both '-' FROM public.slugify(v_first) || '-' || public.slugify(v_city));
  IF v_base IS NULL OR v_base = '' OR v_base = '-' THEN
    v_base := 'commissioner';
  END IF;

  v_code := v_base;
  WHILE EXISTS (SELECT 1 FROM public.commissioner_referral_codes WHERE code = v_code) LOOP
    v_tries := v_tries + 1;
    IF v_tries > 25 THEN
      v_code := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6);
      EXIT;
    END IF;
    v_code := v_base || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 2);
  END LOOP;

  RETURN v_code;
END;
$$;

-- ---- 5. Auto-generate a code on every future commissioner promotion ----------
CREATE OR REPLACE FUNCTION public.tg_commissioner_cities_generate_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.commissioner_referral_codes (profile_id, city_id, code)
  VALUES (NEW.profile_id, NEW.city_id, public.generate_commissioner_code(NEW.profile_id, NEW.city_id))
  ON CONFLICT (profile_id, city_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER commissioner_cities_generate_code
AFTER INSERT ON public.commissioner_cities
FOR EACH ROW EXECUTE FUNCTION public.tg_commissioner_cities_generate_code();

-- ---- 6. Backfill codes for every existing commissioner_cities pair -----------
-- Row-by-row (not one INSERT..SELECT) so each new code is visible to the next
-- generate call — otherwise two same-first-name commissioners in one city would
-- both mint the same base code and collide.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT profile_id, city_id FROM public.commissioner_cities LOOP
    INSERT INTO public.commissioner_referral_codes (profile_id, city_id, code)
    VALUES (r.profile_id, r.city_id, public.generate_commissioner_code(r.profile_id, r.city_id))
    ON CONFLICT (profile_id, city_id) DO NOTHING;
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- 7. Turn the split ON for Memphis — SEPARATE statement, reversible by Shari.
--    Rollback is exactly: UPDATE public.cities SET split_commission = false
--                         WHERE name = 'Memphis' AND state = 'TN';
-- ============================================================
UPDATE public.cities SET split_commission = true WHERE name = 'Memphis' AND state = 'TN';
