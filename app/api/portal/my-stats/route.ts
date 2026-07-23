import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";

// The logged-in player's three dashboard tiles, read from the service-role-only
// member_series_standings view. Same shape as the admin metrics route: resolve
// the session, then query with the admin (service-role) client.
export type MyStats = {
  rank: number | null; // cumulative_rank (null until they have a standing)
  score: number; // cumulative_score
  rounds: number; // rounds_played
};

const EMPTY_STATS: MyStats = { rank: null, score: 0, rounds: 0 };

export async function GET() {
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Standings are per (series, city). Regular members use their registration
  // cohort; admins have none, so use their current active-city selection.
  let seriesId = session.series_id;
  let cityId = session.city_id;
  if (session.isAdmin) {
    const ctx = await getAdminContext();
    seriesId = ctx.seriesId;
    cityId = ctx.cityId;
  }
  if (!seriesId || !cityId) {
    return NextResponse.json({ stats: EMPTY_STATS });
  }

  // member_series_standings isn't in the generated Database types, so use an
  // untyped client (same pattern as /api/admin/metrics).
  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ stats: EMPTY_STATS });
  }

  const { data } = await supabase
    .from("member_series_standings")
    .select("cumulative_rank, cumulative_score, rounds_played")
    .eq("user_id", session.id)
    .eq("series_id", seriesId)
    .eq("city_id", cityId)
    .maybeSingle();

  const stats: MyStats = data
    ? {
        rank: data.cumulative_rank ?? null,
        score: data.cumulative_score ?? 0,
        rounds: data.rounds_played ?? 0,
      }
    : EMPTY_STATS;

  return NextResponse.json({ stats });
}
