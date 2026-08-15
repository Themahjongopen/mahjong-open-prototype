import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";

export const runtime = "nodejs";

// Admin-only attributed-revenue report: one row per commissioner per city per
// series. Revenue is FRACTIONAL — a split registration contributes
// amount_cents × weight to each commissioner, so we multiply, never count.
//
// GROSS figures: these are before Stripe fees (~2.9% + 30¢). Refunds are excluded
// at READ TIME (paid_status filter) — the payments row is left truthful — and the
// refunded amount is surfaced on its own line so a dropped total is explained.
//
// Direct vs. organic split comes from `source`: link/dropdown/backfill/manual are
// direct; organic_split is the shared pool. commissioner_profile_id = NULL rolls
// up into a per-city "Unattributed" row.

const DIRECT_SOURCES = new Set(["link", "dropdown", "backfill", "manual"]);
const UNATTRIBUTED = "__unattributed__";

type Bucket = {
  commissioner_profile_id: string | null;
  commissioner_name: string | null;
  city_id: string;
  city_name: string;
  direct_cents: number;
  direct_players: Set<string>;
  organic_cents: number;
  organic_players: Set<string>;
  organic_ways: Set<number>; // round(1/weight): 2-way, 3-way, …
  refunded_cents: number;
  refunded_players: Set<string>;
};

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });

  // Series list for the filter. ORDER BY starts_at DESC — the same convention
  // /api/admin/metrics uses. (NOTE: this DISAGREES with the registration flow,
  // which picks the EARLIEST active series (ASC) as the modal default — see the
  // response note; it matters once Series Two opens alongside Series One.)
  const { data: seriesRows } = await admin
    .from("series")
    .select("id, name, starts_at")
    .order("starts_at", { ascending: false });
  const series = (seriesRows ?? []) as Array<{ id: string; name: string; starts_at: string | null }>;

  const requested = new URL(request.url).searchParams.get("series_id");
  const selectedSeriesId = (requested && series.some((s) => s.id === requested) ? requested : series[0]?.id) ?? null;
  if (!selectedSeriesId) return NextResponse.json({ series, selectedSeriesId: null, cities: [] });

  // City-wide paid-player counts (distinct paid registrations per city), so Shari
  // sees the count where she picks the percentage. Counted from registrations
  // directly (not attributions) so it's truthful even for rows not yet attributed.
  const regRows = await fetchAllRows((from: number, to: number) =>
    admin
      .from("registrations")
      .select("id, paid_status, city_id, cities(name, state)")
      .eq("series_id", selectedSeriesId)
      .order("id", { ascending: true })
      .range(from, to)
  );
  const cityPaidPlayers = new Map<string, Set<string>>();
  const cityMeta = new Map<string, string>(); // city_id -> "Name, ST"
  for (const r of (regRows ?? []) as any[]) {
    const c = Array.isArray(r.cities) ? r.cities[0] : r.cities;
    if (r.city_id) cityMeta.set(r.city_id, c ? `${c.name}${c.state ? `, ${c.state}` : ""}` : "—");
    if (r.paid_status === "paid" && r.city_id) {
      const set = cityPaidPlayers.get(r.city_id) ?? new Set<string>();
      set.add(r.id);
      cityPaidPlayers.set(r.city_id, set);
    }
  }

  // Attribution rows for this series, with the commissioner name, the registration
  // (paid_status + city), and the registration's payments (to read amount_cents).
  const attrRows = await fetchAllRows((from: number, to: number) =>
    admin
      .from("registration_attributions")
      .select(
        "commissioner_profile_id, weight, source, profiles(full_name), registrations!inner(id, paid_status, city_id, payments(amount_cents, status))"
      )
      .eq("registrations.series_id", selectedSeriesId)
      .order("id", { ascending: true })
      .range(from, to)
  );

  // Distinct PAID registrations that carry an attribution row, per city — so the
  // page can warn when a city's attributed count is below its paid-player count
  // (i.e. the pre-attribution backfill hasn't reached everyone). Without this,
  // Memphis reads $80 against 33 paid players with nothing saying it's partial.
  const cityAttributedPaid = new Map<string, Set<string>>();

  const buckets = new Map<string, Bucket>();
  for (const a of (attrRows ?? []) as any[]) {
    const reg = Array.isArray(a.registrations) ? a.registrations[0] : a.registrations;
    if (!reg || !reg.city_id) continue;
    if (reg.paid_status === "paid") {
      const s = cityAttributedPaid.get(reg.city_id) ?? new Set<string>();
      s.add(reg.id);
      cityAttributedPaid.set(reg.city_id, s);
    }
    const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
    // amount = the registration's SUCCEEDED payment (what Stripe actually collected).
    const payments = (reg.payments ?? []) as Array<{ amount_cents: number | null; status: string | null }>;
    const succeeded = payments.find((p) => p.status === "succeeded");
    const amount = succeeded?.amount_cents ?? 0;
    const weight = Number(a.weight ?? 0);
    const contribution = amount * weight;

    const commId = a.commissioner_profile_id as string | null;
    const key = (commId ?? UNATTRIBUTED) + "|" + reg.city_id;
    let b = buckets.get(key);
    if (!b) {
      b = {
        commissioner_profile_id: commId,
        commissioner_name: prof?.full_name ?? null,
        city_id: reg.city_id,
        city_name: cityMeta.get(reg.city_id) ?? "—",
        direct_cents: 0, direct_players: new Set(),
        organic_cents: 0, organic_players: new Set(), organic_ways: new Set(),
        refunded_cents: 0, refunded_players: new Set(),
      };
      buckets.set(key, b);
    }

    if (reg.paid_status === "paid") {
      if (DIRECT_SOURCES.has(a.source)) {
        b.direct_cents += contribution;
        b.direct_players.add(reg.id);
      } else {
        b.organic_cents += contribution;
        b.organic_players.add(reg.id);
        if (weight > 0) b.organic_ways.add(Math.round(1 / weight));
      }
    } else if (reg.paid_status === "refunded") {
      b.refunded_cents += contribution;
      b.refunded_players.add(reg.id);
    }
    // pending: not revenue, ignored.
  }

  // Group buckets by city; commissioners sorted by name, Unattributed last.
  const cityGroups = new Map<string, any>();
  for (const b of buckets.values()) {
    let g = cityGroups.get(b.city_id);
    if (!g) {
      g = { city_id: b.city_id, city_name: b.city_name, paid_player_count: cityPaidPlayers.get(b.city_id)?.size ?? 0, attributed_paid_count: cityAttributedPaid.get(b.city_id)?.size ?? 0, rows: [] };
      cityGroups.set(b.city_id, g);
    }
    g.rows.push({
      commissioner_profile_id: b.commissioner_profile_id,
      commissioner_name: b.commissioner_name,
      is_unattributed: b.commissioner_profile_id === null,
      direct_cents: Math.round(b.direct_cents),
      direct_players: b.direct_players.size,
      organic_cents: Math.round(b.organic_cents),
      organic_players: b.organic_players.size,
      organic_ways: [...b.organic_ways].sort((x, y) => x - y),
      refunded_cents: Math.round(b.refunded_cents),
      refunded_players: b.refunded_players.size,
      total_cents: Math.round(b.direct_cents + b.organic_cents),
    });
  }

  const cities = [...cityGroups.values()].sort((a, b) => a.city_name.localeCompare(b.city_name));
  for (const c of cities) {
    c.rows.sort((a: any, b: any) => {
      if (a.is_unattributed !== b.is_unattributed) return a.is_unattributed ? 1 : -1; // unattributed last
      return (a.commissioner_name ?? "").localeCompare(b.commissioner_name ?? "");
    });
    c.city_total_cents = c.rows.reduce((s: number, r: any) => s + r.total_cents, 0);
  }

  return NextResponse.json({ series, selectedSeriesId, cities });
}
