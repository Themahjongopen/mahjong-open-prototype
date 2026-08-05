import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";
import { activeSeats, scoringSeats, type SeatRow, type LeagueTable } from "./seats";

// Server-only read helpers for the portal tables/seats feature. Reads go through
// the service-role client so seat rows can embed profile names (profiles is
// RLS-locked to service-role); every function is scoped to the caller's own
// city+series cohort (or admin). Membership is already established by the portal
// shell layout via getPortalUser(); these add the cohort/authorization filter.
//
// The pure seat shapes/helpers (SeatRow, LeagueTable, activeSeats, scoringSeats)
// live in ./seats — which has no server-only imports — and are re-exported here
// so callers can keep importing them from "@/lib/portal/tables". Client
// components must import scoringSeats from ./seats directly (importing it from
// here would pull this module's server-only createAdminClient into the browser).
export { activeSeats, scoringSeats };
export type { SeatRow, LeagueTable };

export type MyTableSeat = {
  seat_number: number;
  table: Omit<LeagueTable, "table_seats"> & { table_seats: SeatRow[] };
};

// Resolve a city's display name from its id — used to label the tables/create
// screens with the active city (same lookup getStandings() does for Standings).
export async function getCityName(cityId: string | null): Promise<string | null> {
  if (!cityId) return null;
  const admin: any = createAdminClient();
  if (!admin) return null;
  const { data: city } = await admin.from("cities").select("name").eq("id", cityId).maybeSingle();
  return city?.name ?? null;
}

// The series' start date ("YYYY-MM-DD"), used to auto-fill the round/week number
// from a table's calendar date on the Create Table form. Null if unavailable —
// callers must degrade gracefully (the round stays a manual pick).
export async function getSeriesStartDate(seriesId: string | null): Promise<string | null> {
  if (!seriesId) return null;
  const admin: any = createAdminClient();
  if (!admin) return null;
  const { data: series } = await admin.from("series").select("starts_at").eq("id", seriesId).maybeSingle();
  return series?.starts_at ?? null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Shared query for the city+series table list, from today forward. `openOnly`
// gates the `status = 'open'` filter so getOpenTables and getAllTables share one
// select string + sort order. Sort: round, then date, then time ascending — the
// table_time key is what keeps same-date tables in chronological (not insertion)
// order on the Open Tables / All views.
function tablesInCohortQuery(admin: any, member: PortalMember, openOnly: boolean) {
  let query = admin
    .from("league_tables")
    .select("id, city_id, series_id, creator_id, week_number, table_date, table_time, location_name, location_address, skill_level, round_type, notes, status, table_seats(id, user_id, seat_number, canceled_at, profiles(full_name, avatar_url, skill_level))")
    .eq("series_id", member.series_id)
    .eq("city_id", member.city_id);
  if (openOnly) query = query.eq("status", "open");
  return query
    .gte("table_date", today())
    .order("week_number", { ascending: true })
    .order("table_date", { ascending: true })
    .order("table_time", { ascending: true });
}

// Open, still-joinable tables in the member's city+series, from today forward.
export async function getOpenTables(member: PortalMember): Promise<LeagueTable[]> {
  const admin: any = createAdminClient();
  if (!admin || !member.series_id || !member.city_id) return [];

  const { data } = await tablesInCohortQuery(admin, member, true);
  return (data ?? []) as LeagueTable[];
}

// Every table in the member's city+series from today forward, regardless of
// status (open/full/completed/canceled). Same forward-looking window as
// getOpenTables — it just drops the status filter; it does NOT surface past
// weeks. Backs the "All" toggle on the tables page.
export async function getAllTables(member: PortalMember): Promise<LeagueTable[]> {
  const admin: any = createAdminClient();
  if (!admin || !member.series_id || !member.city_id) return [];

  const { data } = await tablesInCohortQuery(admin, member, false);
  return (data ?? []) as LeagueTable[];
}

// One table with seat occupants' names. Returns null if not found or the caller
// isn't a member of the table's series (admins may view any).
export async function getTableDetail(id: string, member: PortalMember): Promise<LeagueTable | null> {
  const admin: any = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("league_tables")
    .select("id, city_id, series_id, creator_id, week_number, table_date, table_time, location_name, location_address, skill_level, round_type, notes, status, cities(timezone), table_seats(id, user_id, seat_number, canceled_at, profiles(full_name, avatar_url, skill_level))")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  if (!member.isAdmin && data.series_id !== member.series_id) return null;
  // Flatten the joined city timezone onto the table (venue-local time for the
  // calendar exports + the 24h no-show cutoff).
  const city = Array.isArray(data.cities) ? data.cities[0] : data.cities;
  return { ...data, timezone: city?.timezone ?? null } as LeagueTable;
}

// Tables the member is actively seated in (creators keep seat 1). Returned
// unsorted — the caller splits these into Upcoming/Past and sorts each bucket in
// its own direction (soonest-first vs most-recent-first), so a single order here
// would be wrong for one of them.
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
    .map((r) => ({ seat_number: r.seat_number, table: r.league_tables as LeagueTable }));
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
    .in("league_tables.status", ["open", "full"])
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
