import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getActiveCommissionerCityId } from "@/lib/portal/commissionerAuth";

export const runtime = "nodejs";

// Commissioner-only, single-city-scoped roster: paid + pending registrants in
// the caller's own city, with just enough info to contact them. No portal
// invite state, no admin actions — this route is read-only by design. The
// city filter is applied in the query itself (not client-side), so another
// city's rows are never returned in the payload.
export async function GET() {
  const cityId = await getActiveCommissionerCityId();
  if (!cityId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // City name for the export filename / PDF title (the roster page has no other
  // source for it — the city label lives in the layout's session, not here).
  const { data: city } = await supabase.from("cities").select("name").eq("id", cityId).maybeSingle();
  const cityName: string | null = city?.name ?? null;

  // Supabase embeds a to-one relation as either an object or a single-element
  // array; normalize to one object (or null), same as the admin players route.
  const players = ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone,
    paid_status: r.paid_status,
    created_at: r.created_at,
    profiles: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) ?? null,
  }));

  return NextResponse.json({ players, cityName });
}
