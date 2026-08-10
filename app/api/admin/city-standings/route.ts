import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";

// Admin-only, read-only city-vs-city standings for a series. Unlike
// /api/admin/standings this is inherently cross-city, so it takes only a
// series_id (no city_id filter). city_series_standings is security_invoker=off,
// so the service-role client reads it directly.
type CityStandingRow = { city_id: string; city_name: string | null; city_score: number; city_rank: number | null };

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const seriesId = url.searchParams.get("series_id");
  if (!seriesId) {
    return NextResponse.json({ error: "series_id is required." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  const { data } = await admin
    .from("city_series_standings")
    .select("city_id, city_name, city_score, city_rank")
    .eq("series_id", seriesId)
    .order("city_rank", { ascending: true });

  const rows: CityStandingRow[] = ((data ?? []) as any[]).map((r) => ({
    city_id: r.city_id,
    city_name: r.city_name ?? null,
    city_score: Number(r.city_score ?? 0),
    city_rank: r.city_rank ?? null,
  }));

  return NextResponse.json({ rows });
}
