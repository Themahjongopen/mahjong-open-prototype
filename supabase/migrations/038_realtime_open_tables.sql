-- ============================================================================
-- 038 — Realtime for Open Tables
-- ============================================================================
-- The portal's Open Tables page had no live updates: a player parked on the page
-- never saw a newly-created table appear (commissioner reports, Aug 18-19). We
-- add live updates via Supabase Realtime (see components/portal/useOpenTablesRealtime.ts).
--
-- RLS already authorizes delivery: league_tables_member_read and
-- table_seats_member_read (migration 006) let a paid member SELECT their series'
-- rows, and Realtime enforces those same policies per subscriber. An empirical
-- probe confirmed a member subscription reaches SUBSCRIBED but received zero
-- events — the ONLY missing piece was publication membership, which this fixes.
--
-- Additive and low-risk: it changes no data and no table shape. Runs against a
-- live production DB, so every statement is guarded to be a safe no-op on re-run.

-- ---------------------------------------------------------------------------
-- Add the two tables to the Realtime publication.
-- Guarded: `alter publication ... add table` errors if the table is already a
-- member, so only add when absent. Makes the migration idempotent.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'league_tables'
  ) then
    alter publication supabase_realtime add table public.league_tables;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'table_seats'
  ) then
    alter publication supabase_realtime add table public.table_seats;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Replica identity.
--
-- For UPDATE/INSERT, Realtime always delivers the full NEW record, so the
-- subscription filters (league_tables by city_id, table_seats gated client-side
-- by table_id) work at the default replica identity.
--
-- For DELETE, Realtime only has the OLD record, and only the columns in the
-- table's replica identity. league_tables IS hard-deleted in app code
-- (app/api/tables/route.ts create-rollback, app/api/tables/[id]/route.ts remove),
-- and the subscription filters it by `city_id=eq.<city>`. Under the default
-- replica identity (primary key = id only) a DELETE's old record would omit
-- city_id, so Realtime could not match the filter and the delete would never
-- reach the player — a removed table would linger on their screen until a manual
-- refresh. REPLICA IDENTITY FULL makes the delete carry the whole old row,
-- including city_id, so table removals propagate live.
alter table public.league_tables replica identity full;

-- table_seats is NEVER hard-deleted in app code — a leave is a soft cancel
-- (canceled_at UPDATE), whose NEW record carries table_id for the client-side
-- gate. So it needs no replica-identity change, and since table_seats is written
-- on every join and leave, leaving it at DEFAULT avoids logging the full old row
-- to WAL on that hot path. (If seat rows are ever hard-deleted — e.g. a cascade
-- when a parent table is removed — that table's own league_tables DELETE already
-- triggers a refetch for the city, so the seat delete need not be caught.)
--
-- Write-performance note: being in the publication means writes to these tables
-- are also decoded for logical replication — a small, constant per-write cost.
-- REPLICA IDENTITY FULL adds WAL volume only on league_tables UPDATE/DELETE
-- (an infrequent path: tables are created/edited/removed, not written per action),
-- so the impact on the hot table_seats join/leave path is nil.
