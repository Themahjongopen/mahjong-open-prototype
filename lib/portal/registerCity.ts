import { createAdminClient } from "@/lib/supabase/server";
import type { Membership } from "@/lib/portal/playerCity";

export type EligibleCity = { id: string; name: string; state: string | null };
export type ActiveSeries = { id: string; name: string; registration_closes_at: string | null };

export type RegisterCityOptions = {
  series: ActiveSeries | null;
  eligibleCities: EligibleCity[]; // active cities the player is NOT paid in for the active series
  registrationClosed: boolean;
};

// Which additional cities a player can still register for: the active series'
// active cities, minus the ones they already hold a PAID registration in (from
// session.memberships, scoped to that series). Shared by the register-another-
// city page and the entry points that only show up when something is eligible.
export async function getRegisterCityOptions(memberships: Membership[]): Promise<RegisterCityOptions> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return { series: null, eligibleCities: [], registrationClosed: false };

  const [{ data: seriesRows }, { data: cityRows }] = await Promise.all([
    admin.from("series").select("id, name, registration_closes_at").eq("is_active", true).order("starts_at", { ascending: true }).limit(1),
    admin.from("cities").select("id, name, state").eq("is_active", true).order("name", { ascending: true }),
  ]);

  const series = (seriesRows?.[0] ?? null) as ActiveSeries | null;
  if (!series) return { series: null, eligibleCities: [], registrationClosed: false };

  // registration_closes_at is inclusive (open through that day).
  const today = new Date().toISOString().slice(0, 10);
  const registrationClosed = Boolean(series.registration_closes_at && series.registration_closes_at < today);

  const paidCityIds = new Set(memberships.filter((m) => m.series_id === series.id).map((m) => m.city_id));
  const eligibleCities = ((cityRows ?? []) as EligibleCity[]).filter((c) => !paidCityIds.has(c.id));

  return { series, eligibleCities, registrationClosed };
}
