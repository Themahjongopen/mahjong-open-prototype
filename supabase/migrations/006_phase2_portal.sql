-- ============================================================
-- THE MAHJONG OPEN — Phase 2 Portal Schema
-- ============================================================
-- Aligns the portal (tables / seats / scores / standings) to the
-- LIVE Phase 1 model from migration 003 (profiles, cities, series,
-- registrations, payments).
--
-- Migrations 001/002 are SUPERSEDED and were never applied to the
-- live project (verified 2026-07-06: their portal tables — seasons,
-- city_memberships, scramble_tables, table_seats, score_submissions,
-- standings, announcements — do not exist in the live database).
-- Do NOT apply 001/002. This migration is the portal's source of truth.
--
-- Key differences from the retired 001 model:
--   * series (003), NOT seasons — portal tables key off series_id.
--   * NO city_memberships — membership = a `paid` row in
--     registrations, linked to a profile by registrations.profile_id.
--   * scramble_tables -> league_tables (drops the old "scramble" flag).
--   * score_submissions has no approval states (submitted/edited/voided);
--     the table creator submits for all 4 seats and it posts immediately.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 0) Link registrations -> profiles (by account, backfilled at invite time)
--    Nullable: unpaid/never-invited registrants have no profile yet.
-- ------------------------------------------------------------
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_registrations_profile ON public.registrations(profile_id);

-- ------------------------------------------------------------
-- 1) league_tables — weekly self-organized foursomes (replaces scramble_tables)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.league_tables (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id          uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  series_id        uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  creator_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_number      integer NOT NULL CHECK (week_number BETWEEN 1 AND 9),
  table_date       date NOT NULL,
  table_time       time,
  location_name    text NOT NULL,
  location_address text,
  skill_level      text CHECK (skill_level IN ('beginner', 'intermediate', 'advanced')),
  notes            text,
  status           text NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'full', 'completed', 'canceled')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_tables_city_series ON public.league_tables(city_id, series_id);
CREATE INDEX IF NOT EXISTS idx_league_tables_creator ON public.league_tables(creator_id);

-- ------------------------------------------------------------
-- 2) table_seats — up to 4 seats per table
--    Partial unique indexes so a canceled seat frees its slot for re-join.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.table_seats (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id    uuid NOT NULL REFERENCES public.league_tables(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seat_number integer NOT NULL CHECK (seat_number BETWEEN 1 AND 4),
  joined_at   timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz
);

-- One active occupant per seat, and one active seat per user, per table.
CREATE UNIQUE INDEX IF NOT EXISTS uq_table_seats_active_seat
  ON public.table_seats(table_id, seat_number) WHERE canceled_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_table_seats_active_user
  ON public.table_seats(table_id, user_id) WHERE canceled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_table_seats_table ON public.table_seats(table_id);
CREATE INDEX IF NOT EXISTS idx_table_seats_user ON public.table_seats(user_id);

-- ------------------------------------------------------------
-- 3) score_submissions — one per table, submitted by the table creator.
--    No approval gate: status is submitted/edited/voided. Admin can edit/void.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.score_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id     uuid NOT NULL UNIQUE REFERENCES public.league_tables(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'submitted'
               CHECK (status IN ('submitted', 'edited', 'voided')),
  admin_notes  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_submissions_table ON public.score_submissions(table_id);

-- ------------------------------------------------------------
-- 4) score_submission_players — per-player result within a submission
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.score_submission_players (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_submission_id uuid NOT NULL REFERENCES public.score_submissions(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wins                integer NOT NULL DEFAULT 0,
  points              integer NOT NULL DEFAULT 0,
  notes               text,
  UNIQUE (score_submission_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_score_players_submission ON public.score_submission_players(score_submission_id);
CREATE INDEX IF NOT EXISTS idx_score_players_user ON public.score_submission_players(user_id);

-- ------------------------------------------------------------
-- 5) standings — per (series_id, user_id); recalculated on submit/edit/void
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.standings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id     uuid NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_points  integer NOT NULL DEFAULT 0,
  total_wins    integer NOT NULL DEFAULT 0,
  tables_played integer NOT NULL DEFAULT 0,
  avg_points    numeric(8,2) NOT NULL DEFAULT 0,
  rank          integer,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (series_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_standings_series ON public.standings(series_id);

-- ============================================================
-- Row Level Security
-- ============================================================
-- Membership model: a profile is a paid member of a series iff it has a
-- registrations row with paid_status='paid' and profile_id = that profile.
-- Helpers are SECURITY DEFINER so they can read registrations/profiles
-- (both service-role-only under RLS) while evaluating a member's policy.
-- The admin service-role client bypasses RLS entirely and is unaffected.
-- ============================================================

ALTER TABLE public.league_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_submission_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.standings ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper: is the current user a paid member of the given series?
CREATE OR REPLACE FUNCTION public.is_paid_member(p_series_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
    WHERE r.profile_id = auth.uid()
      AND r.series_id = p_series_id
      AND r.paid_status = 'paid'
  );
$$;

-- ---------- LEAGUE_TABLES ----------
-- Read: paid members of the table's series; admin sees all.
CREATE POLICY "league_tables_member_read" ON public.league_tables
  FOR SELECT USING (public.is_admin() OR public.is_paid_member(series_id));

-- Insert: a paid member creates a table they own in a series they belong to.
CREATE POLICY "league_tables_member_insert" ON public.league_tables
  FOR INSERT WITH CHECK (creator_id = auth.uid() AND public.is_paid_member(series_id));

-- Update: creator (e.g. cancel their table) or admin.
CREATE POLICY "league_tables_creator_update" ON public.league_tables
  FOR UPDATE USING (creator_id = auth.uid() OR public.is_admin());

-- ---------- TABLE_SEATS ----------
-- Read: anyone paid in the table's series; admin sees all.
CREATE POLICY "table_seats_member_read" ON public.table_seats
  FOR SELECT USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.league_tables t
      WHERE t.id = table_id AND public.is_paid_member(t.series_id)
    )
  );

-- Insert: claim a seat for yourself in a table whose series you belong to.
CREATE POLICY "table_seats_member_insert" ON public.table_seats
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.league_tables t
      WHERE t.id = table_id AND public.is_paid_member(t.series_id)
    )
  );

