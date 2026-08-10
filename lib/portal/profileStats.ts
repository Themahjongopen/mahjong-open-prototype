// Profile stats — computed against the round-level scoring schema (migration
// 011: score_submission_players.round_score + is_no_show/is_no_show_bonus).
// "Rounds played" and totals/averages count only real played rounds — rows that
// are neither a no-show nor a stay-bonus.
//
// Season awards (Ace + Champion) come from the member_series_standings view
// (migration 027). Ace Award = the player's single highest round score; Champion
// Award = best-7-of-8 weekly avg(min,max) minus all no-show penalties.

export type StatBlock = { rounds: number; totalScore: number; avgScore: number };

export type ProfileStats = {
  allTime: StatBlock;
  season: StatBlock & {
    aceAwardScore: number; aceAwardRank: number | null;
    championAwardScore: number; championAwardRank: number | null;
  };
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
export async function getProfileStats(admin: any, userId: string, seriesId: string | null, cityId: string | null): Promise<ProfileStats> {
  // All-time: every played round for this player, across all series.
  const { data: allRows } = await admin
    .from("score_submission_players")
    .select("round_score, is_no_show, is_no_show_bonus")
    .eq("user_id", userId);
  const allTime = block(playedScores(allRows));

  // Season stats are per (series, city): member_series_standings has one row per
  // city a player has been active in, so both are required to pick the right row.
  if (!seriesId || !cityId) {
    return { allTime, season: { ...EMPTY, aceAwardScore: 0, aceAwardRank: null, championAwardScore: 0, championAwardRank: null } };
  }

  // Current season: read straight from the standings view so the profile always
  // matches the standings page (rounds/total/average plus the Ace Award and
  // Champion Award scores + ranks).
  const { data: standing } = await admin
    .from("member_series_standings")
    .select("rounds_played, total_score, average_score, ace_award_score, ace_award_rank, champion_award_score, champion_award_rank")
    .eq("series_id", seriesId)
    .eq("city_id", cityId)
    .eq("user_id", userId)
    .maybeSingle();

  const season = standing
    ? {
        rounds: standing.rounds_played ?? 0,
        totalScore: standing.total_score ?? 0,
        // No minimum anymore under the new system — show the raw average directly
        // (the old 5-round gate existed only to protect the retired Average
        // Standing's ranking fairness; nothing plays that role now).
        avgScore: Number(standing.average_score ?? 0),
        aceAwardScore: Number(standing.ace_award_score ?? 0),
        aceAwardRank: standing.ace_award_rank ?? null,
        championAwardScore: Number(standing.champion_award_score ?? 0),
        championAwardRank: standing.champion_award_rank ?? null,
      }
    : { ...EMPTY, aceAwardScore: 0, aceAwardRank: null, championAwardScore: 0, championAwardRank: null };

  return { allTime, season };
}
