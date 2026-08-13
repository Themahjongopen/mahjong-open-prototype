import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";
import { createAdminClient } from "@/lib/supabase/server";
import { getSeriesStartDate, getSeriesEndDate } from "@/lib/portal/tables";
import { seriesWeekForDate } from "@/lib/portal/seriesWeek";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { sendNewTableEmail } from "@/lib/email/newTableEmail";

const ROUND_TYPES = new Set(["social", "focused", "lightning"]);

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

  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 9) {
    return NextResponse.json({ error: "Please choose a valid week." }, { status: 400 });
  }
  if (!tableDate || !tableTime || !locationName) {
    return NextResponse.json({ error: "Please fill in the date, time, and location." }, { status: 400 });
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
    return NextResponse.json({ error: "That date is outside the current series window." }, { status: 400 });
  }
  if (seriesEnd && tableDate > seriesEnd) {
    return NextResponse.json({ error: "That date is outside the current series window." }, { status: 400 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Tables are unavailable right now." }, { status: 503 });
  }

  const { data: table, error: tableError } = await admin
    .from("league_tables")
    .insert({
      city_id: cityId,
      series_id: seriesId,
      creator_id: session.id,
      week_number: weekNumber,
      table_date: tableDate,
      table_time: tableTime,
      location_name: locationName,
      location_address: locationAddress,
      round_type: roundType,
      notes,
      status: "open",
    })
    .select("id")
    .single();

  if (tableError || !table) {
    return NextResponse.json({ error: "Your table could not be created." }, { status: 500 });
  }

  const { error: seatError } = await admin
    .from("table_seats")
    .insert({ table_id: table.id, user_id: session.id, seat_number: 1 });

  if (seatError) {
    // Roll back the table so we don't leave a creator-less table behind.
    await admin.from("league_tables").delete().eq("id", table.id);
    return NextResponse.json({ error: "Your table could not be created." }, { status: 500 });
  }

  // Notify opted-in paid players in this city+series that a new table opened —
  // gated on the email_new_tables preference (opt-in), excluding the creator.
  // City+series-scoped, so the recipient set is small. Best-effort with a
  // per-recipient try/catch (same shape as tableUnderfilled/tableUpdated) — the
  // table is already created and a send failure must not surface to the host.
  try {
    const { data: cityRow } = await admin.from("cities").select("name").eq("id", cityId).maybeSingle();
    const cityName = cityRow?.name ?? "your city";
    const { data: regs } = await admin
      .from("registrations")
      .select("profile_id, profiles!inner(id, email, full_name, notification_preferences)")
      .eq("paid_status", "paid")
      .eq("city_id", cityId)
      .eq("series_id", seriesId);
    for (const r of (regs ?? []) as any[]) {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      if (!p || p.id === session.id || !p.email) continue; // skip the creator + any no-email row
      if (!resolvePrefs(p.notification_preferences).email_new_tables) continue; // opt-in
      try {
        const res = await sendNewTableEmail(
          { email: p.email, fullName: p.full_name },
          { tableId: table.id, cityName, tableDate, tableTime, locationName, locationAddress, roundType }
        );
        if (!res.ok) console.error("newTableEmail not sent", p.email, res.error);
      } catch (err) {
        console.error("newTableEmail send failed", p.email, err);
      }
    }
  } catch (err) {
    console.error("newTableEmail batch failed", err);
  }

  return NextResponse.json({ id: table.id });
}
