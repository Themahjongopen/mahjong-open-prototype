import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTableUnderfilledEmail } from "@/lib/email/tableUnderfilledEmail";

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

  // If this cancellation just dropped the table from 4 → 3 active players, tell
  // the remaining players a seat opened up. Fire ONLY on that 4→3 transition
  // (activeAfter === 3) — cancelling from an already-short table (3/2/1) must not
  // re-spam the remaining players. Counted from the seat data already fetched
  // above (no extra query); a 5th active seat is impossible given the 4-seat cap,
  // and the exact-3 check would ignore it anyway. Best-effort, fully wrapped —
  // the seat cancel is already committed and must not be blocked by a send.
  // Sent UNCONDITIONALLY — intentionally NOT gated on notification_preferences,
  // same rationale as the table-updated email: a player who muted reminders still
  // needs to know their table dropped below four.
  const activeBefore = (table.table_seats ?? []).filter((s: any) => !s.canceled_at).length;
  const activeAfter = activeBefore - 1; // we just cancelled exactly one active seat
  if (activeAfter === 3) {
    try {
      const remainingIds = (table.table_seats ?? [])
        .filter((s: any) => !s.canceled_at && s.id !== mySeat.id && s.user_id)
        .map((s: any) => s.user_id);
      if (remainingIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", remainingIds);
        for (const p of (profiles ?? []) as any[]) {
          if (!p.email) continue;
          try {
            const res = await sendTableUnderfilledEmail(
              { email: p.email, fullName: p.full_name },
              {
                tableId: id,
                tableDate: table.table_date,
                tableTime: table.table_time,
                locationName: table.location_name,
                locationAddress: table.location_address,
                roundType: table.round_type,
                activeCount: activeAfter,
              }
            );
            if (!res.ok) console.error("tableUnderfilledEmail not sent", p.email, res.error);
          } catch (err) {
            console.error("tableUnderfilledEmail send failed", p.email, err);
          }
        }
      }
    } catch (err) {
      console.error("tableUnderfilledEmail batch failed", err);
    }
  }

  return NextResponse.json({ ok: true });
}
