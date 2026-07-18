// Profile stats — computed against the round-level scoring schema (migration
// 011: score_submission_players.round_score + is_no_show/is_no_show_bonus).
// "Rounds played" and totals/averages count only real played rounds — rows that
// are neither a no-show nor a stay-bonus.
//
// REMAINING HOOK (standings step): the two ranks. Standings splits into
// Cumulative (best-7-of-8 weekly top-2 minus all no-show penalties) and Average
// (per-round avg, min 5 rounds) as computed VIEWS. `season.cumulativeRank` reads
// the placeholder `standings.rank` for now; `averageRank` stays null until the
// standings views land and this reads from them.

export type StatBlock = { rounds: number; totalScore: number; avgScore: number };

export type ProfileStats = {
  allTime: StatBlock;
  season: StatBlock & { cumulativeRank: number | null; averageRank: number | null };
};

type ScoreRow = { round_score: number; is_no_show: boolean; is_no_show_bonus: boolean };

// Scores for rounds the player actually played (excludes no-shows and the +25
// stay-bonus rows, which don't count as rounds played).
function playedScores(rows: unknown): number[] {
  return ((rows ?? []) as ScoreRow[])
    .filter((r) => !r.is_no_show && !r.is_no_show_bonus)
    .map((r) => r.round_score);
}

function block(scores: number[]): StatBlock {
  const rounds = scores.length;
  const totalScore = scores.reduce((sum, p) => sum + (p ?? 0), 0);
  const avgScore = rounds ? Math.round((totalScore / rounds) * 10) / 10 : 0;
  return { rounds, totalScore, avgScore };
}

const EMPTY: StatBlock = { rounds: 0, totalScore: 0, avgScore: 0 };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getProfileStats(admin: any, userId: string, seriesId: string | null): Promise<ProfileStats> {
  // All-time: every played round for this player, across all series.
  const { data: allRows } = await admin
    .from("score_submission_players")
    .select("round_score, is_no_show, is_no_show_bonus")
    .eq("user_id", userId);
  const allTime = block(playedScores(allRows));

  if (!seriesId) {
    return { allTime, season: { ...EMPTY, cumulativeRank: null, averageRank: null } };
  }

  // Current season: read straight from the standings view so the profile always
  // matches the standings page (rounds/total/average + both ranks, with the
  // 5-round gate leaving averageRank null).
  const { data: standing } = await admin
    .from("member_series_standings")
    .select("rounds_played, total_score, average_score, cumulative_rank, average_rank")
    .eq("series_id", seriesId)
    .eq("user_id", userId)
    .maybeSingle();

  const season = standing
    ? {
        rounds: standing.rounds_played ?? 0,
        totalScore: standing.total_score ?? 0,
        avgScore: Number(standing.average_score ?? 0),
        cumulativeRank: standing.cumulative_rank ?? null,
        averageRank: standing.average_rank ?? null,
      }
    : { ...EMPTY, cumulativeRank: null, averageRank: null };

  return { allTime, season };
}
