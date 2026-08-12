import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

// Public: powers the marketing homepage's live launch-cities map. Returns only
// city name/state + whether it's hit the 20-player minimum for the currently
// active series -- deliberately NOT exact counts (kept off the public site).
export async function GET() {
  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ cities: [] });
  }

  const { data: activeSeries } = await supabase
    .from("series")
    .select("id")
    .eq("is_active", true)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const activeSeriesId: string | null = activeSeries?.id ?? null;

  const { data: cities } = await supabase
    .from("cities")
    .select("id, name, state")
    .eq("is_active", true);

  if (!activeSeriesId || !cities?.length) {
    return NextResponse.json({ cities: (cities ?? []).map((c: any) => ({ name: c.name, state: c.state, hit_minimum: false })) });
  }

  const { data: regs } = await supabase
    .from("registrations")
    .select("city_id, paid_status")
    .eq("series_id", activeSeriesId)
    .eq("paid_status", "paid");

  const paidCounts = new Map<string, number>();
  for (const r of (regs ?? []) as any[]) {
    paidCounts.set(r.city_id, (paidCounts.get(r.city_id) ?? 0) + 1);
  }

  const result = (cities as any[]).map((c) => ({
    name: c.name,
    state: c.state,
    hit_minimum: (paidCounts.get(c.id) ?? 0) >= 20,
  }));

  return NextResponse.json(
    { cities: result },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } }
  );
}
