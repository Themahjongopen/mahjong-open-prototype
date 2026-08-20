import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/session";

export const runtime = "nodejs";

// Commissioner-only, single-city-scoped roster: paid + pending registrants in
// the caller's own city, with just enough info to contact them. No portal
// invite state, no admin actions — this route is read-only by design. The
// city filter is applied in the query itself (not client-side), so another
// city's rows are never returned in the payload.
export async function GET() {
  // getPortalUser is cache()-wrapped, so reading the whole session here (rather
  // than only getActiveCommissionerCityId) costs nothing extra — we need the
  // caller's own profile id too, for the "credited to you" filter/count.
  const session = await getPortalUser();
  if (!session || session.status !== "active" || session.role !== "commissioner" || !session.activeCommissionerCityId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cityId = session.activeCommissionerCityId;
  const viewerProfileId = session.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Unavailable right now." }, { status: 503 });
  }

  // LEFT join to profiles (NOT !inner): registrations.profile_id is null until a
  // player confirms their portal account, and this roster must still show every
  // paid/pending registrant — an inner join would silently drop exactly the
  // players a commissioner is most likely asking about. hometown/skill_level are
  // simply blank for anyone without a profile row yet.
  const { data, error } = await supabase
    .from("registrations")
    .select("id, full_name, email, phone, paid_status, created_at, profiles(hometown, skill_level)")
    .eq("city_id", cityId)
    .in("paid_status", ["paid", "pending"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load players." }, { status: 500 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registrations = (data ?? []) as any[];

  // Attribution — WHO each registration is credited to. Fetched in ONE batched
  // query keyed on this page's registration ids (never a per-row lookup), so the
  // endpoint stays 3 queries regardless of roster size — the shape that still
  // holds as cities grow past Denton's ~87. commissioner_profile_id embeds the
  // commissioner's own profile row (its only FK to profiles, so no ambiguity).
  // A NULL commissioner_profile_id is the "genuinely unattributed" record a
  // zero-commissioner city writes; it carries no name and is dropped here, so
  // such a player reads as Unattributed/Pending exactly like one with no row.
  const ids = registrations.map((r) => r.id);
  const attributionsByReg = new Map<string, { profile_id: string; full_name: string | null }[]>();
  if (ids.length > 0) {
    const { data: attrRows } = await supabase
      .from("registration_attributions")
      .select("registration_id, commissioner_profile_id, profiles(full_name)")
      .in("registration_id", ids);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of (attrRows ?? []) as any[]) {
      if (!a.commissioner_profile_id) continue;
      const prof = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      const list = attributionsByReg.get(a.registration_id) ?? [];
      list.push({ profile_id: a.commissioner_profile_id, full_name: prof?.full_name ?? null });
      attributionsByReg.set(a.registration_id, list);
    }
  }

  // City name for the export filename / PDF title (the roster page has no other
  // source for it — the city label lives in the layout's session, not here).
  const { data: city } = await supabase.from("cities").select("name").eq("id", cityId).maybeSingle();
  const cityName: string | null = city?.name ?? null;

  // Supabase embeds a to-one relation as either an object or a single-element
  // array; normalize to one object (or null), same as the admin players route.
  const players = registrations.map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone,
    paid_status: r.paid_status,
    created_at: r.created_at,
    profiles: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) ?? null,
    attributions: (attributionsByReg.get(r.id) ?? []).sort((a, b) =>
      (a.full_name ?? "").localeCompare(b.full_name ?? "")
    ),
  }));

  return NextResponse.json({ players, cityName, viewerProfileId });
}
