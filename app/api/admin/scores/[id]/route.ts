import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { correctSubmissionScores } from "@/lib/scores/correctSubmission";

// Admin score corrections for one submission (no approval workflow):
//   { action: "void" }              -> status voided (round no longer counts)
//   { players: [{ id, round_score }] } -> fix scores, status edited
// Standings are computed on read, so either takes effect immediately.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  const { data: submission } = await admin.from("score_submissions").select("id").eq("id", id).maybeSingle();
  if (!submission) {
    return NextResponse.json({ error: "That submission no longer exists." }, { status: 404 });
  }

  if (body?.action === "void") {
    const { error } = await admin.from("score_submissions").update({ status: "voided", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) return NextResponse.json({ error: "The round couldn't be voided. Please try again." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const players = Array.isArray(body?.players) ? body.players : null;
  if (!players || players.length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // Validate + update the rows, flip status to 'edited', and notify seated
  // players — shared with the host self-correction route so both paths stay in
  // lockstep (and both send the correction email). Void, above, is untouched.
  const result = await correctSubmissionScores(admin, id, players);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
