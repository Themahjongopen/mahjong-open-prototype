-- ============================================================
-- THE MAHJONG OPEN — 034: person-to-person table invites
-- ============================================================
-- A seated player can email other registered players in the table's city to
-- invite them to join. This is a NOTIFICATION ONLY — it never seats anyone; the
-- recipient still taps the existing "Join this table" button. So there's no RLS
-- change to seating, no consent problem, and no no-show exposure.
--
-- Numbered 034 (not the 031 the build prompt guessed): 031/032/033 were taken by
-- profile_hometown, standings_skill_level, and directory_hometown after that
-- prompt was written. Next free number is 034.
--
-- Uniqueness: a given player can be invited to a given table at most once, ever
-- (table_invites_once_per_table). Enforced here at the DB level, not just in the
-- UI — a second inviter racing the first is turned into a 23505 the POST handler
-- treats as "skipped", never a duplicate row or a second email.
--
-- ON DELETE CASCADE on table_id mirrors migration 006's table_seats /
-- score_submissions treatment, so deleting a cancelled table (the 222bed2
-- feature) still cleans up its invites with no extra code.
-- ============================================================

BEGIN;

CREATE TABLE public.table_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.league_tables(id) ON DELETE CASCADE,
  invited_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT table_invites_once_per_table UNIQUE (table_id, invited_profile_id)
);

CREATE INDEX table_invites_table_id_idx ON public.table_invites(table_id);

ALTER TABLE public.table_invites ENABLE ROW LEVEL SECURITY;
-- Deliberately NO permissive policies: every read and write goes through the
-- service-role client inside /api/tables/[id]/invites, which does its own
-- seated-at-this-table authorization check. Nothing client-side touches this
-- table directly. (Same zero-policy posture as commissioner_cities in 029.)

COMMIT;
