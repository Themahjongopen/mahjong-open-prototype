import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";
import type { StandingRow } from "@/lib/portal/standingsSort";

// Server-only standings read. Both leaderboards are computed by the
// member_series_standings view (migration 027); this just fetches the viewer's
// city+series slice via service-role.
//
// The row shape + orderings (StandingRow, byAceAward, byChampionAward) live in
// the client-safe standingsSort module and are re-exported here for callers.
export type { StandingRow } from "@/lib/portal/standingsSort";
export { byAceAward, byChampionAward, byFlightWinner } from "@/lib/portal/standingsSort";

export async function getStandings(member: PortalMember): Promise<{ cityName: string | null; rows: StandingRow[] }> {
  const admin: any = createAdminClient();
  if (!admin || !member.series_id || !member.city_id) return { cityName: null, rows: [] };

  const [{ data: rows }, { data: city }] = await Promise.all([
    admin
      .from("member_series_standings")
      .select("user_id, full_name, avatar_url, rounds_played, total_score, average_score, ace_award_score, ace_award_rank, champion_award_score, champion_award_rank, flight_winner_score, flight_winner_rank")
      .eq("series_id", member.series_id)
      .eq("city_id", member.city_id),
    admin.from("cities").select("name").eq("id", member.city_id).maybeSingle(),
  ]);

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
    flight_winner_score: Number(r.flight_winner_score ?? 0),
    flight_winner_rank: r.flight_winner_rank ?? null,
  }));

  return { cityName: city?.name ?? null, rows: normalized };
}

export type CityStandingRow = { city_id: string; city_name: string | null; city_score: number; city_rank: number | null };

// City-vs-city standings for a series — every city with a paid registration,
// ranked by city_score (sum of the top 3 individual round scores city-wide).
export async function getCityStandings(seriesId: string | null): Promise<CityStandingRow[]> {
  const admin: any = createAdminClient();
  if (!admin || !seriesId) return [];
  const { data } = await admin
    .from("city_series_standings")
    .select("city_id, city_name, city_score, city_rank")
    .eq("series_id", seriesId)
    .order("city_rank", { ascending: true });
  return ((data ?? []) as any[]).map((r) => ({
    city_id: r.city_id,
    city_name: r.city_name ?? null,
    city_score: Number(r.city_score ?? 0),
    city_rank: r.city_rank ?? null,
  }));
}
