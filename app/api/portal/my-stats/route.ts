import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";

// The logged-in player's dashboard stats, read from the service-role-only
// member_series_standings view. Same shape as the admin metrics route: resolve
// the session, then query with the admin (service-role) client. Surfaces all
// three award systems (Ace / Champion / Flight Winner) for parity with the
// profile page's "Current season" section, plus games played.
export type AwardStat = { score: number; rank: number | null };
export type MyStats = {
  rounds: number; // rounds_played
  ace: AwardStat;
  champion: AwardStat;
  flightWinner: AwardStat;
};

const EMPTY_STATS: MyStats = {
  rounds: 0,
  ace: { score: 0, rank: null },
  champion: { score: 0, rank: null },
  flightWinner: { score: 0, rank: null },
};

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
    .select("rounds_played, ace_award_score, ace_award_rank, champion_award_score, champion_award_rank, flight_winner_score, flight_winner_rank")
    .eq("user_id", session.id)
    .eq("series_id", seriesId)
    .eq("city_id", cityId)
    .maybeSingle();

  // PostgREST returns Postgres numeric as a string — coerce every score with
  // Number() (same as profileStats.ts / the standings pages) so .toFixed() works.
  const stats: MyStats = data
    ? {
        rounds: data.rounds_played ?? 0,
        ace: { score: Number(data.ace_award_score ?? 0), rank: data.ace_award_rank ?? null },
        champion: { score: Number(data.champion_award_score ?? 0), rank: data.champion_award_rank ?? null },
        flightWinner: { score: Number(data.flight_winner_score ?? 0), rank: data.flight_winner_rank ?? null },
      }
    : EMPTY_STATS;

  return NextResponse.json({ stats });
}
