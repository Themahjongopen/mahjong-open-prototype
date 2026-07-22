import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/session";

// Live operations metrics for the admin dashboard tiles.
export type AdminMetrics = {
  registrationsThisSeries: number;
  registrationsAllTime: number;
  activePlayers: number;
  activeCities: number;
  tableFillRate: number; // 0..1 — filled seats / (4 × active tables)
  revenueThisSeries: number; // USD dollars
  revenueThisMonth: number; // USD dollars
  playersByCity: { city: string; count: number }[]; // registrations in the active series, grouped by city, highest first
};

const EMPTY_METRICS: AdminMetrics = {
  registrationsThisSeries: 0,
  registrationsAllTime: 0,
  activePlayers: 0,
  activeCities: 0,
  tableFillRate: 0,
  revenueThisSeries: 0,
  revenueThisMonth: 0,
  playersByCity: [],
};

// A table is "active" (its seats count toward fill rate) while it's still
// open or full — not once it's completed or canceled.
const ACTIVE_TABLE_STATUSES = ["open", "full"];
const SEATS_PER_TABLE = 4;

export async function GET() {
  const session = await getPortalUser();
  if (!session || session.status !== "active" || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const adminName = session.full_name ?? null;

  // registrations / series / payments / league_tables aren't all in the generated
  // Database types, so use an untyped client (same pattern as /api/admin/players).
  const supabase: any = createAdminClient();
  if (!supabase) {
    // Local preview without a service-role key: return zeros rather than error.
    return NextResponse.json({ metrics: EMPTY_METRICS, adminName });
  }

  const countExact = async (
    table: string,
    build?: (q: any) => any
  ): Promise<number> => {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (build) query = build(query);
    const { count } = await query;
    return count ?? 0;
  };

  // Currently active series (latest by start date if more than one is flagged).
  const { data: activeSeries } = await supabase
    .from("series")
    .select("id")
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeSeriesId: string | null = activeSeries?.id ?? null;

  // Counts (run concurrently).
  const [
    registrationsThisSeries,
    registrationsAllTime,
    activePlayers,
    activeCities,
  ] = await Promise.all([
    activeSeriesId
      ? countExact("registrations", (q) => q.eq("series_id", activeSeriesId))
      : Promise.resolve(0),
    countExact("registrations"),
    countExact("profiles", (q) => q.neq("role", "admin")),
    countExact("cities", (q) => q.eq("is_active", true)),
  ]);

  // Registrations by city — scoped to the active series (same cohort as
  // registrationsThisSeries above) so it answers "how many players per city
  // are registered for the current series." Falls back to all registrations
  // if no series is currently marked active.
  let cityCountQuery = supabase.from("registrations").select("cities(name, state)");
  if (activeSeriesId) cityCountQuery = cityCountQuery.eq("series_id", activeSeriesId);
  const { data: cityRows } = (await cityCountQuery) as {
    data: { cities: { name: string | null; state: string | null } | { name: string | null; state: string | null }[] | null }[] | null;
  };
  const cityCountMap = new Map<string, number>();
  for (const row of cityRows ?? []) {
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
    const label = city?.name ? (city.state ? `${city.name}, ${city.state}` : city.name) : "No city";
    cityCountMap.set(label, (cityCountMap.get(label) ?? 0) + 1);
  }
  const playersByCity = Array.from(cityCountMap.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count || a.city.localeCompare(b.city));

  // Table fill rate — filled (non-canceled) seats across all active tables.
  let tableFillRate = 0;
  const { data: activeTables } = await supabase
    .from("league_tables")
    .select("id")
    .in("status", ACTIVE_TABLE_STATUSES);
  const activeTableIds: string[] = (activeTables ?? []).map((t: any) => t.id);
  if (activeTableIds.length > 0) {
    const filledSeats = await countExact("table_seats", (q) =>
      q.is("canceled_at", null).in("table_id", activeTableIds)
    );
    tableFillRate = filledSeats / (activeTableIds.length * SEATS_PER_TABLE);
  }

  // Revenue this series — payments joined to registrations in the active series.
  let revenueThisSeriesCents = 0;
  if (activeSeriesId) {
    const { data: seriesPayments } = await supabase
      .from("payments")
      .select("amount_cents, registrations!inner(series_id)")
      .eq("registrations.series_id", activeSeriesId);
    revenueThisSeriesCents = (seriesPayments ?? []).reduce(
      (sum: number, p: any) => sum + (p.amount_cents ?? 0),
      0
    );
  }

  // Revenue this month — payments created within the current calendar month.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const { data: monthPayments } = await supabase
    .from("payments")
    .select("amount_cents")
    .gte("created_at", monthStart)
    .lt("created_at", monthEnd);
  const revenueThisMonthCents = (monthPayments ?? []).reduce(
    (sum: number, p: any) => sum + (p.amount_cents ?? 0),
    0
  );

  const metrics: AdminMetrics = {
    registrationsThisSeries,
    registrationsAllTime,
    activePlayers,
    activeCities,
    tableFillRate,
    revenueThisSeries: revenueThisSeriesCents / 100,
    revenueThisMonth: revenueThisMonthCents / 100,
    playersByCity,
  };

  return NextResponse.json({ metrics, adminName });
}
