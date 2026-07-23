import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";
import { createAdminClient } from "@/lib/supabase/server";

const SKILLS = new Set(["beginner", "intermediate", "advanced"]);
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
  const skillLevel = body?.skill_level?.toString().trim() || null;
  const roundType = body?.round_type?.toString().trim() || null;
  const notes = body?.notes?.toString().trim() || null;

  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 9) {
    return NextResponse.json({ error: "Please choose a valid week." }, { status: 400 });
  }
  if (!tableDate || !tableTime || !locationName) {
    return NextResponse.json({ error: "Please fill in the date, time, and location." }, { status: 400 });
  }
  if (skillLevel && !SKILLS.has(skillLevel)) {
    return NextResponse.json({ error: "Invalid skill level." }, { status: 400 });
  }
  if (roundType && !ROUND_TYPES.has(roundType)) {
    return NextResponse.json({ error: "Invalid round type." }, { status: 400 });
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
      skill_level: skillLevel,
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

  return NextResponse.json({ id: table.id });
}
