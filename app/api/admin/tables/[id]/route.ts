import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { cancelSeatsAndNotify } from "@/lib/portal/cancelSeatsAndNotify";

export const runtime = "nodejs";

// Admin-only table actions:
//   action: "remove_seat"      → remove ONE seated player without canceling the table
//   action: "revert_completed" → undo an accidental mark-as-played (see below)
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  if (body?.action === "revert_completed") {
    return revertCompleted(admin, id);
  }
  if (body?.action !== "remove_seat" || typeof body?.seatId !== "string") {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  return removeSeat(admin, id, body);
}

// Remove ONE seated player from a table without canceling the whole table.
// Reuses cancelSeatsAndNotify (same helper as self-serve leave-seat, admin
// change-city, and admin refund) so seat cancellation, reopening a table that
// drops out of 'full', and the 4->3 underfilled-notify email all stay in lockstep
// with every other place a player leaves a table.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function removeSeat(admin: any, id: string, body: any) {
  const { data: table } = await admin
    .from("league_tables")
    .select("id, creator_id, status, table_seats(id, user_id, canceled_at)")
    .eq("id", id)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }

  const seat = (table.table_seats ?? []).find((s: any) => s.id === body.seatId);
  if (!seat || seat.canceled_at) {
    return NextResponse.json({ error: "That seat is already open." }, { status: 409 });
  }
  if (seat.user_id === table.creator_id) {
    return NextResponse.json(
      { error: "This player is hosting the table. Hand off hosting or cancel the table instead." },
      { status: 400 }
    );
  }
  if (table.status !== "open" && table.status !== "full") {
    return NextResponse.json({ error: "This table's game is already completed or canceled." }, { status: 400 });
  }

  const { cancelError } = await cancelSeatsAndNotify(admin, [seat.id], seat.user_id);
  if (cancelError) {
    return NextResponse.json({ error: "That player couldn't be removed. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Undo an accidental "mark as played": a completed table with a submission the
// host meant to cancel (Dorian Jones, Gulf Coast, Aug 19). Reverting must undo
// everything score submission wrote — which, confirmed against the schema, is
// exactly the score_submissions row and its score_submission_players children:
//   - is_no_show lives ONLY on score_submission_players (set at submit time for a
//     late, unrefilled cancellation), NOT on table_seats. Deleting the submission
//     cascade-deletes those child rows (migration 006 ON DELETE CASCADE), which
//     clears every no-show flag for this table — a player must not stay a no-show
//     for a table that's no longer completed.
//   - Standings are VIEWS (member_series_standings / city_series_standings),
//     computed on read from score_submission_players. Removing the rows updates
//     standings automatically; there is nothing stored to recompute.
// No transaction is available through the service-role client, so operations are
// ordered so a mid-way failure leaves the table COMPLETED, never half-reverted:
// discard the scores first (a single cascading DELETE — all-or-nothing), and flip
// the status LAST. If the status update alone fails, the table is left as
// "completed with no scores" — a valid, re-revertable state, not a corrupt one.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function revertCompleted(admin: any, id: string) {
  const { data: table } = await admin
    .from("league_tables")
    .select("id, status, table_seats(id, canceled_at)")
    .eq("id", id)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  // Guard server-side, not just in the UI: only a completed table can be reverted.
  if (table.status !== "completed") {
    return NextResponse.json({ error: "Only a completed table can be reverted." }, { status: 409 });
  }

  // 1. Discard the submitted scores (cascades to score_submission_players, clearing
  //    is_no_show). Idempotent — deletes 0 rows for a completed-but-unscored table.
  const { error: delError } = await admin.from("score_submissions").delete().eq("table_id", id);
  if (delError) {
    return NextResponse.json({ error: "The scores couldn't be discarded. The table is unchanged." }, { status: 500 });
  }

  // 2. Status back to full (4 active seats) or open — derived, never hardcoded.
  const activeSeats = ((table.table_seats ?? []) as { canceled_at: string | null }[]).filter((s) => !s.canceled_at).length;
  const nextStatus = activeSeats >= 4 ? "full" : "open";
  const { error: updError } = await admin.from("league_tables").update({ status: nextStatus }).eq("id", id);
  if (updError) {
    // Scores are already gone; the table is "completed with no scores" and reverting
    // again will finish the job. Report rather than pretend success.
    return NextResponse.json({ error: "Scores were discarded but the table status couldn't be updated. Please revert again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
