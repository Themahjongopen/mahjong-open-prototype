import { createAdminClient } from "@/lib/supabase/server";

// The logged-in player's dashboard season stats, read from the service-role-only
// member_series_standings view. All three award systems (Ace / Champion / Flight
// Winner) plus games played, for parity with the profile page's "Current season"
// section. Extracted so the dashboard Server Component can compute these inline
// (reusing the request's existing auth) instead of the client re-fetching them
// through a second function invocation + a second getUser().
export type AwardStat = { score: number; rank: number | null };
export type MyStats = {
  rounds: number; // rounds_played
  ace: AwardStat;
  champion: AwardStat;
  flightWinner: AwardStat;
};

export const EMPTY_STATS: MyStats = {
  rounds: 0,
  ace: { score: 0, rank: null },
  champion: { score: 0, rank: null },
  flightWinner: { score: 0, rank: null },
};

// Standings are per (series, city). The caller resolves the acting cohort — a
// regular member's own registration cohort, or an admin's active-city selection
// (via withAdminCity) — and passes the resolved ids in.
export async function getMyStats(
  userId: string,
  seriesId: string | null,
  cityId: string | null
): Promise<MyStats> {
  if (!seriesId || !cityId) return EMPTY_STATS;

  // member_series_standings isn't in the generated Database types, so use an
  // untyped client (same pattern as /api/admin/metrics).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createAdminClient();
  if (!supabase) return EMPTY_STATS;

  const { data } = await supabase
    .from("member_series_standings")
    .select("rounds_played, ace_award_score, ace_award_rank, champion_award_score, champion_award_rank, flight_winner_score, flight_winner_rank")
    .eq("user_id", userId)
    .eq("series_id", seriesId)
    .eq("city_id", cityId)
    .maybeSingle();

  // PostgREST returns Postgres numeric as a string — coerce every score with
  // Number() (same as profileStats.ts / the standings pages) so .toFixed() works.
  return data
    ? {
        rounds: data.rounds_played ?? 0,
        ace: { score: Number(data.ace_award_score ?? 0), rank: data.ace_award_rank ?? null },
        champion: { score: Number(data.champion_award_score ?? 0), rank: data.champion_award_rank ?? null },
        flightWinner: { score: Number(data.flight_winner_score ?? 0), rank: data.flight_winner_rank ?? null },
      }
    : EMPTY_STATS;
}
