import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";

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
    .select("id, creator_id, status, table_seats(id, user_id, canceled_at)")
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

  const { error: cancelError } = await admin
    .from("table_seats")
    .update({ canceled_at: new Date().toISOString() })
    .eq("id", mySeat.id)
    .is("canceled_at", null);

  if (cancelError) {
    return NextResponse.json({ error: "Your seat couldn't be cancelled. Please try again." }, { status: 500 });
  }

  // Reopen a previously-full table now that a seat is free.
  if (table.status === "full") {
    await admin.from("league_tables").update({ status: "open" }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
