import { getPortalUser } from "@/lib/portal/session";

// Returns the requesting commissioner's own city id, or null if the caller
// isn't an active, city-assigned commissioner. Callers MUST scope every query
// to this id — never trust a city id from the request itself.
export async function getCommissionerCityId(): Promise<string | null> {
  const session = await getPortalUser();
  if (!session || session.status !== "active") return null;
  if (session.role !== "commissioner" || !session.commissionerCityId) return null;
  return session.commissionerCityId;
}
