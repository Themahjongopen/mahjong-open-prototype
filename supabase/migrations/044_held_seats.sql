-- ============================================================
-- THE MAHJONG OPEN — 044: held seats for table invitations (Phase 2, commit 1)
-- ============================================================
-- Lets a sent invitation HOLD a seat's capacity for one hour so a remote player
-- can't take a spot meant for the people already at the table (Gulf Coast
-- commissioner, Aug 19). Design: Option A — a hold is a lifecycle state on
-- table_invites; it NEVER becomes a table_seats row, so the no-show / score path
-- (scoringSeats over table_seats) can't see it, and it NEVER flips
-- league_tables.status, so cancelSeatsAndNotify's 4->3 and within-24h triggers are
-- untouched. Capacity is derived on read as active seats + unexpired holds.
--
-- Expiry is DERIVED (created_at + a one-hour TTL owned in lib/portal/holdExpiry.ts),
-- never stored per row, so a future TTL change applies to every outstanding hold.
--
-- This is commit 1 of 6 and is a NO-OP for running code: it only adds the schema
-- + functions the later commits call. Nothing invokes them yet.
--
-- Numbered 044: prod is at 043 (042/043 were the week_number data fixes). Ran
-- `ls supabase/migrations` per CLAUDE.md; 044 is the next unused number. No view
-- is touched, so the CLAUDE.md view-rewrite diff rule does not apply here.

BEGIN;

-- ---- 1. table_invites lifecycle -------------------------------------------
-- status: pending  = a LIVE hold (until created_at + TTL, evaluated on read)
--         accepted = the invitee took a real seat (hold consumed)
--         declined = host/inviter released it, or the invitee declined
--         expired  = parked terminal: every pre-existing row (below), plus a
--                    stale pending row lazily rewritten by create_hold() so the
--                    partial unique index can accept a re-invite.
ALTER TABLE public.table_invites ADD COLUMN status text;

-- Park EVERY existing invite terminal so none is ever read as a hold. These are
-- historical notification rows (999+); a hold is only ever a row created AFTER
-- this ships. An explicit backfill (not a DEFAULT) means there is no window in
-- which an old row counts toward capacity.
UPDATE public.table_invites SET status = 'expired' WHERE status IS NULL;

ALTER TABLE public.table_invites
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN status SET DEFAULT 'pending',
  ADD CONSTRAINT table_invites_status_chk CHECK (status IN ('pending','accepted','declined','expired'));

-- Re-invite after decline/expiry: replace "once per table ever" with "one LIVE
-- (pending) hold per person per table". A partial index cannot reference the TTL
-- (now() is not IMMUTABLE), so a stale-but-still-'pending' row would otherwise
-- keep blocking a re-invite — create_hold() rewrites such a row to 'expired'
-- under the table's advisory lock immediately before inserting, so this index
-- stays collision-free.
ALTER TABLE public.table_invites DROP CONSTRAINT IF EXISTS table_invites_once_per_table;
CREATE UNIQUE INDEX table_invites_one_pending_per_table
  ON public.table_invites(table_id, invited_profile_id) WHERE status = 'pending';

-- Fast "live holds for this table" scan used by every capacity read.
CREATE INDEX IF NOT EXISTS table_invites_table_status_idx
  ON public.table_invites(table_id, status);

-- ---- 2. Realtime touch target ---------------------------------------------
-- table_invites has RLS on with NO policies (server-only), so it is deliberately
-- NOT added to the Realtime publication — a member SELECT policy would leak who
-- is invited to whom. Instead, hold create/release bumps league_tables.updated_at
-- (inside the functions below) so the EXISTING league_tables subscription (038)
-- refetches Open Tables. Expiry is read-derived and writes nothing, so it is
-- caught by a client-side timer, not Realtime (by design).
ALTER TABLE public.league_tables ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- ---- 3. Capacity-safe seat/hold operations (the advisory-lock RPCs) --------
-- Capacity now spans two tables (table_seats + table_invites), so no single
-- partial-unique index can enforce active seats + holds <= 4. Each function
-- serializes every capacity-CHANGING op on a table with pg_advisory_xact_lock and
-- re-counts under the lock before writing; different tables never block each
-- other. uq_table_seats_active_seat / _user remain as backstops on the real seat
-- rows. p_hold_cutoff is passed in as (now - TTL) so the one-hour value lives ONLY
-- in lib/portal/holdExpiry.ts and is never duplicated in SQL.
--
-- The lock key is hashtext(...) cast to bigint: two different table ids could
-- hash-collide and serialize needlessly (never incorrectly) — an acceptable, rare
-- extra-contention case, not a correctness one.

