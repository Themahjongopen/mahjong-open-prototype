-- ============================================================
-- THE MAHJONG OPEN — copy skill_level onto the profile at account creation
-- ============================================================
-- PROPOSAL — review before applying (applied by hand in the Supabase SQL editor).
--
-- Migration 010 added profiles.skill_level and backfilled it once, but the
-- account-creation trigger handle_new_user() (last redefined in 015) only copies
-- full_name / phone / avatar_url from the matching registration — never
-- skill_level. So every profile created since 010 starts with a NULL skill_level
-- and the portal profile page shows "Skill level not set" even though the player
-- gave a skill at registration.
--
-- This migration:
--   1. Redefines handle_new_user() to ALSO copy skill_level from the newest
--      matching registration, using the same email-matched subquery pattern
--      already used for phone/avatar_url. Everything else in the function is
--      unchanged.
--   2. Backfills any existing profile still missing skill_level from its most
--      recent registration that carries one (same idiom as 010's backfill).
--
-- Additive/idempotent: CREATE OR REPLACE FUNCTION and a guarded UPDATE, safe to
-- re-run. No column/schema/view changes.
-- ============================================================

BEGIN;

-- 1) Trigger now copies skill_level too (same pattern as phone/avatar_url) ----
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, avatar_url, skill_level)
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
      ORDER BY created_at DESC LIMIT 1),
    (SELECT skill_level FROM public.registrations
      WHERE lower(email) = lower(NEW.email) AND skill_level IS NOT NULL
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

-- 2) Backfill profiles that are still missing a skill_level -------------------
UPDATE public.profiles p
   SET skill_level = (
     SELECT r.skill_level
       FROM public.registrations r
      WHERE r.profile_id = p.id
        AND r.skill_level IS NOT NULL
      ORDER BY r.created_at DESC
      LIMIT 1
   )
 WHERE p.skill_level IS NULL;

COMMIT;
