import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { cancelSeatsAndNotify } from "@/lib/portal/cancelSeatsAndNotify";

// Leave your seat — frees it for anyone to claim. Allowed at any time; per the
// scoring spec a late (<24h) cancellation with no replacement becomes a
// host-marked no-show at score time, not a block here. Creators cancel the
// whole table instead (PATCH /api/tables/[id]).
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
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
    .select("id, creator_id, status, table_date, table_time, location_name, location_address, round_type, table_seats(id, user_id, canceled_at)")
    .eq("id", id)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (table.creator_id === session.id) {
    return NextResponse.json(
      { error: "You created this table — cancel the whole table instead of leaving your seat." },
      { status: 400 }
    );
  }

  const mySeat = (table.table_seats ?? []).find((s: any) => s.user_id === session.id && !s.canceled_at);
  if (!mySeat) {
    return NextResponse.json({ error: "You're not seated at this table." }, { status: 409 });
  }

  // Cancel the seat, reopen the table if it drops out of 'full', and notify the
  // remaining players on a 4→3 drop — all shared with change-city and refund
  // (lib/portal/cancelSeatsAndNotify). Here the cancel is the PRIMARY action, so
  // a seat-update error surfaces as a 500 (side-effect callers ignore it).
  const { cancelError } = await cancelSeatsAndNotify(admin, [mySeat.id], session.id);
  if (cancelError) {
    return NextResponse.json({ error: "Your seat couldn't be cancelled. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
