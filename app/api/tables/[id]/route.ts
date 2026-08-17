import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { scoringSeats } from "@/lib/portal/tables";
import { zonedTimeToUtc } from "@/lib/format/zonedTime";
import { seriesWeekForDate } from "@/lib/portal/seriesWeek";
import { sendTableUpdatedEmail } from "@/lib/email/tableUpdatedEmail";
import { sendTableHostChangedEmail } from "@/lib/email/tableHostChangedEmail";
import { sendTableCanceledEmail } from "@/lib/email/tableCanceledEmail";
import { normalizeArea } from "@/lib/portal/area";

const ROUND_TYPES = new Set(["social", "focused", "lightning"]);
const DEFAULT_TIMEZONE = "America/Chicago";

// Creator/admin table actions. Seats are left intact; status drives display.
//   action: "cancel"   → status canceled
//   action: "complete" → status completed (marks the round played; unlocks
//                        host score entry)
//   action: "edit"     → update time/date/location/round type/notes (NOT the
//                        round/week number — see below), with a hard 24h cutoff
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "cancel" && action !== "complete" && action !== "edit" && action !== "handoff") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Tables are unavailable right now." }, { status: 503 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, creator_id, status, week_number, table_date, table_time, location_name, location_address, round_type, notes, series_id, cities(name, timezone), series(starts_at), table_seats(seat_number, user_id, canceled_at)")
    .eq("id", id)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (table.creator_id !== session.id && !session.isAdmin) {
    return NextResponse.json({ error: "Only the table host can do that." }, { status: 403 });
  }

  if (action === "handoff") {
    // Reassign the host to another SEATED player. Auth is the shared creator‖admin
    // check above — an admin can rescue a table whose host has gone silent.
    // Deliberately NO 24h cutoff (unlike edit): a host realizing the morning-of
    // that she can't make it is exactly when this is needed — the whole point is
    // avoiding a cancellation. Once creator_id moves, the outgoing host's normal
    // "Cancel my spot" unblocks (the existing !isCreator gate) — no extra leave
    // logic here.
    if (table.status !== "open" && table.status !== "full") {
      // Completed matters: scores are already in, reassigning would muddy the audit trail.
      return NextResponse.json({ error: "Only an open or upcoming table can be handed off." }, { status: 409 });
    }
    const newHostId = body?.newHostId?.toString();
    if (!newHostId) {
      return NextResponse.json({ error: "A new host is required." }, { status: 400 });
    }
    if (newHostId === table.creator_id) {
      return NextResponse.json({ error: "That player is already the host." }, { status: 400 });
    }
    // The new host must hold an ACTIVE seat here — a cancelled seat doesn't count.
    const newSeat = (table.table_seats ?? []).find((s: any) => s.user_id === newHostId && !s.canceled_at);
    if (!newSeat) {
      return NextResponse.json({ error: "The new host must be seated at this table." }, { status: 400 });
    }

    const { error: handoffError } = await admin
      .from("league_tables")
      .update({ creator_id: newHostId })
      .eq("id", id);
    if (handoffError) {
      return NextResponse.json({ error: "The table couldn't be handed off. Please try again." }, { status: 500 });
    }

    // Best-effort notices — the DB change is what matters; a send failure must
    // never block or roll back the handoff (no orphaned-row risk here, unlike
    // invites). Sent UNCONDITIONALLY (not gated on notification_preferences):
    // knowing who runs your table is transactional. The NEW host gets a
    // responsibilities email; every OTHER active-seated player — INCLUDING the
    // outgoing host, essential in the admin-rescue case — gets a short notice.
    try {
      const activeSeatedIds = [
        ...new Set((table.table_seats ?? []).filter((s: any) => !s.canceled_at && s.user_id).map((s: any) => s.user_id)),
      ] as string[];
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", activeSeatedIds);
      const newHostName = (profiles ?? []).find((p: any) => p.id === newHostId)?.full_name ?? "A player";
      const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
      for (const p of (profiles ?? []) as any[]) {
        if (!p.email) continue;
        try {
          const res = await sendTableHostChangedEmail(
            { email: p.email, fullName: p.full_name },
            {
              tableId: id,
              tableDate: table.table_date,
              tableTime: table.table_time,
              locationName: table.location_name,
              cityName: city?.name ?? null,
              weekNumber: table.week_number,
              roundType: table.round_type,
            },
            { isNewHost: p.id === newHostId, newHostName }
          );
          if (!res.ok) console.error("tableHostChangedEmail not sent", p.email, res.error);
        } catch (err) {
          console.error("tableHostChangedEmail send failed", p.email, err);
        }
      }
    } catch (err) {
      console.error("tableHostChangedEmail batch failed", err);
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "edit") {
    // Status guard — a completed/canceled round's record isn't editable.
    if (table.status !== "open" && table.status !== "full") {
      return NextResponse.json({ error: "Only an open or upcoming table can be edited." }, { status: 409 });
    }

    // Hard 24-hour cutoff, NO exceptions (creator and admin alike). Computed
    // against the table's CURRENT (pre-edit) start time in the venue timezone via
    // the same zone-aware path as the late-cancellation rule — never naive
    // `new Date(date+time)` math (that's the 2026-08-04 bug we don't reintroduce).
    const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
    const startsAtUtc = zonedTimeToUtc(table.table_date, table.table_time ?? "12:00:00", city?.timezone ?? DEFAULT_TIMEZONE);
    if (startsAtUtc.getTime() - Date.now() <= 24 * 60 * 60 * 1000) {
      return NextResponse.json({ error: "Can't edit a table within 24 hours of its start time." }, { status: 409 });
    }

    // Editable fields only. week_number / city_id / series_id are intentionally
    // never read from the body: changing the round has downstream scoring/standings
    // effects and is a bigger decision than an "edit" (goes through Jordan for now).
    const tableDate = body?.table_date?.toString().trim();
    const tableTime = body?.table_time?.toString().trim();
    const locationName = body?.location_name?.toString().trim();
    const locationAddress = body?.location_address?.toString().trim() || null;
    const roundType = body?.round_type?.toString().trim() || null;
    const notes = body?.notes?.toString().trim() || null;
    // Same shared normalization as Create. Optional here too: a host may clear the
    // area (→ NULL) or set it; hosts changing area post-creation is expected.
    const area = normalizeArea(body?.area?.toString());

    // Mirror Create's required-field checks — an edit can't null out a required field.
    if (!tableDate || !tableTime || !locationName || !roundType) {
      return NextResponse.json({ error: "Date, time, location, and round type are all required." }, { status: 400 });
    }
    if (!ROUND_TYPES.has(roundType)) {
      return NextResponse.json({ error: "Invalid round type." }, { status: 400 });
    }
    // Catch a wildly out-of-range date: the new date must still land inside the
    // series' 8-week window. We do NOT touch week_number to match it — moving a
    // date out of its round's usual window is an accepted host call (flagged to
    // Jordan). Skip the check only if the series start date is unavailable.
    const seriesRow = Array.isArray(table.series) ? table.series[0] : table.series;
    const seriesStart = seriesRow?.starts_at ?? null;
    if (seriesStart && seriesWeekForDate(seriesStart, tableDate) === null) {
      return NextResponse.json({ error: "That date is outside the current series window." }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from("league_tables")
      .update({ table_date: tableDate, table_time: tableTime, location_name: locationName, location_address: locationAddress, area, round_type: roundType, notes })
      .eq("id", id);
    if (updateError) {
      return NextResponse.json({ error: "The table couldn't be updated. Please try again." }, { status: 500 });
    }

    // Best-effort "table updated" emails to the OTHER seated players (not the
    // editor — same courtesy-exclusion scorePostedEmail uses). The row is already
    // saved; email is a secondary effect and must never fail the edit, so it's
    // fully wrapped and we always return ok below.
    // Sent UNCONDITIONALLY — intentionally NOT gated on notification_preferences
    // (unlike the three preference-gated emails). A "your table moved" notice is
    // transactional: a player who muted reminders still needs to know their
    // table's time or place changed.
    try {
      const seatedUserIds = (table.table_seats ?? [])
        .filter((s: any) => !s.canceled_at && s.user_id && s.user_id !== session.id)
        .map((s: any) => s.user_id);
      if (seatedUserIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", seatedUserIds);
        for (const p of (profiles ?? []) as any[]) {
          if (!p.email) continue;
          try {
            const res = await sendTableUpdatedEmail(
              { email: p.email, fullName: p.full_name },
              { tableId: id, tableDate, tableTime, locationName, locationAddress, roundType }
            );
            if (!res.ok) console.error("tableUpdatedEmail not sent", p.email, res.error);
          } catch (err) {
            console.error("tableUpdatedEmail send failed", p.email, err);
          }
        }
      }
    } catch (err) {
      console.error("tableUpdatedEmail batch failed", err);
    }

    return NextResponse.json({ ok: true });
  }

  if (action === "cancel") {
    if (table.status === "canceled") return NextResponse.json({ ok: true });
    const { error } = await admin.from("league_tables").update({ status: "canceled" }).eq("id", id);
    if (error) return NextResponse.json({ error: "The table couldn't be cancelled. Please try again." }, { status: 500 });

    // Notify each OTHER actively-seated player their table was canceled — same
    // for a host cancelling their own table and an admin cancelling from the
    // console (e.g. closing a city that didn't hit its minimum). Sent
    // UNCONDITIONALLY (not preference-gated), like the table-updated / host-changed
    // notices: a cancelled table is transactional. Best-effort, fully wrapped —
    // the cancellation is already committed and a send must never block or undo it.
    try {
      const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
      const seatedUserIds = [
        ...new Set(
          (table.table_seats ?? [])
            .filter((s: any) => !s.canceled_at && s.user_id && s.user_id !== session.id)
            .map((s: any) => s.user_id)
        ),
      ] as string[];
      if (seatedUserIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", seatedUserIds);
        for (const p of (profiles ?? []) as any[]) {
          if (!p.email) continue;
          try {
            const res = await sendTableCanceledEmail(
              { email: p.email, fullName: p.full_name },
              {
                tableDate: table.table_date,
                tableTime: table.table_time,
                locationName: table.location_name,
                cityName: city?.name ?? null,
                roundType: table.round_type,
              }
            );
            if (!res.ok) console.error("tableCanceledEmail not sent", p.email, res.error);
          } catch (err) {
            console.error("tableCanceledEmail send failed", p.email, err);
          }
        }
      }
    } catch (err) {
      console.error("tableCanceledEmail batch failed", err);
    }

    return NextResponse.json({ ok: true });
  }

  // complete — an official round needs 4 scoring seats (handbook's "Four
  // Players" rule): active seats plus any seat whose most recent occupant
  // cancelled within 24h and was never re-claimed (forced no-show at score
  // time). Checked ahead of the status early-returns.
  const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
  const { active, lateCancellations } = scoringSeats({
    table_date: table.table_date,
    table_time: table.table_time,
    timezone: city?.timezone ?? null,
    table_seats: table.table_seats ?? [],
  });
  if (active.length + lateCancellations.length < 4) {
    return NextResponse.json({ error: "This round needs 4 seated players before it can be marked as played." }, { status: 409 });
  }
  if (table.status === "completed") return NextResponse.json({ ok: true });
  if (table.status === "canceled") {
    return NextResponse.json({ error: "This table was cancelled." }, { status: 409 });
  }
  const { error } = await admin.from("league_tables").update({ status: "completed" }).eq("id", id);
  if (error) return NextResponse.json({ error: "The table couldn't be updated. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Creator/admin only, and only once a table is cancelled — permanently removes
// the table. table_seats and score_submissions cascade-delete with it (migration
// 006's ON DELETE CASCADE), which is safe here specifically because a cancelled
// table's seats are already inert and it was never played (no real score data).
// Open/full/completed tables can NEVER be deleted this way — see the build
// prompt's scope note for why.
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Tables are unavailable right now." }, { status: 503 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, creator_id, status")
    .eq("id", id)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (table.creator_id !== session.id && !session.isAdmin) {
    return NextResponse.json({ error: "Only the table host can do that." }, { status: 403 });
  }
  if (table.status !== "canceled") {
    return NextResponse.json({ error: "Only a cancelled table can be deleted." }, { status: 409 });
  }

  const { error } = await admin.from("league_tables").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: "The table couldn't be deleted. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
