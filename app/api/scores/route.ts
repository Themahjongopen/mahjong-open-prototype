import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { sendScorePostedEmail } from "@/lib/email/scorePostedEmail";
import { scoringSeats } from "@/lib/portal/tables";
import { hasSubmission } from "@/lib/portal/scores";

// Stay bonus: 0 as of the Aug 2026 rules change (was +25). The is_no_show_bonus
// row is still written (at 0) so the record of who stayed — and its exclusion from
// averages/rounds/Flight, which is keyed on the flag not the value — is preserved.
const NO_SHOW_STAY_BONUS = 0;

type InputPlayer = { user_id: string; round_score?: number; is_no_show?: boolean };

// Host submits a round's scores. Posts immediately (no approval gate).
// Normal round: store each player's round_score. No-show round (any player
// marked absent): the absent players get is_no_show (round_score 0) and every
// remaining seated player gets a 0-valued is_no_show_bonus row — no real scores
// are recorded, since a short-handed round doesn't count as a played round. The
// −20 penalty is derived on read by the standings views, never stored here.
export async function POST(request: Request) {
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tableId = body?.table_id?.toString();
  const inputPlayers: InputPlayer[] = Array.isArray(body?.players) ? body.players : [];
  if (!tableId || inputPlayers.length === 0) {
    return NextResponse.json({ error: "Missing table or players." }, { status: 400 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Scores are unavailable right now." }, { status: 503 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, creator_id, status, table_date, table_time, location_name, cities(timezone), table_seats(user_id, seat_number, canceled_at), score_submissions(id)")
    .eq("id", tableId)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (table.creator_id !== session.id && !session.isAdmin) {
    return NextResponse.json({ error: "Only the table host can submit scores." }, { status: 403 });
  }
  if (table.status !== "completed") {
    return NextResponse.json({ error: "Mark the table as played before submitting scores." }, { status: 409 });
  }
  if (hasSubmission(table)) {
    return NextResponse.json({ error: "Scores have already been submitted for this table." }, { status: 409 });
  }

  // Scoring seats = active seats + any seat whose most recent occupant cancelled
  // within 24h and was never re-claimed. The late-cancellation users are forced
  // to a no-show below, regardless of what the client submitted.
  const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
  const { active, lateCancellations } = scoringSeats({
    table_date: table.table_date,
    table_time: table.table_time,
    timezone: city?.timezone ?? null,
    table_seats: table.table_seats ?? [],
  });
  const lateCancelIds = new Set<string>(lateCancellations.map((s) => String(s.user_id)));
  const seatedIds = new Set<string>([...active, ...lateCancellations].map((s) => String(s.user_id)));
  // An official round needs 4 scoring seats. Defense-in-depth: a seat can be
  // cancelled after the table is marked "completed" but before scores are
  // submitted (seats/cancel doesn't check table status), so re-check here.
  if (seatedIds.size < 4) {
    return NextResponse.json({ error: "A round needs exactly 4 seated players before scores can be submitted." }, { status: 400 });
  }
  const inputIds = new Set<string>(inputPlayers.map((p) => p.user_id));
  if (seatedIds.size !== inputIds.size || [...seatedIds].some((id) => !inputIds.has(id))) {
    return NextResponse.json({ error: "Scores must be entered for every seated player." }, { status: 400 });
  }

  // A late-cancelled seat is ALWAYS a no-show, overriding whatever the client
  // sent — this is the enforcement of the forced no-show, not just a UI nicety.
  const anyNoShow = lateCancelIds.size > 0 || inputPlayers.some((p) => p.is_no_show === true);
  const rows = inputPlayers.map((p) => {
    const isNoShow = lateCancelIds.has(String(p.user_id)) || p.is_no_show === true;
    if (anyNoShow) {
      return isNoShow
        ? { user_id: p.user_id, round_score: 0, is_no_show: true, is_no_show_bonus: false }
        : { user_id: p.user_id, round_score: NO_SHOW_STAY_BONUS, is_no_show: false, is_no_show_bonus: true };
    }
    const score = Number.parseInt(String(p.round_score ?? 0), 10);
    return { user_id: p.user_id, round_score: Number.isInteger(score) && score >= 0 ? score : 0, is_no_show: false, is_no_show_bonus: false };
  });

  const { data: submission, error: subError } = await admin
    .from("score_submissions")
    .insert({ table_id: tableId, submitted_by: session.id, status: "submitted" })
    .select("id")
    .single();

  if (subError || !submission) {
    // Unique table_id violation = a submission landed first.
    if (subError?.code === "23505") {
      return NextResponse.json({ error: "Scores have already been submitted for this table." }, { status: 409 });
    }
    return NextResponse.json({ error: "Scores could not be submitted. Please try again." }, { status: 500 });
  }

  const { error: playersError } = await admin
    .from("score_submission_players")
    .insert(rows.map((r) => ({ ...r, score_submission_id: submission.id })));

  if (playersError) {
    await admin.from("score_submissions").delete().eq("id", submission.id);
    return NextResponse.json({ error: "Scores could not be submitted. Please try again." }, { status: 500 });
  }

  // Best-effort "scores posted" emails to each seated player EXCEPT the host who
  // just entered them. Scores are already committed above — email delivery is a
  // secondary effect and must never block or fail the submission, so everything
  // here is wrapped in try/catch and we always return { ok: true } below.
  try {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, full_name, notification_preferences")
      .in("id", [...seatedIds]);
    const rowByUser = new Map(rows.map((r) => [r.user_id, r]));
    for (const profile of (profiles ?? []) as any[]) {
      if (profile.id === session.id) continue; // the host already knows — they entered the scores
      if (!profile.email) continue;
      if (!resolvePrefs(profile.notification_preferences).email_score_posted) continue;
      const row = rowByUser.get(profile.id);
      if (!row) continue;
      try {
        const res = await sendScorePostedEmail(
          { email: profile.email, fullName: profile.full_name },
          { tableId: table.id, tableDate: table.table_date, locationName: table.location_name },
          { roundScore: row.round_score, isNoShow: row.is_no_show, isNoShowBonus: row.is_no_show_bonus }
        );
        if (!res.ok) console.error("scorePostedEmail not sent", profile.email, res.error);
      } catch (err) {
        console.error("scorePostedEmail send failed", profile.email, err);
      }
    }
  } catch (err) {
    console.error("scorePostedEmail batch failed", err);
  }

  return NextResponse.json({ ok: true });
}
