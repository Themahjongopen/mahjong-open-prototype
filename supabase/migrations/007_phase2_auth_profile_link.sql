-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Auth: profile creation + registration link
-- ============================================================
-- Closes the gap that migration 003 left open: the live DB has a
-- `profiles` table but NO trigger to populate it, so a Supabase Auth
-- user (created by an admin invite) would have no profile row and no
-- link back to their registration. Migration 006's RLS helper
-- `is_paid_member()` matches on `registrations.profile_id`, so that
-- link is load-bearing for the whole portal.
--
-- On each new auth.users row this:
--   1. creates a profiles row (id = auth uid), pulling name/phone from
--      the invite metadata or the matching paid registration, and
--   2. backfills registrations.profile_id for that email.
--
-- Email match is case-insensitive on both sides.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      (SELECT full_name FROM public.registrations
        WHERE lower(email) = lower(NEW.email)
        ORDER BY created_at DESC LIMIT 1)
    ),
    NEW.email,
    (SELECT phone FROM public.registrations
      WHERE lower(email) = lower(NEW.email) AND phone IS NOT NULL
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ------------------------------------------------------------
-- One-time backfill for any auth users that already exist (idempotent).
-- ------------------------------------------------------------
INSERT INTO public.profiles (id, full_name, email, phone)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', r.full_name),
       u.email,
       r.phone
FROM auth.users u
LEFT JOIN LATERAL (
  SELECT full_name, phone FROM public.registrations
   WHERE lower(email) = lower(u.email)
   ORDER BY created_at DESC LIMIT 1
) r ON true
ON CONFLICT (id) DO NOTHING;

UPDATE public.registrations reg
   SET profile_id = p.id
  FROM public.profiles p
 WHERE reg.profile_id IS NULL
   AND lower(reg.email) = lower(p.email);

COMMIT;
