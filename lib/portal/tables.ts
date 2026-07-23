import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";

// Server-only read helpers for the portal tables/seats feature. Reads go through
// the service-role client so seat rows can embed profile names (profiles is
// RLS-locked to service-role); every function is scoped to the caller's own
// city+series cohort (or admin). Membership is already established by the portal
// shell layout via getPortalUser(); these add the cohort/authorization filter.

export type SeatRow = {
  id: string;
  user_id: string;
  seat_number: number;
  canceled_at: string | null;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
};

export type LeagueTable = {
  id: string;
  city_id: string;
  series_id: string;
  creator_id: string;
  week_number: number;
  table_date: string;
  table_time: string | null;
  location_name: string;
  location_address: string | null;
  skill_level: string | null;
  round_type: string | null;
  notes: string | null;
  status: string;
  table_seats: SeatRow[];
};

export type MyTableSeat = {
  seat_number: number;
  table: Omit<LeagueTable, "table_seats"> & { table_seats: SeatRow[] };
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export const activeSeats = (seats: SeatRow[]) => seats.filter((s) => !s.canceled_at);

// Open, still-joinable tables in the member's city+series, from today forward.
export async function getOpenTables(member: PortalMember): Promise<LeagueTable[]> {
  const admin: any = createAdminClient();
  if (!admin || !member.series_id || !member.city_id) return [];

  const { data } = await admin
    .from("league_tables")
    .select("id, city_id, series_id, creator_id, week_number, table_date, table_time, location_name, location_address, skill_level, round_type, notes, status, table_seats(id, user_id, seat_number, canceled_at)")
    .eq("series_id", member.series_id)
    .eq("city_id", member.city_id)
    .eq("status", "open")
    .gte("table_date", today())
    .order("week_number", { ascending: true })
    .order("table_date", { ascending: true });

  return (data ?? []) as LeagueTable[];
}

// One table with seat occupants' names. Returns null if not found or the caller
// isn't a member of the table's series (admins may view any).
export async function getTableDetail(id: string, member: PortalMember): Promise<LeagueTable | null> {
  const admin: any = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("league_tables")
    .select("id, city_id, series_id, creator_id, week_number, table_date, table_time, location_name, location_address, skill_level, round_type, notes, status, table_seats(id, user_id, seat_number, canceled_at, profiles(full_name, avatar_url))")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  if (!member.isAdmin && data.series_id !== member.series_id) return null;
  return data as LeagueTable;
}

// Tables the member is actively seated in (creators keep seat 1), newest first.
export async function getMyTables(member: PortalMember): Promise<MyTableSeat[]> {
  const admin: any = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("table_seats")
    .select("seat_number, league_tables(id, city_id, series_id, creator_id, week_number, table_date, table_time, location_name, location_address, skill_level, round_type, notes, status, table_seats(id, user_id, seat_number, canceled_at))")
    .eq("user_id", member.id)
    .is("canceled_at", null);

  const rows = (data ?? []) as { seat_number: number; league_tables: LeagueTable | null }[];
  return rows
    .filter((r) => r.league_tables)
    .map((r) => ({ seat_number: r.seat_number, table: r.league_tables as LeagueTable }))
    .sort((a, b) => b.table.table_date.localeCompare(a.table.table_date));
}

export type NextTable = {
  seat_number: number;
  table: {
    id: string;
    week_number: number;
    table_date: string;
    table_time: string | null;
    location_name: string;
  };
};

// The member's soonest upcoming table — a seat they hold in a non-canceled table
// dated today or later. Scoped to the member's city+series: for admins that's
// their active-city selection (via withAdminCity); for regular players it's
// their own registration cohort, which is a no-op since they only ever sit in
// tables there. Returns null if they have none.
export async function getNextTable(member: PortalMember): Promise<NextTable | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return null;

  let query = admin
    .from("table_seats")
    .select("seat_number, league_tables!inner(id, week_number, table_date, table_time, location_name, city_id, series_id, status)")
    .eq("user_id", member.id)
    .is("canceled_at", null)
    .neq("league_tables.status", "canceled")
    .gte("league_tables.table_date", today())
    .order("table_date", { referencedTable: "league_tables", ascending: true })
    .limit(1);

  if (member.city_id) query = query.eq("league_tables.city_id", member.city_id);
  if (member.series_id) query = query.eq("league_tables.series_id", member.series_id);

  const { data } = await query;
  const row = (data ?? [])[0] as { seat_number: number; league_tables: unknown } | undefined;
  if (!row) return null;

  const t = (Array.isArray(row.league_tables) ? row.league_tables[0] : row.league_tables) as
    | { id: string; week_number: number; table_date: string; table_time: string | null; location_name: string }
    | undefined;
  if (!t) return null;

  return {
    seat_number: row.seat_number,
    table: {
      id: t.id,
      week_number: t.week_number,
      table_date: t.table_date,
      table_time: t.table_time,
      location_name: t.location_name,
    },
  };
}
