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
  ace_award_score: number;
  ace_award_rank: number | null;
  champion_award_score: number;
  champion_award_rank: number | null;
  flight_winner_score: number;
  flight_winner_rank: number | null;
};

// Ace Award order: no minimum, no tiebreaker — straight rank order.
export function byAceAward(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => (a.ace_award_rank ?? 9999) - (b.ace_award_rank ?? 9999));
}

// Champion Award order: no minimum — straight rank order (rank already applies
// the total_score tiebreak in SQL).
export function byChampionAward(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => (a.champion_award_rank ?? 9999) - (b.champion_award_rank ?? 9999));
}

// Flight Winner order: gated (rank is null below the 5-round minimum) — push
// ungated rows to the bottom instead of sorting them first.
export function byFlightWinner(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort((a, b) => (a.flight_winner_rank ?? 9999) - (b.flight_winner_rank ?? 9999));
}
