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

  const { data, error } = await supabase
    .from("registrations")
    .select("id, full_name, email, phone, paid_status, created_at")
    .eq("city_id", cityId)
    .in("paid_status", ["paid", "pending"])
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load players." }, { status: 500 });
  }

  return NextResponse.json({ players: data ?? [] });
}
