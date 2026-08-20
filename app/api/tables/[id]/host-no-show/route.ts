import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { zonedTimeToUtc } from "@/lib/format/zonedTime";
import { sendHostNoShowEmail } from "@/lib/email/hostNoShowEmail";

export const runtime = "nodejs";

const DEFAULT_TIMEZONE = "America/Chicago";

// A seated NON-host records the host as a no-show (Aug 2026 change). When the host
// is the one who didn't show, the table can't play three-handed and the remaining
// players had no way to record it (Linda McKnight, Northwest MS, Aug 19, needed
// manual intervention). This is the WHOLE action — no scores are entered, because
// no game was played. The host takes the −20; the other seated players "stayed"
// (is_no_show_bonus at 0). The submission is tagged in admin_notes and stamped with
// submitted_by so there's a trail, and the host is emailed.
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Unavailable right now." }, { status: 503 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, creator_id, status, table_date, table_time, location_name, cities(timezone), table_seats(user_id, canceled_at), profiles(full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (table.status !== "open" && table.status !== "full") {
    return NextResponse.json({ error: "This table's game is already completed or canceled." }, { status: 409 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeSeats = ((table.table_seats ?? []) as any[]).filter((s) => !s.canceled_at);
  const seatedIds = new Set(activeSeats.map((s: any) => s.user_id));

  // Authorization: an actively-seated player on THIS table, and not the host
  // themselves (a host uses normal score entry, not this). Re-enforced here so a
  // direct POST from a non-seated user is rejected.
  if (!seatedIds.has(session.id)) {
    return NextResponse.json({ error: "Only a player seated at this table can do that." }, { status: 403 });
  }
  if (session.id === table.creator_id) {
    return NextResponse.json({ error: "The host can't record their own no-show." }, { status: 403 });
  }
  if (!seatedIds.has(table.creator_id)) {
    return NextResponse.json({ error: "The host isn't seated at this table." }, { status: 409 });
  }

  // Only after the scheduled start time has passed — never pre-emptively. Venue-local
  // start resolved to a UTC instant via the city's timezone (same as the no-show cutoff).
  const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
  const startInstant = zonedTimeToUtc(table.table_date, table.table_time ?? "12:00:00", city?.timezone ?? DEFAULT_TIMEZONE);
  if (Number.isNaN(startInstant.getTime()) || Date.now() < startInstant.getTime()) {
    return NextResponse.json({ error: "You can only mark a host no-show after the table's start time." }, { status: 409 });
  }

  const reporter = session.full_name ?? null;

  // Host → is_no_show (−20 via the standings view); every other seated player →
  // is_no_show_bonus at 0 ("stayed", no penalty, no bonus). Same row shape as a
  // normal no-show so the standings exclusions apply unchanged.
  const rows = activeSeats.map((s: any) =>
    s.user_id === table.creator_id
      ? { user_id: s.user_id, round_score: 0, is_no_show: true, is_no_show_bonus: false }
      : { user_id: s.user_id, round_score: 0, is_no_show: false, is_no_show_bonus: true }
  );

  const { data: submission, error: subError } = await admin
    .from("score_submissions")
    .insert({ table_id: id, submitted_by: session.id, status: "submitted", admin_notes: `Host no-show recorded by ${reporter ?? "a seated player"}` })
    .select("id")
    .single();
  if (subError || !submission) {
    // Unique table_id violation = already recorded/scored (also guards a double tap).
    if (subError?.code === "23505") {
      return NextResponse.json({ error: "This table has already been recorded." }, { status: 409 });
    }
    return NextResponse.json({ error: "That couldn't be recorded. Please try again." }, { status: 500 });
  }

  const { error: playersError } = await admin
    .from("score_submission_players")
    .insert(rows.map((r: any) => ({ ...r, score_submission_id: submission.id })));
  if (playersError) {
    await admin.from("score_submissions").delete().eq("id", submission.id); // roll back so a retry works
    return NextResponse.json({ error: "That couldn't be recorded. Please try again." }, { status: 500 });
  }

  await admin.from("league_tables").update({ status: "completed" }).eq("id", id);

  // Notify the host (the penalized party). Best-effort — the record is committed.
  try {
    const { data: host } = await admin.from("profiles").select("email, full_name").eq("id", table.creator_id).maybeSingle();
    if (host?.email) {
      const res = await sendHostNoShowEmail(
        { email: host.email, fullName: host.full_name },
        { tableId: id, tableDate: table.table_date, locationName: table.location_name, reporterName: reporter }
      );
      if (!res.ok) console.error("hostNoShowEmail not sent", host.email, res.error);
    }
  } catch (err) {
    console.error("hostNoShowEmail failed", err);
  }

  return NextResponse.json({ ok: true });
}
