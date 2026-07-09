-- ============================================================
-- THE MAHJONG OPEN — Waitlist (Coming Soon teaser)
-- ============================================================
-- Pre-launch email capture from /coming-soon. Mirrors
-- commissioner_applications: RLS ON with NO public policies — rows are
-- written only via the service-role key server-side (/api/waitlist).
-- Email is citext so uniqueness is case-insensitive; duplicate signups
-- are handled with ON CONFLICT DO NOTHING in the API.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      citext NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- No public policies: insert/select happen only through the service-role key.

COMMIT;
