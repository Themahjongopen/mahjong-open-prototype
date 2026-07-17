// Profile stats — computed against the CURRENT schema (score_submission_players
// + standings from migration 006). These are real numbers today; they are also
// a deliberate set of HOOKS for the scoring/standings rebuild in
// docs/Scoring-Standings-Final-Spec.md.
//
// WHEN THE SCORES MIGRATION LANDS, revisit here:
//   * Score entry moves to one row per player per ROUND with `round_score` +
//     `is_no_show` (replacing per-submission `points`). Rounds played / totals /
//     averages must count only rows where is_no_show = false, and read
//     round_score instead of points.
//   * Standings splits into two leaderboards: Cumulative (best 7 weekly top-2,
//     minus all no-show penalties) and Average (per-round avg, min 5 rounds).
//     `season.cumulativeRank` / `season.averageRank` should read those; today
//     only a single `standings.rank` exists, so averageRank is left null.

export type StatBlock = { rounds: number; totalScore: number; avgScore: number };

export type ProfileStats = {
  allTime: StatBlock;
  season: StatBlock & { cumulativeRank: number | null; averageRank: number | null };
};

function block(points: number[]): StatBlock {
  const rounds = points.length;
  const totalScore = points.reduce((sum, p) => sum + (p ?? 0), 0);
  const avgScore = rounds ? Math.round((totalScore / rounds) * 10) / 10 : 0;
  return { rounds, totalScore, avgScore };
}

const EMPTY: StatBlock = { rounds: 0, totalScore: 0, avgScore: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getProfileStats(admin: any, userId: string, seriesId: string | null): Promise<ProfileStats> {
  // All-time: every scored round for this player, across all series.
  // HOOK: exclude is_no_show and use round_score once scores migrate.
  const { data: allRows } = await admin
    .from("score_submission_players")
    .select("points")
    .eq("user_id", userId);
  const allTime = block(((allRows ?? []) as { points: number }[]).map((r) => r.points));

  if (!seriesId) {
    return { allTime, season: { ...EMPTY, cumulativeRank: null, averageRank: null } };
  }

  // Current season: restrict to submissions on tables in this series.
  // Done as small explicit lookups rather than a nested embed filter so it stays
  // robust; volumes are tiny at league scale.
  const { data: tableRows } = await admin
    .from("league_tables")
    .select("id")
    .eq("series_id", seriesId);
  const tableIds = ((tableRows ?? []) as { id: string }[]).map((t) => t.id);

  let seasonBlock = EMPTY;
  if (tableIds.length) {
    const { data: subRows } = await admin
      .from("score_submissions")
      .select("id")
      .in("table_id", tableIds);
    const submissionIds = ((subRows ?? []) as { id: string }[]).map((s) => s.id);

    if (submissionIds.length) {
      const { data: seasonPlayers } = await admin
        .from("score_submission_players")
        .select("points")
        .eq("user_id", userId)
        .in("score_submission_id", submissionIds);
      seasonBlock = block(((seasonPlayers ?? []) as { points: number }[]).map((r) => r.points));
    }
  }

  // Ranks from the current single-rank standings row.
  // HOOK: split into cumulative + average ranks with the standings rebuild.
  const { data: standing } = await admin
    .from("standings")
    .select("rank")
    .eq("series_id", seriesId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    allTime,
    season: {
      ...seasonBlock,
      cumulativeRank: standing?.rank ?? null,
      averageRank: null,
    },
  };
}
