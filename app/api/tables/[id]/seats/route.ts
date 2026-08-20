import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { sendTableFilledEmail } from "@/lib/email/tableFilledEmail";
import { holdCutoffIso } from "@/lib/portal/holdExpiry";

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
    .select("id, series_id, status, table_date, table_time, location_name, location_address, round_type, table_seats(id, seat_number, user_id, canceled_at)")
    .eq("id", id)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (!session.isAdmin && table.series_id !== session.series_id) {
    return NextResponse.json({ error: "That table isn't in your league." }, { status: 403 });
  }
  if (table.status !== "open") {
    return NextResponse.json({ error: "This table isn't open for new players." }, { status: 409 });
  }

  // Claim atomically: claim_seat takes the table's advisory lock, re-checks
  // active seats + live holds — EXCLUDING this user's own hold, so an invitee can
  // accept the very seat held for them — is < 4, picks the lowest free seat
  // number, inserts, and converts this user's own pending hold to 'accepted'. It
  // is idempotent (an already-seated user gets their existing seat back, never a
  // second row), replacing the old read-then-insert + 23505 dance. The partial
  // unique indexes uq_table_seats_active_seat/_user remain the DB backstop. The
  // cutoff is holdCutoffIso() (server clock) — never from the request body.
  const { data: claim, error: claimError } = await admin.rpc("claim_seat", {
    p_table_id: id,
    p_user_id: session.id,
    p_hold_cutoff: holdCutoffIso(),
  });

  if (claimError) {
    return NextResponse.json({ error: "You couldn't be seated. Please try again." }, { status: 500 });
  }
  if (!claim?.ok) {
    return NextResponse.json({ error: "This table is full." }, { status: 409 });
  }
  if (claim.already) {
    return NextResponse.json({ ok: true, seat_number: claim.seat_number, seatId: claim.seat_id });
  }

  // Fourth REAL seat closes the table. now_full is active-seats-based (holds never
  // flip status), so status='full' still means four actual players.
  if (claim.now_full) {
    await admin.from("league_tables").update({ status: "full" }).eq("id", id);
    // Notify the four now-seated players (joiner gets the "you completed this
    // table" variant; the others the standard "now full"). Re-read the seated set
    // rather than a pre-insert snapshot so a concurrent fill can't skew the list.
    // Pref-gated equally; deduped; best-effort per-recipient — the join has
    // already committed and must never be blocked or rolled back by a send.
    try {
      const { data: seatedNow } = await admin
        .from("table_seats")
        .select("user_id")
        .eq("table_id", id)
        .is("canceled_at", null);
      const uniqueIds = [...new Set((seatedNow ?? []).map((s: any) => s.user_id).filter(Boolean))];
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

  return NextResponse.json({ ok: true, seat_number: claim.seat_number, seatId: claim.seat_id });
}
