import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";

// Server-only standings read. Both leaderboards are computed by the
// member_series_standings view (migration 013); this just fetches the viewer's
// city+series slice via service-role.

export type StandingRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  rounds_played: number;
  total_score: number;
  average_score: number;
  cumulative_score: number;
  cumulative_rank: number | null;
  average_rank: number | null;
};

export async function getStandings(member: PortalMember): Promise<{ cityName: string | null; rows: StandingRow[] }> {
  const admin: any = createAdminClient();
  if (!admin || !member.series_id || !member.city_id) return { cityName: null, rows: [] };

  const [{ data: rows }, { data: city }] = await Promise.all([
    admin
      .from("member_series_standings")
      .select("user_id, full_name, avatar_url, rounds_played, total_score, average_score, cumulative_score, cumulative_rank, average_rank")
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
    cumulative_score: r.cumulative_score ?? 0,
    cumulative_rank: r.cumulative_rank ?? null,
    average_rank: r.average_rank ?? null,
  }));

  return { cityName: city?.name ?? null, rows: normalized };
}

// Cumulative order: by computed rank.
export function byCumulative(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => (a.cumulative_rank ?? 9999) - (b.cumulative_rank ?? 9999));
}

// Average order: ranked players (>=5 rounds) first by average_rank, then the
// unranked (<5 rounds) below, alphabetically.
export function byAverage(rows: StandingRow[]): StandingRow[] {
  const ranked = rows.filter((r) => r.average_rank != null).sort((a, b) => (a.average_rank ?? 0) - (b.average_rank ?? 0));
  const unranked = rows.filter((r) => r.average_rank == null).sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  return [...ranked, ...unranked];
}
