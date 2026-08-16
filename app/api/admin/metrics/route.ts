import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/session";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { zonedTimeToUtc } from "@/lib/format/zonedTime";

// Live operations metrics for the admin dashboard tiles.
export type AdminMetrics = {
  registrationsThisSeries: number; // all registrations in the active series (paid + pending)
  paidRegistrationsThisSeries: number; // active-series registrations with paid_status = 'paid'
  registrationsAllTime: number;
  activePlayers: number;
  activeCities: number;
  lockedInCities: number; // active cities with >= 20 paid regs in the active series (same rule as the public launch-cities map)
  tableFillRate: number; // 0..1 — filled seats / (4 × active tables)
  revenueThisSeries: number; // USD dollars — succeeded payments only
  revenueThisMonth: number; // USD dollars — succeeded payments only
  revenueToday: number; // USD dollars — succeeded payments created today
  playersByCity: { city: string; paid: number; pending: number }[]; // active-series registrations per city, highest total first
};

const EMPTY_METRICS: AdminMetrics = {
  registrationsThisSeries: 0,
  paidRegistrationsThisSeries: 0,
  registrationsAllTime: 0,
  activePlayers: 0,
  activeCities: 0,
  lockedInCities: 0,
  tableFillRate: 0,
  revenueThisSeries: 0,
  revenueThisMonth: 0,
  revenueToday: 0,
  playersByCity: [],
};

// A table is "active" (its seats count toward fill rate) while it's still
// open or full — not once it's completed or canceled.
const ACTIVE_TABLE_STATUSES = ["open", "full"];
const SEATS_PER_TABLE = 4;

// The org-wide timezone for the "today" / "this month" revenue boundaries. This
// is an admin-facing operational number, not a per-city scheduling time, so a
// single fixed zone is correct — America/Chicago is the site's default/fallback
// city timezone (see app/api/admin/cities/route.ts's DEFAULT_TIMEZONE).
const METRICS_TIMEZONE = "America/Chicago";
const pad = (n: number) => String(n).padStart(2, "0");

// Today's Y/M/D as seen in the given timezone (not the server's own clock).
function todayInTimeZone(timeZone: string): { year: number; month: number; day: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

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
  type CityRow = {
    paid_status: string | null;
    city_id: string | null;
    cities: { name: string | null; state: string | null; is_active: boolean | null } | { name: string | null; state: string | null; is_active: boolean | null }[] | null;
  };
  const cityRows = await fetchAllRows<CityRow>((from, to) => {
    let q = supabase.from("registrations").select("paid_status, city_id, cities(name, state, is_active)");
    if (activeSeriesId) q = q.eq("series_id", activeSeriesId);
    return q.order("created_at", { ascending: true }).range(from, to);
  });
  // Group by city_id (not the display label): there are duplicate-named city rows
  // in the table (e.g. a real "Madison, MS" and an inactive demo one), so keying
  // on the label would merge distinct cities that happen to share a name.
  const cityCountMap = new Map<string, { label: string; paid: number; pending: number; isActive: boolean }>();
  for (const row of cityRows) {
    const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
    const label = city?.name ? (city.state ? `${city.name}, ${city.state}` : city.name) : "No city";
    const key = row.city_id ?? label; // fall back to label only for the rare no-city-id row
    const entry = cityCountMap.get(key) ?? { label, paid: 0, pending: 0, isActive: city?.is_active ?? false };
    if (row.paid_status === "paid") entry.paid += 1;
    else if (row.paid_status === "pending") entry.pending += 1;
    // Other statuses (e.g. refunded) are excluded from the paid/pending split.
    cityCountMap.set(key, entry);
  }
  const playersByCity = Array.from(cityCountMap.values())
    .map((c) => ({ city: c.label, paid: c.paid, pending: c.pending }))
    .sort((a, b) => b.paid + b.pending - (a.paid + a.pending) || a.city.localeCompare(b.city));
  // Locked-in cities — active cities that have hit the 20-paid-player minimum in
  // the active series. SAME threshold + scope as the public launch-cities map
  // (app/api/public/launch-cities: is_active cities, active series, paid >= 20),
  // so this admin number always agrees with the "hit minimum" pins.
  const lockedInCities = Array.from(cityCountMap.values()).filter((c) => c.isActive && c.paid >= 20).length;

  // Table fill rate — filled (non-canceled) seats across all active tables.
  // Both counts filter on league_tables.status via a join rather than collecting
  // every active table ID into an .in() list — with enough tables that list can
  // blow past Supabase's request URL limit and fail, and (see below) that failure
  // was previously swallowed and silently reported as 0%.
  let tableFillRate = 0;
  const { count: activeTableCount, error: activeTableCountError } = await supabase
    .from("league_tables")
    .select("id", { count: "exact", head: true })
    .in("status", ACTIVE_TABLE_STATUSES);
  if (activeTableCountError) {
    console.error("[admin metrics] active table count failed", activeTableCountError);
  }

  if ((activeTableCount ?? 0) > 0) {
    const { count: filledSeats, error: filledSeatsError } = await supabase
      .from("table_seats")
      .select("id, league_tables!inner(status)", { count: "exact", head: true })
      .is("canceled_at", null)
      .in("league_tables.status", ACTIVE_TABLE_STATUSES);
    if (filledSeatsError) {
      console.error("[admin metrics] filled seat count failed", filledSeatsError);
    }
    tableFillRate = (filledSeats ?? 0) / ((activeTableCount ?? 0) * SEATS_PER_TABLE);
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

  // Revenue this month + today — succeeded payments created within the current
  // calendar month. "Today" is derived from the SAME result set (today is always
  // inside the current month) rather than a second query. Central-time
  // calendar-day/month boundaries (America/Chicago), computed via zonedTimeToUtc
  // so they're correct regardless of the server's own clock timezone (UTC on
  // Vercel) — otherwise "today" would roll over at 7PM Central, not midnight.
  const { year, month, day } = todayInTimeZone(METRICS_TIMEZONE);
  const dayStart = zonedTimeToUtc(`${year}-${pad(month)}-${pad(day)}`, "00:00:00", METRICS_TIMEZONE);
  const monthStart = zonedTimeToUtc(`${year}-${pad(month)}-01`, "00:00:00", METRICS_TIMEZONE);
  const nextMonth = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 };
  const monthEnd = zonedTimeToUtc(`${nextMonth.y}-${pad(nextMonth.m)}-01`, "00:00:00", METRICS_TIMEZONE);
  const monthPayments = await fetchAllRows<{ amount_cents: number | null; created_at: string }>((from, to) =>
    supabase
      .from("payments")
      .select("amount_cents, created_at")
      .eq("status", "succeeded")
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", monthEnd.toISOString())
      .order("created_at", { ascending: true })
      .range(from, to)
  );
  const revenueThisMonthCents = monthPayments.reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
  const revenueTodayCents = monthPayments
    .filter((p) => new Date(p.created_at) >= dayStart)
    .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  const metrics: AdminMetrics = {
    registrationsThisSeries,
    paidRegistrationsThisSeries,
    registrationsAllTime,
    activePlayers,
    activeCities,
    lockedInCities,
    tableFillRate,
    revenueThisSeries: revenueThisSeriesCents / 100,
    revenueThisMonth: revenueThisMonthCents / 100,
    revenueToday: revenueTodayCents / 100,
    playersByCity,
  };

  return NextResponse.json({ metrics, adminName });
}
