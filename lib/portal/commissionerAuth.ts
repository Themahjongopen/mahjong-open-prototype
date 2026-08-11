import { getPortalUser } from "@/lib/portal/session";

// Returns the city the requesting commissioner is currently viewing (resolved
// from the possibly-multi-city set in commissioner_cities, cookie-aware), or
// null if the caller isn't an active commissioner. Callers MUST scope every
// query to this id — never trust a city id from the request itself.
export async function getActiveCommissionerCityId(): Promise<string | null> {
  const session = await getPortalUser();
  if (!session || session.status !== "active") return null;
  if (session.role !== "commissioner" || !session.activeCommissionerCityId) return null;
  return session.activeCommissionerCityId;
}
