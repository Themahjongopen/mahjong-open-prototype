import { cookies } from "next/headers";

export const COMMISSIONER_CITY_COOKIE = "commissioner_active_city";

export type CommissionerCity = { city_id: string; city_name: string | null };

// Picks which of a commissioner's led cities is "active" (which roster they're
// viewing). Same resolution rule as resolvePlayerCity: cookie if it names one
// of their cities, otherwise the first (most-recently-added). For a one-city
// commissioner (the common case, length 1) the cookie is never read.
export async function resolveCommissionerCity(cities: CommissionerCity[]): Promise<CommissionerCity | null> {
  if (cities.length === 0) return null;
  if (cities.length === 1) return cities[0];
  const cookieCity = (await cookies()).get(COMMISSIONER_CITY_COOKIE)?.value ?? null;
  return cities.find((c) => c.city_id === cookieCity) ?? cities[0];
}
