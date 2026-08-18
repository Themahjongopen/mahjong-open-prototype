import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { cancelSeatsAndNotify } from "@/lib/portal/cancelSeatsAndNotify";

export const runtime = "nodejs";

// Admin-only: remove ONE seated player from a table without canceling the whole
// table. Reuses cancelSeatsAndNotify (same helper as self-serve leave-seat,
// admin change-city, and admin refund) so seat cancellation, reopening a table
// that drops out of 'full', and the 4->3 underfilled-notify email all stay in
// lockstep with every other place a player leaves a table.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (body?.action !== "remove_seat" || typeof body?.seatId !== "string") {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

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