-- claim_seat: a direct join OR an invitee accepting their own hold. Idempotent.
CREATE OR REPLACE FUNCTION public.claim_seat(
  p_table_id uuid,
  p_user_id uuid,
  p_hold_cutoff timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count int;
  v_hold_count int;
  v_seat_number int;
  v_seat_id uuid;
  v_existing record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('tableseat:' || p_table_id::text)::bigint);

  -- Idempotent: already actively seated here -> return that seat, never a 2nd row.
  SELECT id, seat_number INTO v_existing
  FROM public.table_seats
  WHERE table_id = p_table_id AND user_id = p_user_id AND canceled_at IS NULL
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true,
      'seat_number', v_existing.seat_number, 'seat_id', v_existing.id, 'now_full', false);
  END IF;

  SELECT count(*) INTO v_active_count
  FROM public.table_seats
  WHERE table_id = p_table_id AND canceled_at IS NULL;

  -- Live holds EXCLUDING this user's own (they may be the one accepting it), so a
  -- hold never blocks its own invitee.
  SELECT count(*) INTO v_hold_count
  FROM public.table_invites
  WHERE table_id = p_table_id AND status = 'pending'
    AND invited_profile_id <> p_user_id
    AND created_at > p_hold_cutoff;

  IF v_active_count + v_hold_count >= 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;

  -- Lowest free seat number 1..4.
  SELECT n INTO v_seat_number
  FROM generate_series(1, 4) AS n
  WHERE n NOT IN (
    SELECT seat_number FROM public.table_seats
    WHERE table_id = p_table_id AND canceled_at IS NULL
  )
  ORDER BY n
  LIMIT 1;
  IF v_seat_number IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;

  INSERT INTO public.table_seats(table_id, user_id, seat_number)
  VALUES (p_table_id, p_user_id, v_seat_number)
  RETURNING id INTO v_seat_id;

  -- Consume this user's own live hold, if any.
  UPDATE public.table_invites
  SET status = 'accepted'
  WHERE table_id = p_table_id AND invited_profile_id = p_user_id AND status = 'pending';

  RETURN jsonb_build_object('ok', true, 'already', false,
    'seat_number', v_seat_number, 'seat_id', v_seat_id,
    'now_full', (v_active_count + 1 >= 4));
END;
$$;

-- create_hold: reserve a capacity slot for an invitee. skipped=true when a live
-- pending hold already exists for this person (the partial unique index).
CREATE OR REPLACE FUNCTION public.create_hold(
  p_table_id uuid,
  p_invited_profile_id uuid,
  p_invited_by uuid,
  p_hold_cutoff timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_count int;
  v_hold_count int;
  v_invite_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('tableseat:' || p_table_id::text)::bigint);

  SELECT count(*) INTO v_active_count
  FROM public.table_seats
  WHERE table_id = p_table_id AND canceled_at IS NULL;

  SELECT count(*) INTO v_hold_count
  FROM public.table_invites
  WHERE table_id = p_table_id AND status = 'pending' AND created_at > p_hold_cutoff;

  IF v_active_count + v_hold_count >= 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'full');
  END IF;

  -- Free the partial-unique slot if this person's prior hold has lapsed (still
  -- 'pending' in the row, but past the TTL). The ONLY place a stale hold is
  -- written terminal, and we already hold the lock.
  UPDATE public.table_invites
  SET status = 'expired'
  WHERE table_id = p_table_id AND invited_profile_id = p_invited_profile_id
    AND status = 'pending' AND created_at <= p_hold_cutoff;

  BEGIN
    INSERT INTO public.table_invites(table_id, invited_profile_id, invited_by_profile_id, status)
    VALUES (p_table_id, p_invited_profile_id, p_invited_by, 'pending')
    RETURNING id INTO v_invite_id;
  EXCEPTION WHEN unique_violation THEN
    -- A live pending hold already exists (someone invited them moments ago, or
    -- they still hold a live seat). Caller treats this as "skipped", not failed.
    RETURN jsonb_build_object('ok', false, 'skipped', true);
  END;

  -- Nudge the league_tables subscription so Open Tables refetches the new hold.
  UPDATE public.league_tables SET updated_at = now() WHERE id = p_table_id;

  RETURN jsonb_build_object('ok', true, 'invite_id', v_invite_id);
END;
$$;

