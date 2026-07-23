import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";

// The city an admin is "acting in" is stored in this cookie. It ONLY selects
// which city's data to show — it is never trusted for access control (RLS /
// service-role checks still gate every action).
export const ADMIN_CITY_COOKIE = "admin_active_city";

export type ActiveCity = { id: string; name: string };

export type AdminContext = {
  seriesId: string | null; // the single active series (one-active-series rule)
  cityId: string | null; // cookie city if still active, else first active city
  cityName: string | null;
  cities: ActiveCity[]; // all active cities, for the switcher
};

const EMPTY: AdminContext = { seriesId: null, cityId: null, cityName: null, cities: [] };

// Resolves the (series, city) an admin is currently acting in. Admins have no
// registration, so there's no home cohort — the series is the single active one
// and the city comes from the admin_active_city cookie (falling back to the
// first active city). Call only for admins; regular members use their own
// session city_id/series_id.
export async function getAdminContext(): Promise<AdminContext> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return EMPTY;

  const [{ data: series }, { data: cityRows }] = await Promise.all([
    admin
      .from("series")
      .select("id")
      .eq("is_active", true)
      .order("starts_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    admin.from("cities").select("id, name").eq("is_active", true).order("name", { ascending: true }),
  ]);

  const cities: ActiveCity[] = (cityRows ?? []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }));
  const cookieCity = (await cookies()).get(ADMIN_CITY_COOKIE)?.value ?? null;
  const chosen = cities.find((c) => c.id === cookieCity) ?? cities[0] ?? null;

  return {
    seriesId: series?.id ?? null,
    cityId: chosen?.id ?? null,
    cityName: chosen?.name ?? null,
    cities,
  };
}

// Returns the member unchanged for regular players. For admins (no home cohort)
// it fills city_id/series_id from the active-city context, so the existing
// city+series-scoped read helpers (getOpenTables, getStandings, …) work without
// special-casing admins at every call site.
export async function withAdminCity(member: PortalMember): Promise<PortalMember> {
  if (!member.isAdmin) return member;
  const ctx = await getAdminContext();
  return { ...member, city_id: ctx.cityId, series_id: ctx.seriesId };
}
