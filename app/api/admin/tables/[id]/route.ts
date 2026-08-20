import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { cancelSeatsAndNotify } from "@/lib/portal/cancelSeatsAndNotify";
import { getSeriesStartDate } from "@/lib/portal/tables";
import { seriesWeekForDate } from "@/lib/portal/seriesWeek";
import { activeHolds } from "@/lib/portal/seats";
import { holdCutoffIso } from "@/lib/portal/holdExpiry";
import { loadCohortCandidates } from "@/lib/portal/inviteCandidates";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { sendTableFilledEmail } from "@/lib/email/tableFilledEmail";
import { sendAdminAddedToTableEmail } from "@/lib/email/adminAddedToTableEmail";

export const runtime = "nodejs";

// Admin-only table actions:
//   action: "remove_seat"      → remove ONE seated player without canceling the table
//   action: "revert_completed" → undo an accidental mark-as-played (see below)
//   action: "set_week"         → correct a table's week_number (see below)
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
  if (body?.action === "set_week") {
    return setWeek(admin, id, body);
  }
  if (body?.action === "add_seat") {
    return addSeat(admin, id, body);
  }
  if (body?.action !== "remove_seat" || typeof body?.seatId !== "string") {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  return removeSeat(admin, id, body);
}

// Add ONE player to a table from the admin console (support case: Meghan, Fort
// Wayne, Aug 20 — players joined the wrong of two same-venue tables and swapped).
// Routes the seat insert through claim_seat (migration 044) so the admin add is
// the SAME capacity-safe, advisory-locked path as a self-serve join — never a
// bespoke insert that would bypass the lock and reintroduce the two-table race.
//   * completed/canceled tables are refused (revert to open first);
//   * an already-seated player resolves idempotently (claim_seat returns their
//     existing seat) and is surfaced as "already seated", not an error;
//   * held-full is refused with an ACTIONABLE message naming the held seats — the
//     admin releases a hold first (they have that control on the detail page). We
//     never silently destroy a reservation;
//   * eligibility (paid in this table's city+series) is re-checked server-side,
//     directory-agnostic, so a tampered/out-of-cohort userId is rejected here;
//   * the added player is emailed (they didn't choose to join, and the 24h no-show
//     rule now applies to them). If the add closes the 4th seat, the OTHER three
//     get the standard "table full" email — the added player is EXCLUDED from that
//     broadcast so they get exactly one email about the event.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function addSeat(admin: any, id: string, body: any) {
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!userId) {
    return NextResponse.json({ error: "Pick a player to add." }, { status: 400 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select(
      "id, city_id, series_id, status, table_date, table_time, location_name, location_address, round_type, creator_id, cities(name), table_seats(id, user_id, canceled_at), table_invites(invited_profile_id, status, created_at, profiles!invited_profile_id(full_name))"
    )
    .eq("id", id)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (table.status !== "open" && table.status !== "full") {
    return NextResponse.json(
      { error: "This table is completed or canceled. Revert it to open first, then add a player." },
      { status: 409 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeSeatRows = ((table.table_seats ?? []) as any[]).filter((s) => !s.canceled_at);
  const seatedIds = new Set(activeSeatRows.map((s: any) => s.user_id));

  // Already seated → idempotent (claim_seat would return the same), surfaced plainly.
  if (seatedIds.has(userId)) {
    return NextResponse.json({ ok: true, already: true, message: "That player is already seated at this table." });
  }

  // Eligibility: paid in THIS table's city+series (directory-agnostic for admin).
  // Re-checked here so a tampered userId that never reached the picker is rejected.
  const eligible = await loadCohortCandidates(admin, table.city_id, table.series_id, new Set(), true);
  if (!eligible.has(userId)) {
    return NextResponse.json(
      { error: "That player isn't a paid member of this table's city and league." },
      { status: 400 }
    );
  }

  const { data: claim, error: claimError } = await admin.rpc("claim_seat", {
    p_table_id: id,
    p_user_id: userId,
    p_hold_cutoff: holdCutoffIso(),
  });
  if (claimError) {
    return NextResponse.json({ error: "That player couldn't be seated. Please try again." }, { status: 500 });
  }
  if (!claim?.ok) {
    // claim_seat only refuses when active seats + live holds >= 4. Distinguish a
    // genuinely-full table (4 real players) from a held-full one, and for the
    // latter name the held seats so the admin knows exactly what to release.
    if (activeSeatRows.length >= 4) {
      return NextResponse.json({ error: "This table already has four players." }, { status: 409 });
    }
    const heldNames = activeHolds((table.table_invites ?? []) as any[])
      .filter((h: any) => !seatedIds.has(h.invited_profile_id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((h: any) => (Array.isArray(h.profiles) ? h.profiles[0] : h.profiles)?.full_name)
      .filter(Boolean) as string[];
    const nameList =
      heldNames.length === 0
        ? "an invited player"
        : heldNames.length === 1
          ? heldNames[0]
          : heldNames.length === 2
            ? `${heldNames[0]} and ${heldNames[1]}`
            : `${heldNames.slice(0, -1).join(", ")} and ${heldNames[heldNames.length - 1]}`;
    return NextResponse.json(
      {
        error: `This table's open ${heldNames.length === 1 ? "seat is held" : "seats are held"} for ${nameList}. Release a hold on the table's detail page first, then add.`,
      },
      { status: 409 }
    );
  }
  if (claim.already) {
    return NextResponse.json({ ok: true, already: true, message: "That player is already seated at this table." });
  }

  // Seated. Fire the side-effect emails best-effort — the seat is committed and a
  // send must never fail the add.
  const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
  const cityName = city?.name ?? null;

  // 1) The added player — they didn't choose to join, so tell them (+ no-show rule).
  try {
    const { data: added } = await admin.from("profiles").select("email, full_name").eq("id", userId).maybeSingle();
    if (added?.email) {
      const res = await sendAdminAddedToTableEmail(
        { email: added.email, fullName: added.full_name },
        { tableId: id, cityName, tableDate: table.table_date, tableTime: table.table_time, locationName: table.location_name, roundType: table.round_type }
      );
      if (!res.ok) console.error("adminAddedToTableEmail not sent", added.email, res.error);
    }
  } catch (err) {
    console.error("adminAddedToTableEmail failed", err);
  }

  // 2) If this closed the 4th seat, mark the table full and send the standard
  //    "table full" email to the OTHER three (the added player is excluded — they
  //    already got the add email, so they get exactly one message about this).
  if (claim.now_full) {
    await admin.from("league_tables").update({ status: "full" }).eq("id", id);
    try {
      const otherIds = [...new Set(activeSeatRows.map((s: any) => s.user_id).filter(Boolean))].filter((uid) => uid !== userId);
      if (otherIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email, full_name, notification_preferences")
          .in("id", otherIds);
        for (const p of (profiles ?? []) as any[]) {
          if (!p.email) continue;
          if (resolvePrefs(p.notification_preferences).email_table_filled === false) continue;
          try {
            const res = await sendTableFilledEmail(
              { email: p.email, fullName: p.full_name },
              { tableId: id, tableDate: table.table_date, tableTime: table.table_time, locationName: table.location_name, locationAddress: table.location_address, roundType: table.round_type },
              { acting: false }
            );
            if (!res.ok) console.error("tableFilledEmail not sent (admin add)", p.email, res.error);
          } catch (err) {
            console.error("tableFilledEmail send failed (admin add)", p.email, err);
          }
        }
      }
    } catch (err) {
      console.error("tableFilledEmail batch failed (admin add)", err);
    }
  }

  return NextResponse.json({ ok: true, seat_number: claim.seat_number });
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

// Correct a table's week_number. Mislabeled weeks (a table whose week_number
// doesn't match the week its date falls in) silently over-count the Champion
// award, and until now there was no UI to fix one — it required direct DB access.
// Admin-only (gated in PATCH). The date-derived week is allowed freely; any other
// value (a deliberate exception, e.g. a make-up round) requires confirm:true, so
// a mislabel can't be re-introduced by accident. Standings are computed on read
// from league_tables.week_number, so the change propagates immediately — no
// recompute, and this is safe on a completed table with scores (only the week
// label moves; no score row is touched).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setWeek(admin: any, id: string, body: any) {
  const week = Number.parseInt(body?.week?.toString() ?? "", 10);
  if (!Number.isInteger(week) || week < 1 || week > 8) {
    return NextResponse.json({ error: "Choose a week between 1 and 8." }, { status: 400 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, table_date, series_id, week_number")
    .eq("id", id)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }

  // The week the date actually falls in. A different value needs explicit
  // confirmation; the client re-sends with confirm:true after the admin agrees.
  const seriesStart = await getSeriesStartDate(table.series_id);
  const derivedWeek = seriesStart ? seriesWeekForDate(seriesStart, table.table_date) : null;
  if (derivedWeek !== null && week !== derivedWeek && body?.confirm !== true) {
    return NextResponse.json(
      { error: `Week ${week} doesn't match this table's date, which falls in Week ${derivedWeek}.`, needsConfirm: true, derivedWeek },
      { status: 409 }
    );
  }

  if (table.week_number === week) {
    return NextResponse.json({ ok: true, week }); // already correct — idempotent no-op
  }

  const { error } = await admin.from("league_tables").update({ week_number: week }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "The week couldn't be updated. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, week });
}