-- Update: cancel your own seat (24h cutoff enforced in the API route), or admin.
CREATE POLICY "table_seats_cancel_own" ON public.table_seats
  FOR UPDATE USING (user_id = auth.uid() OR public.is_admin());

-- ---------- SCORE_SUBMISSIONS ----------
-- Read: the submitter, anyone actively seated at the table, or admin.
CREATE POLICY "score_submissions_seated_read" ON public.score_submissions
  FOR SELECT USING (
    submitted_by = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.table_seats ts
      WHERE ts.table_id = table_id
        AND ts.user_id = auth.uid()
        AND ts.canceled_at IS NULL
    )
  );

-- Insert: only the table creator, submitting for their own table.
CREATE POLICY "score_submissions_creator_insert" ON public.score_submissions
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.league_tables t
      WHERE t.id = table_id AND t.creator_id = auth.uid()
    )
  );

-- Update: admin only (submissions lock after submit; admin corrects/voids).
CREATE POLICY "score_submissions_admin_update" ON public.score_submissions
  FOR UPDATE USING (public.is_admin());

-- ---------- SCORE_SUBMISSION_PLAYERS ----------
-- Read: your own line, anyone seated at the table, or admin.
CREATE POLICY "score_players_seated_read" ON public.score_submission_players
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.score_submissions ss
      JOIN public.table_seats ts ON ts.table_id = ss.table_id
      WHERE ss.id = score_submission_id
        AND ts.user_id = auth.uid()
        AND ts.canceled_at IS NULL
    )
  );

-- Insert: the table creator (via their own submission), or admin.
CREATE POLICY "score_players_creator_insert" ON public.score_submission_players
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.score_submissions ss
      JOIN public.league_tables t ON t.id = ss.table_id
      WHERE ss.id = score_submission_id AND t.creator_id = auth.uid()
    )
  );

-- Update: admin only (corrections).
CREATE POLICY "score_players_admin_update" ON public.score_submission_players
  FOR UPDATE USING (public.is_admin());

-- ---------- STANDINGS ----------
-- Read: paid members of the series; admin sees all.
CREATE POLICY "standings_member_read" ON public.standings
  FOR SELECT USING (public.is_admin() OR public.is_paid_member(series_id));

-- Write: admin/service-role only — standings are recalculated server-side.
CREATE POLICY "standings_admin_write" ON public.standings
  FOR ALL USING (public.is_admin());

COMMIT;
