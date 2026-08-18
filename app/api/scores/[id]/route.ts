import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { correctSubmissionScores } from "@/lib/scores/correctSubmission";

export const runtime = "nodejs";

// Host-facing score correction (submission id in the URL — kept separate from the
// admin route so the two authorization models don't tangle in one handler).
//   PATCH { players: [{ id, round_score }] }
// Allowed only for the table's HOST, only within 24h of submitting, and never on
// a voided submission. After those checks, the actual update + notification is
// the shared correctSubmissionScores() (same as the admin route uses). After 24h
// a correction still goes through the admin flow, unchanged.
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Scores are unavailable right now." }, { status: 503 });
  }

  const { data: submission } = await admin
    .from("score_submissions")
    .select("id, status, created_at, league_tables(creator_id)")
    .eq("id", id)
    .maybeSingle();
  if (!submission) {
    return NextResponse.json({ error: "That submission no longer exists." }, { status: 404 });
  }
  if (submission.status === "voided") {
    return NextResponse.json({ error: "This round was voided and can no longer be corrected." }, { status: 409 });
  }

  const table = Array.isArray(submission.league_tables) ? submission.league_tables[0] : submission.league_tables;
  if (!table || table.creator_id !== session.id) {
    return NextResponse.json({ error: "Only the table host can correct these scores." }, { status: 403 });
  }
  if (Date.now() - new Date(submission.created_at).getTime() > EDIT_WINDOW_MS) {
    return NextResponse.json(
      { error: "This can only be corrected within 24 hours of submitting. Contact an admin for a correction after that." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const players = Array.isArray(body?.players) ? body.players : null;
  if (!players || players.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const result = await correctSubmissionScores(admin, id, players);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
