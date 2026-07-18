-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal: admin role grants
-- ============================================================
-- Phase 2 retires the admin passcode: admins sign in through the normal portal
-- login (Supabase auth) and access is gated by profiles.role = 'admin'
-- (is_admin() from migration 006). Nothing sets that role automatically, so
-- admins are granted here by email.
--
-- The grantee must already have a profile (i.e. have been invited to the portal
-- and signed in at least once, so the 007 trigger created their profiles row).
--
-- To add a production admin once Shari confirms, append another UPDATE with
-- their email and re-run. Idempotent.
-- ============================================================

BEGIN;

-- Testing admin (already has a portal auth account).
UPDATE public.profiles SET role = 'admin'
 WHERE lower(email) = lower('jordanpaulco+bulk@gmail.com');

-- Production admins (add when confirmed):
-- UPDATE public.profiles SET role = 'admin' WHERE lower(email) = lower('admin1@example.com');

COMMIT;
