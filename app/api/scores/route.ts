import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";

const NO_SHOW_STAY_BONUS = 25;

type InputPlayer = { user_id: string; round_score?: number; is_no_show?: boolean };

// Host submits a round's scores. Posts immediately (no approval gate).
// Normal round: store each player's round_score. No-show round (any player
// marked absent): the absent players get is_no_show (round_score 0) and every
// remaining seated player gets a +25 is_no_show_bonus row — no real scores are
// recorded, since a short-handed round doesn't count as a played round. The
// −25 penalty is derived on read by the standings views, never stored here.
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
    .select("id, creator_id, status, table_seats(user_id, canceled_at), score_submissions(id)")
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
  if (table.score_submissions?.length) {
    return NextResponse.json({ error: "Scores have already been submitted for this table." }, { status: 409 });
  }

  // The submission must cover exactly the actively-seated players.
  const seatedIds = new Set<string>((table.table_seats ?? []).filter((s: any) => !s.canceled_at).map((s: any) => String(s.user_id)));
  const inputIds = new Set<string>(inputPlayers.map((p) => p.user_id));
  if (seatedIds.size !== inputIds.size || [...seatedIds].some((id) => !inputIds.has(id))) {
    return NextResponse.json({ error: "Scores must be entered for every seated player." }, { status: 400 });
  }

  const anyNoShow = inputPlayers.some((p) => p.is_no_show === true);
  const rows = inputPlayers.map((p) => {
    if (anyNoShow) {
      return p.is_no_show
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

  return NextResponse.json({ ok: true });
}
