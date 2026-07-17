import { createAdminClient } from "@/lib/supabase/server";
import type { PortalMember } from "@/lib/portal/session";
import { activeSeats, type SeatRow } from "@/lib/portal/tables";

// Server-only helpers for host score entry. Reads via service-role so seat rows
// can carry profile names; scope/authorization is enforced explicitly against
// the caller resolved by getPortalUser().

export type ScoreSeat = { user_id: string; seat_number: number; full_name: string | null };
export type ScoreableTable = {
  id: string;
  week_number: number;
  table_date: string;
  location_name: string;
  seats: ScoreSeat[];
};

export type SubmittedPlayer = {
  user_id: string;
  full_name: string | null;
  round_score: number;
  is_no_show: boolean;
  is_no_show_bonus: boolean;
};
export type TableSubmission = { id: string; status: string; players: SubmittedPlayer[] };

const TABLE_SELECT =
  "id, creator_id, week_number, table_date, location_name, status, series_id, table_seats(user_id, seat_number, canceled_at, profiles(full_name)), score_submissions(id)";

function toSeats(seats: SeatRow[]): ScoreSeat[] {
  return activeSeats(seats)
    .map((s) => ({ user_id: s.user_id, seat_number: s.seat_number, full_name: s.profiles?.full_name ?? null }))
    .sort((a, b) => a.seat_number - b.seat_number);
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
    .filter((t) => !(t.score_submissions?.length))
    .map((t) => ({ id: t.id, week_number: t.week_number, table_date: t.table_date, location_name: t.location_name, seats: toSeats(t.table_seats ?? []) }));
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
  if (t.score_submissions?.length) return null;

  return { id: t.id, week_number: t.week_number, table_date: t.table_date, location_name: t.location_name, seats: toSeats(t.table_seats ?? []) };
}

// The posted scores for a table (for the detail page), or null if none yet.
export async function getSubmissionForTable(id: string): Promise<TableSubmission | null> {
  const admin: any = createAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("score_submissions")
    .select("id, status, score_submission_players(user_id, round_score, is_no_show, is_no_show_bonus, profiles(full_name))")
    .eq("table_id", id)
    .maybeSingle();

  if (!data) return null;
  const players = ((data.score_submission_players ?? []) as any[]).map((p) => ({
    user_id: p.user_id,
    full_name: p.profiles?.full_name ?? null,
    round_score: p.round_score,
    is_no_show: p.is_no_show,
    is_no_show_bonus: p.is_no_show_bonus,
  }));
  return { id: data.id, status: data.status, players };
}
