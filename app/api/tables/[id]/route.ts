import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { scoringSeats } from "@/lib/portal/tables";

// Creator/admin table actions. Seats are left intact; status drives display.
//   action: "cancel"   → status canceled
//   action: "complete" → status completed (marks the round played; unlocks
//                        host score entry)
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "cancel" && action !== "complete") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Tables are unavailable right now." }, { status: 503 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, creator_id, status, table_date, table_time, cities(timezone), table_seats(seat_number, canceled_at)")
    .eq("id", id)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (table.creator_id !== session.id && !session.isAdmin) {
    return NextResponse.json({ error: "Only the table host can do that." }, { status: 403 });
  }

  if (action === "cancel") {
    if (table.status === "canceled") return NextResponse.json({ ok: true });
    const { error } = await admin.from("league_tables").update({ status: "canceled" }).eq("id", id);
    if (error) return NextResponse.json({ error: "The table couldn't be cancelled. Please try again." }, { status: 500 });
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
