import { cookies } from "next/headers";

// The city a multi-city player is currently viewing, stored in this cookie. Like
// ADMIN_CITY_COOKIE it ONLY selects which city's data to show — it is never
// trusted for access control (RLS / service-role checks still gate every read).
// A single-city player never has this cookie consulted (see resolvePlayerCity's
// early return), so their experience is byte-identical to before Stage 2.
export const PLAYER_CITY_COOKIE = "player_active_city";

// One of a player's paid registrations, reduced to what the portal needs to
// scope reads and render the city switcher. Built + deduped by city (most recent
// first) in getPortalUser.
export type Membership = {
  city_id: string;
  city_name: string | null;
  series_id: string | null;
};

export type PlayerCity = {
  city_id: string | null;
  city_name: string | null;
  series_id: string | null;
};

// Picks which membership is "active": the player_active_city cookie if it names
// one of the player's cities, otherwise the most recent registration
// (memberships is passed already ordered created_at DESC, so memberships[0] is
// the latest — today's behavior). For a single-city player (length 1) or an
// admin with no registration (length 0) the cookie is never read and the sole /
// no membership is returned as-is, so resolution is byte-identical to the old
// latest-only behavior.
export async function resolvePlayerCity(memberships: Membership[]): Promise<PlayerCity> {
  const latest = memberships[0] ?? null;
  if (memberships.length <= 1) {
    return {
      city_id: latest?.city_id ?? null,
      city_name: latest?.city_name ?? null,
      series_id: latest?.series_id ?? null,
    };
  }

  const cookieCity = (await cookies()).get(PLAYER_CITY_COOKIE)?.value ?? null;
  const chosen = memberships.find((m) => m.city_id === cookieCity) ?? latest;
  return {
    city_id: chosen?.city_id ?? null,
    city_name: chosen?.city_name ?? null,
    series_id: chosen?.series_id ?? null,
  };
}
