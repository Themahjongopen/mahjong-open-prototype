-- ============================================================
-- THE MAHJONG OPEN — 047: record_past_round (admin one-step historical round)
-- ============================================================
-- One admin action creates a COMPLETED, SCORED table for a round that already
-- happened (support cases: host no-showed, players swapped tables, two rounds
-- entered on one table). The whole thing runs in ONE transaction (this function
-- body), so a failure at ANY step rolls the entire thing back — no orphaned
-- table, seats, or submission. A half-created historical table is worse than
-- none, and PostgREST can't wrap separate .rpc() calls in a transaction, which is
-- exactly why this exists as a single RPC rather than being composed in the route.
--
-- Reuses the existing primitives rather than a parallel path:
--   * create_table_with_holds(..., '{}') — an EMPTY invitee array means it just
--     inserts the table (status 'open') and seats the host at seat 1, with no
--     holds and no updated_at nudge (only the hold paths bump updated_at).
--   * claim_seat — capacity-safe seating for the other three. No holds exist, so
--     the hold cutoff is irrelevant; now() is passed.
-- Then it flips status to 'completed' and writes the score submission with the
-- SAME row shape as POST /api/scores: a normal round stores each round_score;
-- a no-show round stores is_no_show (round_score 0) for the absent player(s) and
-- is_no_show_bonus (round_score 0) for the rest — the −20 penalty is derived on
-- read by the standings views, never stored. No emails, no held seats, no
-- deliberate Realtime broadcast.
--
-- ALL validation (admin-only, cohort membership, four distinct players, host among
-- them, date within [starts_at, ends_at], NOT a future date, server-derived week)
-- happens in the route BEFORE this is called. This function is the atomic writer;
-- it re-checks only the invariants cheap to assert here (4 seats, 4 player rows).

CREATE OR REPLACE FUNCTION public.record_past_round(
  p_city_id uuid,
  p_series_id uuid,
  p_host_id uuid,
  p_week_number int,
  p_table_date date,
  p_table_time time,
  p_location_name text,
  p_location_address text,
  p_area text,
  p_round_type text,
  p_submitted_by uuid,
  p_other_ids uuid[],   -- exactly 3, the non-host players (seated via claim_seat)
  p_players jsonb       -- 4 rows: {user_id, round_score, is_no_show, is_no_show_bonus}
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_create jsonb;
  v_table_id uuid;
  v_other uuid;
  v_seat jsonb;
  v_submission_id uuid;
  v_seat_count int;
  v_player_count int;
  v_matched int;
BEGIN
  IF coalesce(array_length(p_other_ids, 1), 0) <> 3 THEN
    RAISE EXCEPTION 'record_past_round: expected exactly 3 non-host players, got %', coalesce(array_length(p_other_ids, 1), 0);
  END IF;

  -- 1) Table + host seat (seat 1). Empty invitee array => no holds, no updated_at nudge.
  v_create := public.create_table_with_holds(
    p_city_id, p_series_id, p_host_id, p_week_number, p_table_date, p_table_time,
    p_location_name, p_location_address, p_area, p_round_type, NULL, '{}'::uuid[]
  );
  IF coalesce(v_create->>'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'record_past_round: table creation failed (%)', coalesce(v_create->>'error', 'unknown');
  END IF;
  v_table_id := (v_create->>'table_id')::uuid;

  -- 2) Seat the other three (capacity-safe). Any failure aborts the whole txn.
  FOREACH v_other IN ARRAY p_other_ids LOOP
    v_seat := public.claim_seat(v_table_id, v_other, now());
    IF coalesce(v_seat->>'ok', 'false') <> 'true' THEN
      RAISE EXCEPTION 'record_past_round: seating % failed (%)', v_other, coalesce(v_seat->>'error', 'unknown');
    END IF;
  END LOOP;

  -- Defence in depth: exactly 4 active seats before it's marked played.
  SELECT count(*) INTO v_seat_count
  FROM public.table_seats
  WHERE table_id = v_table_id AND canceled_at IS NULL;
  IF v_seat_count <> 4 THEN
    RAISE EXCEPTION 'record_past_round: expected 4 seats, got %', v_seat_count;
  END IF;

  -- The four score rows must be EXACTLY the four seated players — asserted here at
  -- the atomic boundary, not only in the route. Counts the distinct p_players
  -- user_ids that are actually seated at this table; with 4 seats confirmed above,
  -- a result of 4 means the two sets are equal. A score row for an unseated user,
  -- a duplicate, or a missing seated player yields < 4 and aborts the whole txn —
  -- so scores can never be attributed to anyone who wasn't seated.
  SELECT count(*) INTO v_matched
  FROM (SELECT DISTINCT (x->>'user_id')::uuid AS uid FROM jsonb_array_elements(p_players) x) d
  WHERE d.uid IN (
    SELECT user_id FROM public.table_seats WHERE table_id = v_table_id AND canceled_at IS NULL
  );
  IF v_matched <> 4 THEN
    RAISE EXCEPTION 'record_past_round: the four score rows must match the four seated players (matched %)', v_matched;
  END IF;

  -- 3) Mark completed. Plain status update — no updated_at touch (only the hold
  --    paths bump it), so no deliberate Realtime push for a historical record.
  UPDATE public.league_tables SET status = 'completed' WHERE id = v_table_id;

  -- 4) Score submission + the four player rows (same shape as POST /api/scores).
  INSERT INTO public.score_submissions(table_id, submitted_by, status)
  VALUES (v_table_id, p_submitted_by, 'submitted')
  RETURNING id INTO v_submission_id;

  INSERT INTO public.score_submission_players(
    score_submission_id, user_id, round_score, is_no_show, is_no_show_bonus
  )
  SELECT v_submission_id, x.user_id, x.round_score, x.is_no_show, x.is_no_show_bonus
  FROM jsonb_to_recordset(p_players)
    AS x(user_id uuid, round_score int, is_no_show boolean, is_no_show_bonus boolean);

  GET DIAGNOSTICS v_player_count = ROW_COUNT;
  IF v_player_count <> 4 THEN
    RAISE EXCEPTION 'record_past_round: expected 4 player rows, got %', v_player_count;
  END IF;

  RETURN jsonb_build_object('ok', true, 'table_id', v_table_id, 'submission_id', v_submission_id);
END;
$$;

-- Server-only: the route calls this with the service-role client, matching 044.
REVOKE ALL ON FUNCTION public.record_past_round(uuid, uuid, uuid, int, date, time, text, text, text, text, uuid, uuid[], jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.record_past_round(uuid, uuid, uuid, int, date, time, text, text, text, text, uuid, uuid[], jsonb) TO service_role;
