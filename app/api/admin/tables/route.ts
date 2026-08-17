import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";

export const runtime = "nodejs";

// Admin view of every league table (all cities/series), service-role. Feeds the
// client-filtered /admin/tables page (week / status / city / series dropdowns).
//
// city_id / series_id are returned alongside the names so the page can filter on
// the id, not the label — two cities could share a name, and filtering on a name
// would silently conflate them.

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });

  // Page past PostgREST's 1,000-row cap — we're at ~700 tables and climbing, and a
  // single .select() would silently truncate once we cross it. table_date DESC is
  // the requested order; id ASC is a stable tiebreaker so pagination can't drop or
  // duplicate a row across page boundaries when dates tie.
  const rows = await fetchAllRows((from: number, to: number) =>
    admin
      .from("league_tables")
      .select("id, week_number, table_date, table_time, location_name, status, cities(id, name), series(id, name), profiles(full_name), table_seats(canceled_at)")
      .order("table_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to)
  );

  const tables = (rows as any[]).map((t) => {
    const city = one<any>(t.cities);
    const series = one<any>(t.series);
    return {
      id: t.id,
      week_number: t.week_number,
      table_date: t.table_date,
      table_time: t.table_time,
      location_name: t.location_name,
      status: t.status,
      city_id: city?.id ?? null,
      city_name: city?.name ?? null,
      series_id: series?.id ?? null,
      series_name: series?.name ?? null,
      creator_name: one<any>(t.profiles)?.full_name ?? null,
      active_seats: ((t.table_seats ?? []) as any[]).filter((s) => !s.canceled_at).length,
    };
  });

  return NextResponse.json({ tables });
}
