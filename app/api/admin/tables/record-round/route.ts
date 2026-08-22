import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { loadCohortCandidates } from "@/lib/portal/inviteCandidates";
import { getSeriesStartDate, getSeriesEndDate } from "@/lib/portal/tables";
import { seriesWeekForDate } from "@/lib/portal/seriesWeek";

export const runtime = "nodejs";

const ROUND_TYPES = new Set(["casual", "mindful", "lightning"]);
// Stay bonus is 0 as of the Aug 2026 rules change — mirrors POST /api/scores so
// the recorded no-show round is byte-identical to a normally-entered one.
const NO_SHOW_STAY_BONUS = 0;

type InputPlayer = { user_id: string; round_score?: number | string; is_no_show?: boolean };

// Admin: create a COMPLETED, SCORED table for a round that already happened, in
// one atomic operation (the record_past_round RPC, migration 047). This route does
// all validation, derives the week server-side, builds the score rows with the
// same flags as POST /api/scores, then hands the write to the RPC. It sends NO
// emails and creates no held seats — this records history, it doesn't organize a
// game. Every notification that the normal paths fire is deliberately absent here:
//   * adminAddedToTableEmail — the normal admin "add player" send. NOT sent.
//   * tableFilledEmail       — the "your table is full" send. NOT sent.
//   * scorePostedEmail       — the POST /api/scores per-player send. NOT sent.
//   * hostNoShowEmail        — the host-no-show send. NOT sent.
// None are imported or called on this path.
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // isAdminRequest already resolved the session (cached); reuse it for submitted_by.
  const session = await getPortalUser();
  const adminId = session && session.status === "active" ? session.id : null;
  if (!adminId) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cityId = body?.city_id?.toString();
  const seriesId = body?.series_id?.toString();
  const tableDate = body?.table_date?.toString().trim();
  const tableTime = body?.table_time?.toString().trim();
  const locationName = body?.location_name?.toString().trim();
  const locationAddress = body?.location_address?.toString().trim() || null;
  const area = body?.area?.toString().trim() || null;
  const roundType = body?.round_type?.toString().trim().toLowerCase();
  const hostId = body?.host_id?.toString();
  const inputPlayers: InputPlayer[] = Array.isArray(body?.players) ? body.players : [];

  if (!cityId || !seriesId || !tableDate || !tableTime || !locationName || !hostId) {
    return NextResponse.json({ error: "Please fill in the city, league, date, time, venue, and host." }, { status: 400 });
  }
  if (!roundType || !ROUND_TYPES.has(roundType)) {
    return NextResponse.json({ error: "Please choose a round type." }, { status: 400 });
  }

  // Exactly four DISTINCT players, and the host must be one of them.
  if (inputPlayers.length !== 4) {
    return NextResponse.json({ error: "A round needs exactly four players." }, { status: 400 });
  }
  const ids = inputPlayers.map((p) => p?.user_id?.toString()).filter(Boolean) as string[];
  if (ids.length !== 4 || new Set(ids).size !== 4) {
    return NextResponse.json({ error: "Choose four different players — no duplicates." }, { status: 400 });
  }
  if (!ids.includes(hostId)) {
    return NextResponse.json({ error: "The host must be one of the four players." }, { status: 400 });
  }

  // Future dates are always an error here — this tool records rounds that already
  // happened. "Today" in the app's default zone so a same-day round isn't rejected
  // by a UTC roll-over. (The venue's own zone would be marginally tighter, but the
  // league window + this floor already bound it correctly for a historical record.)
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  if (tableDate > todayStr) {
    return NextResponse.json({ error: "You can only record rounds that have already been played." }, { status: 400 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  // Date must fall inside the league window, and the week is derived from the date
  // (never client-supplied) — identical rule to POST /api/tables.
  const [seriesStart, seriesEnd] = await Promise.all([getSeriesStartDate(seriesId), getSeriesEndDate(seriesId)]);
  if (!seriesStart) {
    return NextResponse.json({ error: "That league could not be found." }, { status: 400 });
  }
  const week = seriesWeekForDate(seriesStart, tableDate);
  if (week === null || (seriesEnd && tableDate > seriesEnd) || tableDate < seriesStart) {
    return NextResponse.json({ error: "That date is outside the league window." }, { status: 400 });
  }

  // Cohort guard (server-side, not just the picker): every one of the four must be
  // a PAID player in this city + league. Same source as the picker so they can't
  // drift. Rejects an out-of-cohort id posted directly to the API.
  const cohort = await loadCohortCandidates(admin, cityId, seriesId, new Set<string>(), true);
  const outsiders = ids.filter((id) => !cohort.has(id));
  if (outsiders.length > 0) {
    return NextResponse.json({ error: "Every player must be a paid member of this city and league." }, { status: 400 });
  }

  // Build the score rows with the SAME flags POST /api/scores writes. Any player
  // marked no-show makes it a no-show round: the absent get is_no_show (0), the
  // rest get is_no_show_bonus (0). Otherwise each stores their round_score.
  const anyNoShow = inputPlayers.some((p) => p.is_no_show === true);
  const playerRows = inputPlayers.map((p) => {
    const userId = p.user_id!.toString();
    if (anyNoShow) {
      return p.is_no_show === true
        ? { user_id: userId, round_score: 0, is_no_show: true, is_no_show_bonus: false }
        : { user_id: userId, round_score: NO_SHOW_STAY_BONUS, is_no_show: false, is_no_show_bonus: true };
    }
    const score = Number.parseInt(String(p.round_score ?? 0), 10);
    return { user_id: userId, round_score: Number.isInteger(score) && score >= 0 ? score : 0, is_no_show: false, is_no_show_bonus: false };
  });
  const otherIds = ids.filter((id) => id !== hostId); // exactly 3

  // One atomic write. If any step inside fails, the whole thing rolls back.
  const { data: result, error } = await admin.rpc("record_past_round", {
    p_city_id: cityId,
    p_series_id: seriesId,
    p_host_id: hostId,
    p_week_number: week,
    p_table_date: tableDate,
    p_table_time: tableTime,
    p_location_name: locationName,
    p_location_address: locationAddress,
    p_area: area,
    p_round_type: roundType,
    p_submitted_by: adminId,
    p_other_ids: otherIds,
    p_players: playerRows,
  });

  if (error || !result || result.ok !== true) {
    console.error("record_past_round failed", error ?? result);
    return NextResponse.json({ error: "That round could not be recorded. Nothing was saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, table_id: result.table_id, week_number: week });
}