-- create_table_with_holds: create a table, seat its creator (seat 1), and place
-- up to 3 holds — all in ONE transaction (this whole function). The table does
-- not exist until this commits, so there is no window in which it is open with
-- the intended holds unplaced, and nothing can join it mid-flight (no advisory
-- lock needed). Replaces the create route's insert-table -> insert-seat ->
-- manual-delete-on-failure, closing the pre-existing seat-1 window too.
--
-- week_number arrives already server-authoritative: the route derives it (admin
-- override vs. date-derived) and passes the result — this function only stores it,
-- so that logic is unchanged. Validation (date window, area, round type) stays in
-- the route and runs before this is called. Emails are sent by the route AFTER
-- this returns; a hold whose email fails is released there (the seat genuinely
-- reopens), which is why the returned `holds` maps each invitee to its invite id.
CREATE OR REPLACE FUNCTION public.create_table_with_holds(
  p_city_id uuid,
  p_series_id uuid,
  p_creator_id uuid,
  p_week_number int,
  p_table_date date,
  p_table_time time,
  p_location_name text,
  p_location_address text,
  p_area text,
  p_round_type text,
  p_notes text,
  p_invitee_ids uuid[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_table_id uuid;
  v_invitee uuid;
  v_invite_id uuid;
  v_holds jsonb := '[]'::jsonb;
  v_count int := coalesce(array_length(p_invitee_ids, 1), 0);
BEGIN
  -- The creator occupies seat 1, so at creation at most 3 seats can be held.
  -- Enforced here (server-side) as well as in the form (test 18).
  IF v_count > 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'too_many_invitees');
  END IF;

  INSERT INTO public.league_tables(
    city_id, series_id, creator_id, week_number, table_date, table_time,
    location_name, location_address, area, round_type, notes, status
  ) VALUES (
    p_city_id, p_series_id, p_creator_id, p_week_number, p_table_date, p_table_time,
    p_location_name, p_location_address, p_area, p_round_type, p_notes, 'open'
  ) RETURNING id INTO v_table_id;

  INSERT INTO public.table_seats(table_id, user_id, seat_number)
  VALUES (v_table_id, p_creator_id, 1);

  IF p_invitee_ids IS NOT NULL THEN
    FOREACH v_invitee IN ARRAY p_invitee_ids LOOP
      IF v_invitee = p_creator_id THEN CONTINUE; END IF; -- never hold a seat for the host
      BEGIN
        INSERT INTO public.table_invites(table_id, invited_profile_id, invited_by_profile_id, status)
        VALUES (v_table_id, v_invitee, p_creator_id, 'pending')
        RETURNING id INTO v_invite_id;
      EXCEPTION WHEN unique_violation THEN
        CONTINUE; -- same invitee twice in one request; ignore the duplicate
      END;
      v_holds := v_holds || jsonb_build_object('invited_profile_id', v_invitee, 'invite_id', v_invite_id);
    END LOOP;
  END IF;

  RETURN jsonb_build_object('ok', true, 'table_id', v_table_id, 'holds', v_holds);
END;
$$;

-- release_hold: host/inviter releases early, or the invitee declines. Frees
-- capacity (no lock needed — releasing never over-fills). Bumps updated_at so the
-- reopened seat propagates live. RETURNS the released row's inviter + invitee so
-- the decline route can email the inviter ("who declined, seat's open again") —
-- the route emails ONLY when the invitee is the one declining, never on a
-- host/inviter self-release.
CREATE OR REPLACE FUNCTION public.release_hold(
  p_table_id uuid,
  p_invited_profile_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  UPDATE public.table_invites
  SET status = 'declined'
  WHERE table_id = p_table_id AND invited_profile_id = p_invited_profile_id AND status = 'pending'
  RETURNING invited_by_profile_id, invited_profile_id INTO v_row;

  IF FOUND THEN
    UPDATE public.league_tables SET updated_at = now() WHERE id = p_table_id;
    RETURN jsonb_build_object('ok', true, 'released', 1,
      'invited_by_profile_id', v_row.invited_by_profile_id,
      'invited_profile_id', v_row.invited_profile_id);
  END IF;
  RETURN jsonb_build_object('ok', true, 'released', 0);
END;
$$;

-- Server-only: every caller uses the service-role client. No anon/authenticated grant.
REVOKE ALL ON FUNCTION public.claim_seat(uuid, uuid, timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.create_hold(uuid, uuid, uuid, timestamptz) FROM public;
REVOKE ALL ON FUNCTION public.release_hold(uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.create_table_with_holds(uuid, uuid, uuid, int, date, time, text, text, text, text, text, uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_seat(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_hold(uuid, uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_hold(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_table_with_holds(uuid, uuid, uuid, int, date, time, text, text, text, text, text, uuid[]) TO service_role;

COMMIT;
