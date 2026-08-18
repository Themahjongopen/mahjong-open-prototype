import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";
import { scoringSeats, type SeatRow } from "@/lib/portal/tables";

// Server-only helpers for host score entry. Reads via service-role so seat rows
// can carry profile names; scope/authorization is enforced explicitly against
// the caller resolved by getPortalUser().

export type ScoreSeat = { user_id: string; seat_number: number; full_name: string | null; is_late_cancellation: boolean };
export type ScoreableTable = {
  id: string;
  week_number: number;
  table_date: string;
  location_name: string;
  seats: ScoreSeat[];
};

export type SubmittedPlayer = {
  id: string; // score_submission_players.id — the host correction PATCH targets this
  user_id: string;
  full_name: string | null;
  round_score: number;
  is_no_show: boolean;
  is_no_show_bonus: boolean;
};
// created_at drives the host's 24h self-correction window; status gates it (a
// voided submission isn't host-editable).
export type TableSubmission = { id: string; status: string; created_at: string; players: SubmittedPlayer[] };

const TABLE_SELECT =
  "id, creator_id, week_number, table_date, table_time, location_name, status, series_id, cities(timezone), table_seats(user_id, seat_number, canceled_at, profiles(full_name)), score_submissions(id)";

// Build the scoreable seat list: active seats (is_late_cancellation false) plus
// any seat whose most recent occupant cancelled within 24h and was never
// re-claimed (is_late_cancellation true, forced to a no-show at submit time),
// sorted together by seat_number.
function toSeats(table: { table_date: string; table_time: string | null; table_seats: SeatRow[] | null; cities?: { timezone: string | null } | { timezone: string | null }[] | null }): ScoreSeat[] {
  const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
  const { active, lateCancellations } = scoringSeats({
    table_date: table.table_date,
    table_time: table.table_time,
    timezone: city?.timezone ?? null,
    table_seats: table.table_seats ?? [],
  });
  const seat = (s: SeatRow, is_late_cancellation: boolean): ScoreSeat => ({
    user_id: s.user_id,
    seat_number: s.seat_number,
    full_name: s.profiles?.full_name ?? null,
    is_late_cancellation,
  });
  return [
    ...active.map((s) => seat(s, false)),
    ...lateCancellations.map((s) => seat(s, true)),
  ].sort((a, b) => a.seat_number - b.seat_number);
}

// Does this table already have a score submission? score_submissions.table_id is
// UNIQUE (migration 006), so PostgREST embeds `score_submissions` as a to-ONE
// relation — a single object (or null), NOT an array. The old checks used
// `.length`, which is undefined on an object → always falsy → every already-scored
// table was silently treated as unscored (so it never dropped off the Scores tab,
// and the API's duplicate-submit guard was bypassed). Handle both shapes so this
// is correct regardless of how PostgREST resolves the relationship.
export function hasSubmission(t: { score_submissions?: unknown }): boolean {
  const s = t.score_submissions;
  return Array.isArray(s) ? s.length > 0 : s != null;
}

// Completed tables the host created that don't yet have a score submission.
export async function getEligibleScoreTables(member: PortalMember): Promise<ScoreableTable[]> {
  const admin: any = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("league_tables")
    .select(TABLE_SELECT)
    .eq("creator_id", member.id)
    .eq("status", "completed")
    .order("table_date", { ascending: false });

  return ((data ?? []) as any[])
    .filter((t) => !hasSubmission(t))
    .map((t) => ({ id: t.id, week_number: t.week_number, table_date: t.table_date, location_name: t.location_name, seats: toSeats(t) }));
}

// A single table validated for scoring by this host (creator/admin, completed,
// not yet submitted). Returns null if it isn't scoreable by them.
export async function getTableForScoring(id: string, member: PortalMember): Promise<ScoreableTable | null> {
  const admin: any = createAdminClient();
  if (!admin) return null;

  const { data: t } = await admin.from("league_tables").select(TABLE_SELECT).eq("id", id).maybeSingle();
  if (!t) return null;
  if (t.creator_id !== member.id && !member.isAdmin) return null;
  if (t.status !== "completed") return null;
  if (hasSubmission(t)) return null;

  return { id: t.id, week_number: t.week_number, table_date: t.table_date, location_name: t.location_name, seats: toSeats(t) };
}

// The posted scores for a table (for the detail page), or null if none yet.
export async function getSubmissionForTable(id: string): Promise<TableSubmission | null> {
  const admin: any = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("score_submissions")
    .select("id, status, created_at, score_submission_players(id, user_id, round_score, is_no_show, is_no_show_bonus, profiles(full_name))")
    .eq("table_id", id)
    .maybeSingle();

  if (!data) return null;
  const players = ((data.score_submission_players ?? []) as any[]).map((p) => ({
    id: p.id,
    user_id: p.user_id,
    full_name: p.profiles?.full_name ?? null,
    round_score: p.round_score,
    is_no_show: p.is_no_show,
    is_no_show_bonus: p.is_no_show_bonus,
  }));
  return { id: data.id, status: data.status, created_at: data.created_at, players };
}
