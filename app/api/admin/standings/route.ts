import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import type { StandingRow } from "@/lib/portal/standingsSort";

// Admin-only, read-only standings for ANY city+series (unlike the portal's
// getStandings, which is scoped to the viewer's own cohort). member_series_standings
// is security_invoker=off, so the service-role client reads it directly. Returns
// rows in the StandingRow shape so the page can reuse byAceAward/byChampionAward.
export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const cityId = url.searchParams.get("city_id");
  const seriesId = url.searchParams.get("series_id");
  if (!cityId || !seriesId) {
    return NextResponse.json({ error: "city_id and series_id are required." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  const [{ data: rows }, { data: city }, { data: series }] = await Promise.all([
    admin
      .from("member_series_standings")
      .select("user_id, full_name, avatar_url, rounds_played, total_score, average_score, ace_award_score, ace_award_rank, champion_award_score, champion_award_rank")
      .eq("series_id", seriesId)
      .eq("city_id", cityId),
    admin.from("cities").select("name").eq("id", cityId).maybeSingle(),
    admin.from("series").select("name").eq("id", seriesId).maybeSingle(),
  ]);

  // Normalize identically to lib/portal/standings.getStandings so the numbers
  // match the player-facing page exactly.
  const normalized: StandingRow[] = ((rows ?? []) as any[]).map((r) => ({
    user_id: r.user_id,
    full_name: r.full_name,
    avatar_url: r.avatar_url ?? null,
    rounds_played: r.rounds_played ?? 0,
    total_score: r.total_score ?? 0,
    average_score: Number(r.average_score ?? 0),
    ace_award_score: Number(r.ace_award_score ?? 0),
    ace_award_rank: r.ace_award_rank ?? null,
    champion_award_score: Number(r.champion_award_score ?? 0),
    champion_award_rank: r.champion_award_rank ?? null,
  }));

  return NextResponse.json({ cityName: city?.name ?? null, seriesName: series?.name ?? null, rows: normalized });
}
