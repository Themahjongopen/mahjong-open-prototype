import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";
import type { StandingRow } from "@/lib/portal/standingsSort";

// Server-only standings read. Both leaderboards are computed by the
// member_series_standings view (migration 013); this just fetches the viewer's
// city+series slice via service-role.
//
// The row shape + orderings (StandingRow, byCumulative, byAverage) live in the
// client-safe standingsSort module and are re-exported here for existing callers.
export type { StandingRow } from "@/lib/portal/standingsSort";
export { byCumulative, byAverage } from "@/lib/portal/standingsSort";

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
