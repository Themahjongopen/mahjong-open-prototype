import { createAdminClient } from "@/lib/supabase/server";

// Admin view of every league table (all cities/series), service-role.
export type AdminTableRow = {
  id: string;
  week_number: number;
  table_date: string;
  table_time: string | null;
  location_name: string;
  status: string;
  city_name: string | null;
  series_name: string | null;
  creator_name: string | null;
  active_seats: number;
};

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

export async function getAdminTables(): Promise<AdminTableRow[]> {
  const admin: any = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("league_tables")
    .select("id, week_number, table_date, table_time, location_name, status, cities(name), series(name), profiles(full_name), table_seats(canceled_at)")
    .order("table_date", { ascending: false });

  return ((data ?? []) as any[]).map((t) => ({
    id: t.id,
    week_number: t.week_number,
    table_date: t.table_date,
    table_time: t.table_time,
    location_name: t.location_name,
    status: t.status,
    city_name: one<any>(t.cities)?.name ?? null,
    series_name: one<any>(t.series)?.name ?? null,
    creator_name: one<any>(t.profiles)?.full_name ?? null,
    active_seats: ((t.table_seats ?? []) as any[]).filter((s) => !s.canceled_at).length,
  }));
}
