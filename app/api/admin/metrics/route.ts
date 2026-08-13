import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/session";
import { fetchAllRows } from "@/lib/supabase/paginate";

// Live operations metrics for the admin dashboard tiles.
export type AdminMetrics = {
  registrationsThisSeries: number; // all registrations in the active series (paid + pending)
  paidRegistrationsThisSeries: number; // active-series registrations with paid_status = 'paid'
  registrationsAllTime: number;
  activePlayers: number;
  activeCities: number;
  tableFillRate: number; // 0..1 — filled seats / (4 × active tables)
  revenueThisSeries: number; // USD dollars — succeeded payments only
  revenueThisMonth: number; // USD dollars — succeeded payments only
  playersByCity: { city: string; paid: number; pending: number }[]; // active-series registrations per city, highest total first
};

const EMPTY_METRICS: AdminMetrics = {
  registrationsThisSeries: 0,
  paidRegistrationsThisSeries: 0,
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
    paidRegistrationsThisSeries,
    registrationsAllTime,
    activePlayers,
    activeCities,
  ] = await Promise.all([
    activeSeriesId
      ? countExact("registrations", (q) => q.eq("series_id", activeSeriesId))
      : Promise.resolve(0),
    activeSeriesId
      ? countExact("registrations", (q) => q.eq("series_id", activeSeriesId).eq("paid_status", "paid"))
      : Promise.resolve(0),
    countExact("registrations"),
    // Active players — DISTINCT people holding at least one paid registration in
    // a still-active city. Dedupe on lowercased email (not profile_id, which is
    // only set once someone accepts their portal invite — most paid registrants
    // haven't yet, so profile_id would massively undercount). Case-insensitive to
    // match the email matching used elsewhere (e.g. the handle_new_user trigger).
    (async () => {
      const data = await fetchAllRows<{ email: string | null }>((from, to) =>
        supabase
          .from("registrations")
          .select("email, cities!inner(is_active)")
          .eq("paid_status", "paid")
          .eq("cities.is_active", true)
          .order("email", { ascending: true })
          .range(from, to)
      );
      const emails = new Set<string>();
      for (const row of data) {
        if (row.email) emails.add(row.email.toLowerCase());
      }
      return emails.size;
    })(),
    countExact("cities", (q) => q.eq("is_active", true)),
  ]);

  // Registrations by city — scoped to the active series (same cohort as
  // registrationsThisSeries above), split into paid vs pending so the dashboard
  // can show how many players per city are confirmed vs. still owe payment.
  // Falls back to all registrations if no series is currently marked active.
  type CityRow = { paid_status: string | null; city_id: string | null; cities: { name: string | null; state: string | null } | { name: string | null; state: string | null }[] | null };
  const cityRows = await fetchAllRows<CityRow>((from, to) => {
    let q = supabase.from("registrations").select("paid_status, city_id, cities(name, state)");
    if (activeSeriesId) q = q.eq("series_id", activeSeriesId);
    return q.order("created_at", { ascending: true }).range(from, to);
  });
  // Group by city_id (not the display label): there are duplicate-named city rows
  // in the table (e.g. a real "Madison, MS" and an inactive demo one), so keying
  // on the label would merge distinct cities that happen to share a name.
  const cityCountMap = new Map<string, { label: string; paid: number; pending: number }>();
  for (const row of cityRows) {
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
    const label = city?.name ? (city.state ? `${city.name}, ${city.state}` : city.name) : "No city";
    const key = row.city_id ?? label; // fall back to label only for the rare no-city-id row
    const entry = cityCountMap.get(key) ?? { label, paid: 0, pending: 0 };
    if (row.paid_status === "paid") entry.paid += 1;
    else if (row.paid_status === "pending") entry.pending += 1;
    // Other statuses (e.g. refunded) are excluded from the paid/pending split.
    cityCountMap.set(key, entry);
  }
  const playersByCity = Array.from(cityCountMap.values())
    .map((c) => ({ city: c.label, paid: c.paid, pending: c.pending }))
    .sort((a, b) => b.paid + b.pending - (a.paid + a.pending) || a.city.localeCompare(b.city));

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

  // Revenue this series — SUCCEEDED payments only (exclude pending/failed/refunded)
  // joined to registrations in the active series. amount_cents reflects the real
  // amount charged once the webhook writes back session.amount_total, so $0 comps
  // contribute $0.
  let revenueThisSeriesCents = 0;
  if (activeSeriesId) {
    const seriesPayments = await fetchAllRows<{ amount_cents: number | null }>((from, to) =>
      supabase
        .from("payments")
        .select("amount_cents, registrations!inner(series_id)")
        .eq("status", "succeeded")
        .eq("registrations.series_id", activeSeriesId)
        .order("created_at", { ascending: true })
        .range(from, to)
    );
    revenueThisSeriesCents = seriesPayments.reduce(
      (sum: number, p: any) => sum + (p.amount_cents ?? 0),
      0
    );
  }

  // Revenue this month — payments created within the current calendar month.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
  const monthPayments = await fetchAllRows<{ amount_cents: number | null }>((from, to) =>
    supabase
      .from("payments")
      .select("amount_cents")
      .eq("status", "succeeded")
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd)
      .order("created_at", { ascending: true })
      .range(from, to)
  );
  const revenueThisMonthCents = monthPayments.reduce(
    (sum: number, p: any) => sum + (p.amount_cents ?? 0),
    0
  );

  const metrics: AdminMetrics = {
    registrationsThisSeries,
    paidRegistrationsThisSeries,
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
