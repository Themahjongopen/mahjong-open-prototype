import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";
import { activeSeats, scoringSeats, type SeatRow, type LeagueTable, type HoldDisplayRow } from "./seats";
import { isHoldActive } from "@/lib/portal/holdExpiry";

// An invitation the member can accept or decline from My Tables: a live (pending +
// unexpired) hold on a still-open table they aren't already seated at.
export type MyInvitation = {
  table: { id: string; week_number: number; table_date: string; table_time: string | null; location_name: string; status: string };
  holdCreatedAt: string; // for the "Held for you until {time}" label (derived, same as the detail page)
  inviterName: string | null;
};

// The member's live invitations. Filters out LAPSED holds here (isHoldActive), so a
// lapsed invitation is never rendered; the tables data layer is the guarantee, the
// card's own timer is only cosmetic. Not scoped to the active city — a player sees
// all their invitations, same as getMyTables returns all their seats.
export async function getMyInvitations(member: PortalMember): Promise<MyInvitation[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("table_invites")
    // table_invites has two FKs to profiles — name the inviter one explicitly.
    .select("created_at, status, invited_by:profiles!invited_by_profile_id(full_name), league_tables(id, week_number, table_date, table_time, location_name, status, table_seats(user_id, canceled_at))")
    .eq("invited_profile_id", member.id)
    .eq("status", "pending");

  const now = Date.now();
  const out: MyInvitation[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    if (!isHoldActive({ status: r.status, created_at: r.created_at }, now)) continue; // lapsed → never shown
    const lt = Array.isArray(r.league_tables) ? r.league_tables[0] : r.league_tables;
    if (!lt || lt.status !== "open") continue; // only a table they can still accept
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alreadySeated = ((lt.table_seats ?? []) as any[]).some((s) => !s.canceled_at && s.user_id === member.id);
    if (alreadySeated) continue; // defensive — they've already joined
    const inviter = Array.isArray(r.invited_by) ? r.invited_by[0] : r.invited_by;
    out.push({
      table: { id: lt.id, week_number: lt.week_number, table_date: lt.table_date, table_time: lt.table_time, location_name: lt.location_name, status: lt.status },
      holdCreatedAt: r.created_at,
      inviterName: inviter?.full_name ?? null,
    });
  }
  return out;
}

// Attach live invitation holds (pending table_invites rows) to a set of tables in
// ONE batched query keyed on their ids — never a per-table lookup, so the list
// stays flat as cities grow. table_invites is server-only (RLS, no policies), so
// this read goes through the service-role client like every other table read.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function attachHolds(admin: any, tables: LeagueTable[]): Promise<LeagueTable[]> {
  if (tables.length === 0) return tables;
  const ids = tables.map((t) => t.id);
  const { data } = await admin
    .from("table_invites")
    // table_invites has TWO FKs to profiles (invited_profile_id + invited_by_
    // profile_id), so the embed MUST name the column or PostgREST 300s on ambiguity.
    .select("table_id, invited_profile_id, status, created_at, profiles!invited_profile_id(full_name)")
    .in("table_id", ids)
    .eq("status", "pending");
  const byTable = new Map<string, HoldDisplayRow[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const list = byTable.get(r.table_id) ?? [];
    list.push({ invited_profile_id: r.invited_profile_id, status: r.status, created_at: r.created_at, full_name: prof?.full_name ?? null });
    byTable.set(r.table_id, list);
  }
  for (const t of tables) t.holds = byTable.get(t.id) ?? [];
  return tables;
}

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

// The series' end date ("YYYY-MM-DD"), used to cap the Create Table date picker
// so a table can't be scheduled after the series ends. Sibling to
// getSeriesStartDate() above — same shape, same graceful-null-on-unavailable
// contract. Reads the real ends_at column (admin-editable at /admin/series)
// rather than assuming a fixed 8-week window from the start date.
export async function getSeriesEndDate(seriesId: string | null): Promise<string | null> {
  if (!seriesId) return null;
  const admin: any = createAdminClient();
  if (!admin) return null;
  const { data: series } = await admin.from("series").select("ends_at").eq("id", seriesId).maybeSingle();
  return series?.ends_at ?? null;
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
    .select("id, city_id, series_id, creator_id, week_number, table_date, table_time, location_name, location_address, area, skill_level, round_type, notes, status, table_seats(id, user_id, seat_number, canceled_at, profiles(full_name, avatar_url, skill_level))")
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
  return attachHolds(admin, (data ?? []) as LeagueTable[]);
}

