// Client-safe standings row shape + leaderboard ordering. Kept free of any
// server-only imports (no createAdminClient / next/headers) so it can be used by
// client components (e.g. the admin standings page) as well as server code.
// lib/portal/standings.ts re-exports these alongside its server-only getStandings.

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
