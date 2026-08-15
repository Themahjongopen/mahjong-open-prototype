import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { sendTableFilledEmail } from "@/lib/email/tableFilledEmail";

// Claim an open seat at a table in the member's series.
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
    .select("id, series_id, status, table_date, table_time, location_name, location_address, round_type, table_seats(seat_number, user_id, canceled_at)")
    .eq("id", id)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (!session.isAdmin && table.series_id !== session.series_id) {
    return NextResponse.json({ error: "That table isn't in your series." }, { status: 403 });
  }
  if (table.status !== "open") {
    return NextResponse.json({ error: "This table isn't open for new players." }, { status: 409 });
  }

  const active = (table.table_seats ?? []).filter((s: any) => !s.canceled_at);
  if (active.some((s: any) => s.user_id === session.id)) {
    return NextResponse.json({ error: "You're already seated at this table." }, { status: 409 });
  }
  if (active.length >= 4) {
    return NextResponse.json({ error: "This table is full." }, { status: 409 });
  }

  const taken = new Set(active.map((s: any) => s.seat_number));
  const seatNumber = [1, 2, 3, 4].find((n) => !taken.has(n));
  if (!seatNumber) {
    return NextResponse.json({ error: "This table is full." }, { status: 409 });
  }

  const { error: insertError } = await admin
    .from("table_seats")
    .insert({ table_id: id, user_id: session.id, seat_number: seatNumber });

  if (insertError) {
    // Unique-violation = someone grabbed the seat between our read and write.
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "That spot was just taken — try again." }, { status: 409 });
    }
    return NextResponse.json({ error: "You couldn't be seated. Please try again." }, { status: 500 });
  }

  // Fourth seat closes the table.
  if (active.length + 1 >= 4) {
    await admin.from("league_tables").update({ status: "full" }).eq("id", id);
    // Notify ALL FOUR now-seated players: the three already seated (`active`,
    // read before the insert) PLUS the joiner (session.id) who just took the 4th
    // seat. The joiner gets the "you completed this table" variant; the other
    // three get the standard "your table is now full". Pref-gated equally for all
    // — the joiner is NOT a special case on preferences. Deduped so nobody gets
    // two. Best-effort with per-recipient try/catch — the join has already
    // committed and must never be blocked or rolled back by a send.
    try {
      const uniqueIds = [...new Set([...active.map((s: any) => s.user_id).filter(Boolean), session.id])];
      if (uniqueIds.length) {
        const { data: profiles } = await admin
          .from("profiles")
          .select("id, email, full_name, notification_preferences")
          .in("id", uniqueIds);
        for (const p of (profiles ?? []) as any[]) {
          if (!p.email) continue;
          if (resolvePrefs(p.notification_preferences).email_table_filled === false) continue; // opted out
          try {
            const res = await sendTableFilledEmail(
              { email: p.email, fullName: p.full_name },
              {
                tableId: id,
                tableDate: table.table_date,
                tableTime: table.table_time,
                locationName: table.location_name,
                locationAddress: table.location_address,
                roundType: table.round_type,
              },
              { acting: p.id === session.id }
            );
            if (!res.ok) console.error("tableFilledEmail not sent", p.email, res.error);
          } catch (err) {
            console.error("tableFilledEmail send failed", p.email, err);
          }
        }
      }
    } catch (err) {
      console.error("tableFilledEmail batch failed", err);
    }
  }

  return NextResponse.json({ ok: true, seat_number: seatNumber });
}