// Every table in the member's city+series from today forward, regardless of
// status (open/full/completed/canceled). Same forward-looking window as
// getOpenTables — it just drops the status filter; it does NOT surface past
// weeks. Backs the "All" toggle on the tables page.
export async function getAllTables(member: PortalMember): Promise<LeagueTable[]> {
  const admin: any = createAdminClient();
  if (!admin || !member.series_id || !member.city_id) return [];

  const { data } = await tablesInCohortQuery(admin, member, false);
  return attachHolds(admin, (data ?? []) as LeagueTable[]);
}

// One table with seat occupants' names. Returns null if not found or the caller
// isn't a member of the table's series (admins may view any).
export async function getTableDetail(id: string, member: PortalMember): Promise<LeagueTable | null> {
  const admin: any = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("league_tables")
    .select("id, city_id, series_id, creator_id, week_number, table_date, table_time, location_name, location_address, area, skill_level, round_type, notes, status, cities(timezone), table_seats(id, user_id, seat_number, canceled_at, profiles(full_name, avatar_url, skill_level))")
    .eq("id", id)
    .maybeSingle();

  if (!data) return null;
  if (!member.isAdmin && data.series_id !== member.series_id) return null;
  // Flatten the joined city timezone onto the table (venue-local time for the
  // calendar exports + the 24h no-show cutoff).
  const city = Array.isArray(data.cities) ? data.cities[0] : data.cities;
  const table = { ...data, timezone: city?.timezone ?? null } as LeagueTable;
  const [withHolds] = await attachHolds(admin, [table]);
  return withHolds;
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
    .select("seat_number, league_tables(id, city_id, series_id, creator_id, week_number, table_date, table_time, location_name, location_address, area, skill_level, round_type, notes, status, table_seats(id, user_id, seat_number, canceled_at))")
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
//
// Sorting happens in JS, NOT via PostgREST .order(): ordering the root
// table_seats rows by an embedded to-one column (league_tables.table_date) is a
// no-op in PostgREST — .order(referencedTable) only sorts embedded rows, of
// which there is exactly one per seat — so a .limit(1) there would return an
// arbitrary (insertion-order) seat, not the soonest table. We fetch all of the
// member's active upcoming seats and pick the earliest by (date, then time), so
// same-day tables are tie-broken chronologically.
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
    .gte("league_tables.table_date", today());

  if (member.city_id) query = query.eq("league_tables.city_id", member.city_id);
  if (member.series_id) query = query.eq("league_tables.series_id", member.series_id);

  const { data } = await query;

  type Row = {
    seat_number: number;
    table: { id: string; week_number: number; table_date: string; table_time: string | null; location_name: string };
  };
  const rows: Row[] = ((data ?? []) as { seat_number: number; league_tables: unknown }[])
    .map((r) => {
      const t = (Array.isArray(r.league_tables) ? r.league_tables[0] : r.league_tables) as
        | { id: string; week_number: number; table_date: string; table_time: string | null; location_name: string }
        | undefined;
      return t ? { seat_number: r.seat_number, table: t } : null;
    })
    .filter((r): r is Row => r !== null);

  if (rows.length === 0) return null;

  // Earliest date, then earliest time (nulls last so a timed table beats an
  // untimed one on the same day).
  rows.sort((a, b) => {
    if (a.table.table_date !== b.table.table_date) return a.table.table_date < b.table.table_date ? -1 : 1;
    const at = a.table.table_time ?? "99:99:99";
    const bt = b.table.table_time ?? "99:99:99";
    return at < bt ? -1 : at > bt ? 1 : 0;
  });

  const { seat_number, table } = rows[0];
  return {
    seat_number,
    table: {
      id: table.id,
      week_number: table.week_number,
      table_date: table.table_date,
      table_time: table.table_time,
      location_name: table.location_name,
    },
  };
}
