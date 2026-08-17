// Shared: what upcoming tables does a player HOST vs. merely hold a seat in, for
// ONE city? Used by the admin change-city move and the admin refund — both remove
// a player from a city and must refuse to strand a table's other players when
// that player is its host. Scoped to open/full tables in that one city,
// today-forward (Central time). Extracted from change-city/route.ts unchanged.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

const UPCOMING_STATUSES = ["open", "full"];

export type UpcomingTable = { id: string; location_name: string; table_date: string; table_time: string | null };
export type CancelableSeat = { seat_id: string; table_id: string; location_name: string; table_date: string; table_time: string | null };

// Today's date (YYYY-MM-DD) as seen in Central time — table_date is a DATE, and a
// UTC-evening "today" would otherwise drop the current day's tables an hour early.
function todayInCentral(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

// The player's upcoming seats in a given city, split into tables she HOSTS
// (creator) vs. seats she merely holds. profileId null → no seats.
export async function loadUpcomingSeats(
  admin: Admin,
  profileId: string | null,
  cityId: string
): Promise<{ hostingTables: UpcomingTable[]; cancelableSeats: CancelableSeat[] }> {
  if (!profileId) return { hostingTables: [], cancelableSeats: [] };
  const { data: seatRows } = await admin
    .from("table_seats")
    .select("id, seat_number, canceled_at, league_tables!inner(id, creator_id, city_id, status, table_date, table_time, location_name)")
    .eq("user_id", profileId)
    .is("canceled_at", null)
    .eq("league_tables.city_id", cityId)
    .in("league_tables.status", UPCOMING_STATUSES)
    .gte("league_tables.table_date", todayInCentral());

  const hostingTables: UpcomingTable[] = [];
  const cancelableSeats: CancelableSeat[] = [];
  for (const s of (seatRows ?? []) as any[]) {
    const t = one<any>(s.league_tables);
    if (!t) continue;
    if (t.creator_id === profileId) hostingTables.push({ id: t.id, location_name: t.location_name, table_date: t.table_date, table_time: t.table_time });
    else cancelableSeats.push({ seat_id: s.id, table_id: t.id, location_name: t.location_name, table_date: t.table_date, table_time: t.table_time });
  }
  return { hostingTables, cancelableSeats };
}
