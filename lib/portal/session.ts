import { cache } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { resolvePlayerCity, type Membership } from "@/lib/portal/playerCity";

export type PortalMember = {
  status: "active";
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  isCommissioner: boolean;
  // The one city this commissioner belongs to (migration 020). Null for everyone
  // else — and the only city a commissioner may ever see the roster of.
  commissionerCityId: string | null;
  isAdmin: boolean;
  // The player's active city+series (cookie-resolved for multi-city players;
  // their sole registration otherwise). Downstream read helpers scope by these.
  city_id: string | null;
  series_id: string | null;
  // Every distinct city the player holds a paid registration in (most recent
  // first). Length > 1 drives the city switcher; length <= 1 keeps the pre-Stage-2
  // single-city behavior. Empty for admins (no registration).
  memberships: Membership[];
};

// Authenticated but no paid registration (unpaid / unknown email) -> "register first".
export type PortalPending = { status: "unpaid"; email: string };
export type PortalSession = PortalMember | PortalPending | null;

// Resolves the current portal user from the Supabase session, then loads their
// profile + paid membership via the service-role client (profiles/registrations
// are RLS-locked to service-role). Memoized per render pass.
export const getPortalUser = cache(async (): Promise<PortalSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin: any = createAdminClient();
  if (!admin) {
    // Supabase unconfigured (local preview): treat the session as pending.
    return { status: "unpaid", email: user.email ?? "" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, role, commissioner_city_id")
    .eq("id", user.id)
    .maybeSingle();

  // All paid registrations for this account (most recent first). A player may
  // now hold one per city within a series (migration 019), so this is a list.
  const { data: paidRows } = await admin
    .from("registrations")
    .select("city_id, series_id, created_at, cities(name)")
    .eq("profile_id", user.id)
    .eq("paid_status", "paid")
    .order("created_at", { ascending: false });

  // Reduce to one membership per distinct city, keeping the most recent (list is
  // already created_at DESC). memberships[0] is therefore the latest city — the
  // same row the old .limit(1) query returned.
  const memberships: Membership[] = [];
  const seenCities = new Set<string>();
  for (const row of (paidRows ?? []) as Array<{ city_id: string | null; series_id: string | null; cities: { name: string } | { name: string }[] | null }>) {
    if (!row.city_id || seenCities.has(row.city_id)) continue;
    seenCities.add(row.city_id);
    const cityName = Array.isArray(row.cities) ? (row.cities[0]?.name ?? null) : (row.cities?.name ?? null);
    memberships.push({ city_id: row.city_id, city_name: cityName, series_id: row.series_id ?? null });
  }

  const role = profile?.role ?? "player";
  const isAdmin = role === "admin";

  // Admins always get in; everyone else needs a paid registration.
  if (memberships.length === 0 && !isAdmin) {
    return { status: "unpaid", email: user.email ?? profile?.email ?? "" };
  }

  // Resolve which city the player is acting in. For a single-city player this is
  // just their one membership (no cookie read) — identical to the old behavior.
  const active = await resolvePlayerCity(memberships);

  return {
    status: "active",
    id: user.id,
    full_name: profile?.full_name ?? null,
    email: user.email ?? profile?.email ?? "",
    role,
    isCommissioner: role === "commissioner",
    commissionerCityId: profile?.commissioner_city_id ?? null,
    isAdmin,
    city_id: active.city_id,
    series_id: active.series_id,
    memberships,
  };
});
