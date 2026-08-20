import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";
import { createAdminClient } from "@/lib/supabase/server";
import { getSeriesStartDate, getSeriesEndDate } from "@/lib/portal/tables";
import { seriesWeekForDate } from "@/lib/portal/seriesWeek";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { normalizeArea } from "@/lib/portal/area";
import { sendNewTableEmail } from "@/lib/email/newTableEmail";
import { sendTableInviteEmail } from "@/lib/email/tableInviteEmail";
import { loadCohortCandidates, type InviteCandidate } from "@/lib/portal/inviteCandidates";

const ROUND_TYPES = new Set(["casual", "mindful", "lightning"]);

// Create a table in the member's own city+series (or, for admins, their current
// active city + the active series) and seat them at seat 1.
export async function POST(request: Request) {
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // Admins have no home cohort — create in the city they're currently acting in.
  let cityId = session.city_id;
  let seriesId = session.series_id;
  if (session.isAdmin) {
    const ctx = await getAdminContext();
    cityId = ctx.cityId;
    seriesId = ctx.seriesId;
    if (!cityId || !seriesId) {
      return NextResponse.json({ error: "Select an active city first." }, { status: 403 });
    }
  } else if (!seriesId || !cityId) {
    return NextResponse.json({ error: "You need an active paid registration to create a table." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const weekNumber = Number.parseInt(body?.week_number?.toString() ?? "", 10);
  const tableDate = body?.table_date?.toString().trim();
  const tableTime = body?.table_time?.toString().trim();
  const locationName = body?.location_name?.toString().trim();
  const locationAddress = body?.location_address?.toString().trim() || null;
  const roundType = body?.round_type?.toString().trim() || null;
  const notes = body?.notes?.toString().trim() || null;
  // Normalized so "NORTH SHELBY"/"north shelby" collapse to one canonical
  // "North Shelby"; empty/whitespace → null. REQUIRED on create (Step 2) — the
  // null check below enforces it server-side, not just in the form. (The EDIT
  // route deliberately stays lenient so pre-area tables can still be edited.)
  const area = normalizeArea(body?.area?.toString());

  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 9) {
    return NextResponse.json({ error: "Please choose a valid week." }, { status: 400 });
  }
  if (!tableDate || !tableTime || !locationName) {
    return NextResponse.json({ error: "Please fill in the date, time, and location." }, { status: 400 });
  }
  if (!area) {
    return NextResponse.json({ error: "Please choose a part of town for the table." }, { status: 400 });
  }
  if (roundType && !ROUND_TYPES.has(roundType)) {
    return NextResponse.json({ error: "Invalid round type." }, { status: 400 });
  }
  // The date must fall inside the series window. Two checks, both applying to
  // admins too (they go through this route):
  // 1. seriesWeekForDate — the same start-date guard the edit route (PATCH
  //    /api/tables/[id], action "edit") already applies.
  // 2. An explicit ends_at comparison — belt-and-suspenders for the real,
  //    admin-editable end date, in case a future series' ends_at isn't exactly
  //    8 weeks after starts_at (seriesWeekForDate assumes a fixed 8-week span).
  // Both skip gracefully if the relevant series date is unavailable.
  const [seriesStart, seriesEnd] = await Promise.all([getSeriesStartDate(seriesId), getSeriesEndDate(seriesId)]);
  if (seriesStart && seriesWeekForDate(seriesStart, tableDate) === null) {
    return NextResponse.json({ error: "That date is outside the current league window." }, { status: 400 });
  }
  if (seriesEnd && tableDate > seriesEnd) {
    return NextResponse.json({ error: "That date is outside the current league window." }, { status: 400 });
  }

  // week_number is server-authoritative. A client value is NOT trusted: a
  // self-serve host could override the auto-filled week to any value, which
  // silently mislabeled tables and made the Champion award (sum of per-week
  // bests) over-count across weeks that were really one calendar week. Non-admins
  // ALWAYS get the date-derived week. An admin may deliberately override (e.g. a
  // make-up round counting toward a different week) — that's a commissioner
  // decision, gated to admins. Falls back to the submitted value only if the
  // series start is unavailable (misconfigured series), matching the window
  // checks above which also skip gracefully in that case.
  const derivedWeek = seriesStart ? seriesWeekForDate(seriesStart, tableDate) : null;
  const storedWeek = session.isAdmin ? weekNumber : (derivedWeek ?? weekNumber);

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Tables are unavailable right now." }, { status: 503 });
  }

  // Invitees to hold seats for at creation (optional; the creator takes seat 1, so
  // at most 3). Validated against the SAME cohort eligibility as the post-creation
  // invite route — a tampered / out-of-cohort id is rejected here, never held.
  const inviteeIds: string[] = Array.isArray(body?.invitee_ids)
    ? [...new Set((body.invitee_ids as unknown[]).map((v) => String(v)).filter(Boolean))]
    : [];
  if (inviteeIds.length > 3) {
    return NextResponse.json({ error: "You can invite at most 3 players when creating a table." }, { status: 400 });
  }
  let candidates = new Map<string, InviteCandidate>();
  if (inviteeIds.length > 0) {
    candidates = await loadCohortCandidates(admin, cityId, seriesId, new Set([session.id]));
    const invalid = inviteeIds.filter((pid) => !candidates.has(pid));
    if (invalid.length > 0) {
      return NextResponse.json({ error: "One or more selected players can't be invited to this table." }, { status: 400 });
    }
  }

  // Create the table, seat the creator, and place the holds ATOMICALLY — the whole
  // operation is one transaction inside the RPC, so the table never exists with
  // seats open and its intended holds unplaced, and nothing can join it mid-flight
  // (it has no id until this commits). week_number is already server-authoritative
  // (storedWeek); the RPC only stores it.
  const { data: created, error: createError } = await admin.rpc("create_table_with_holds", {
    p_city_id: cityId,
    p_series_id: seriesId,
    p_creator_id: session.id,
    p_week_number: storedWeek,
    p_table_date: tableDate,
    p_table_time: tableTime,
    p_location_name: locationName,
    p_location_address: locationAddress,
    p_area: area,
    p_round_type: roundType,
    p_notes: notes,
    p_invitee_ids: inviteeIds,
  });
  if (createError || !created?.ok) {
    if (created?.error === "too_many_invitees") {
      return NextResponse.json({ error: "You can invite at most 3 players when creating a table." }, { status: 400 });
    }
    return NextResponse.json({ error: "Your table could not be created." }, { status: 500 });
  }
  const tableId: string = created.table_id;
  const heldInvites: { invited_profile_id: string; invite_id: string }[] = created.holds ?? [];

  // City name for the invite + new-table emails (fetched once, reused below).
  const { data: cityRow } = await admin.from("cities").select("name").eq("id", cityId).maybeSingle();
  const cityName = cityRow?.name ?? "your city";

  // Person-to-person invite email per held invitee. Best-effort and consistent
  // with the post-creation route: a failed send RELEASES that hold (the seat
  // genuinely reopens) and the host is told which via the response. Sequential to
  // respect Resend's rate limit.
  const openSeatsAtCreate = Math.max(0, 4 - 1 - heldInvites.length);
  let invitesSent = 0;
  const inviteFailedNames: string[] = [];
  for (const held of heldInvites) {
    const cand = candidates.get(held.invited_profile_id);
    let ok = false;
    if (cand?.email) {
      try {
        const res = await sendTableInviteEmail(
          { email: cand.email, fullName: cand.full_name },
          { tableId, inviterName: session.full_name, cityName, weekNumber: storedWeek, tableDate, tableTime, locationName, roundType, openSeats: openSeatsAtCreate }
        );
        ok = res.ok;
        if (!ok) console.error("tableInviteEmail not sent (create)", cand.email, res.error);
      } catch (err) {
        console.error("tableInviteEmail send failed (create)", cand.email, err);
      }
    }
    if (ok) {
      invitesSent += 1;
    } else {
      await admin.from("table_invites").delete().eq("id", held.invite_id);
      inviteFailedNames.push(cand?.full_name ?? "a player");
    }
  }

  // Notify opted-in paid players in this city+series that a new table opened —
  // gated on the email_new_tables preference (opt-in), excluding the creator AND
  // anyone we just sent a personal invite to (they don't need both). City+series-
  // scoped, so the recipient set is small. Best-effort with a per-recipient
  // try/catch — the table is already created and a send failure must not surface.
  const invitedSet = new Set(inviteeIds);
  try {
    const { data: regs } = await admin
      .from("registrations")
      .select("profile_id, profiles!inner(id, email, full_name, notification_preferences)")
      .eq("paid_status", "paid")
      .eq("city_id", cityId)
      .eq("series_id", seriesId);
    for (const r of (regs ?? []) as any[]) {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      if (!p || p.id === session.id || invitedSet.has(p.id) || !p.email) continue; // skip creator, invitees, no-email
      if (!resolvePrefs(p.notification_preferences).email_new_tables) continue; // opt-in
      try {
        const res = await sendNewTableEmail(
          { email: p.email, fullName: p.full_name },
          { tableId, cityName, tableDate, tableTime, locationName, locationAddress, roundType }
        );
        if (!res.ok) console.error("newTableEmail not sent", p.email, res.error);
      } catch (err) {
        console.error("newTableEmail send failed", p.email, err);
      }
    }
  } catch (err) {
    console.error("newTableEmail batch failed", err);
  }

  return NextResponse.json({
    id: tableId,
    invites: { sent: invitesSent, failed: inviteFailedNames.length, failedNames: inviteFailedNames },
  });
}
