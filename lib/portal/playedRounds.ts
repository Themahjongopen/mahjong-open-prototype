import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";

// Server-only reads for the "Played" view on the Tables page: completed rounds in
// the member's CURRENT-LEAGUE city cohort, so any player can verify their own
// scores were entered correctly and see how the leaderboard is built (owner
// direction, Aug 2026 — broader than the commissioner-only ask). Multi-league
// history is deferred; every read here is scoped to member.series_id + city_id.

// One scheduled player's result on a completed round. Keyed on the stored no-show
// flags, never a score value — the same contract the standings views use:
//   is_no_show       → absent; the round carries the flat −20 weekly penalty
//   is_no_show_bonus → present at a no-show round; no game was played, so no score
//   neither          → a normally scored round
export type PlayedPlayerResult =
  | { kind: "score"; value: number } // normal scored round
  | { kind: "penalty" } // the absent player (−20); flat per the Aug 2026 policy
  | { kind: "noscore" } // present at a no-show round — no game, no round score
  | { kind: "pending" }; // completed but the host hasn't entered scores yet

export type PlayedPlayer = {
  user_id: string;
  full_name: string | null;
  isHost: boolean;
  result: PlayedPlayerResult;
};

export type PlayedRound = {
  id: string;
  week_number: number;
  table_date: string;
  table_time: string | null;
  location_name: string;
  round_type: string | null;
  hostName: string | null;
  players: PlayedPlayer[];
};

// Distinct week numbers that have at least one completed round in the member's
// current-league city cohort, ascending. A scalar read (week_number only) so it
// stays cheap even in the biggest city — it backs the week dropdown and picks the
// default week. Empty when the city has no completed rounds yet.
export async function getPlayedWeeks(member: PortalMember): Promise<number[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin || !member.series_id || !member.city_id) return [];

  const { data } = await admin
    .from("league_tables")
    .select("week_number")
    .eq("series_id", member.series_id)
    .eq("city_id", member.city_id)
    .eq("status", "completed");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weeks = new Set<number>(((data ?? []) as any[]).map((r) => r.week_number as number));
  return Array.from(weeks).sort((a, b) => a - b);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resultFor(p: any): PlayedPlayerResult {
  if (p.is_no_show) return { kind: "penalty" };
  if (p.is_no_show_bonus) return { kind: "noscore" };
  return { kind: "score", value: p.round_score };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toPlayedRound(t: any): PlayedRound {
  // score_submissions.table_id is UNIQUE, so PostgREST embeds it as a to-one
  // (object or null). A voided submission (reverted table) is ignored — its rows
  // no longer count, so the round shows as not-yet-scored.
  const submission = Array.isArray(t.score_submissions) ? t.score_submissions[0] : t.score_submissions;
  const scored = submission && submission.status !== "voided" ? submission : null;

  // Name lookup from both the seat profiles and the submission profiles, so the
  // host name and any absent/late-cancel player named only on the submission both
  // resolve.
  const nameOf = new Map<string, string | null>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (t.table_seats ?? []) as any[]) nameOf.set(s.user_id, s.profiles?.full_name ?? null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (scored?.score_submission_players ?? []) as any[]) {
    if (!nameOf.has(p.user_id) || nameOf.get(p.user_id) == null) nameOf.set(p.user_id, p.profiles?.full_name ?? null);
  }

  let players: PlayedPlayer[];
  if (scored) {
    // Authoritative: the submission rows carry the flags and cover absent /
    // late-cancel players that active seats wouldn't.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    players = ((scored.score_submission_players ?? []) as any[]).map((p) => ({
      user_id: p.user_id,
      full_name: nameOf.get(p.user_id) ?? p.profiles?.full_name ?? null,
      isHost: p.user_id === t.creator_id,
      result: resultFor(p),
    }));
  } else {
    // Completed but unscored (host hasn't entered scores yet) — show the actively
    // seated players with a pending result.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    players = ((t.table_seats ?? []) as any[])
      .filter((s) => !s.canceled_at)
      .map((s) => ({
        user_id: s.user_id,
        full_name: s.profiles?.full_name ?? null,
        isHost: s.user_id === t.creator_id,
        result: { kind: "pending" as const },
      }));
  }

  // Host first (Nancy's use case is scanning for the host), then alphabetical.
  players.sort((a, b) => {
    if (a.isHost !== b.isHost) return a.isHost ? -1 : 1;
    return (a.full_name ?? "").localeCompare(b.full_name ?? "");
  });

  return {
    id: t.id,
    week_number: t.week_number,
    table_date: t.table_date,
    table_time: t.table_time,
    location_name: t.location_name,
    round_type: t.round_type,
    hostName: nameOf.get(t.creator_id) ?? null,
    players,
  };
}

// Completed rounds for ONE week in the member's current-league city cohort, most
// recent first. Single-week by design: the point is not to load every completed
// round in a city up front (the biggest single week is ~53 tables / ~210 player
// rows). Canceled tables are excluded by the status filter — nothing to verify on
// a table that never played.
export async function getPlayedRounds(member: PortalMember, week: number): Promise<PlayedRound[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin || !member.series_id || !member.city_id) return [];

  const { data } = await admin
    .from("league_tables")
    .select(
      "id, creator_id, week_number, table_date, table_time, location_name, round_type, table_seats(user_id, canceled_at, profiles(full_name)), score_submissions(status, score_submission_players(user_id, round_score, is_no_show, is_no_show_bonus, profiles(full_name)))",
    )
    .eq("series_id", member.series_id)
    .eq("city_id", member.city_id)
    .eq("status", "completed")
    .eq("week_number", week)
    .order("table_date", { ascending: false })
    .order("table_time", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(toPlayedRound);
}
