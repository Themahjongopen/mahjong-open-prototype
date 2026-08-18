import { sendScoreCorrectedEmail } from "@/lib/email/scoreCorrectedEmail";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

// Shared correction logic for BOTH the admin Score Corrections route and the new
// host self-correction route, so the update + notification can never drift apart
// between the two. Validates each player's round_score (integer, >= 0), writes
// the score_submission_players rows scoped to this submission, flips the
// submission to status 'edited', then best-effort-notifies every seated player
// (no exclusions — the editor could be the host OR an admin) via
// sendScoreCorrectedEmail, gated by each recipient's email_score_posted pref.
//
// The email step is fully wrapped: a send failure (or a missing RESEND_API_KEY)
// must never turn a successful correction into an error — same rule as
// POST /api/scores.
export async function correctSubmissionScores(
  admin: Admin,
  submissionId: string,
  players: { id: string; round_score: number }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(players) || players.length === 0) {
    return { ok: false, error: "Nothing to update." };
  }

  // Validate + write each score, scoped to rows belonging to THIS submission.
  for (const p of players) {
    const rowId = p?.id?.toString();
    const score = Number.parseInt(String(p?.round_score ?? ""), 10);
    if (!rowId || !Number.isInteger(score) || score < 0) {
      return { ok: false, error: "Enter a valid score for every player." };
    }
    const { error } = await admin
      .from("score_submission_players")
      .update({ round_score: score })
      .eq("id", rowId)
      .eq("score_submission_id", submissionId);
    if (error) {
      return { ok: false, error: "Scores could not be updated. Please try again." };
    }
  }

  await admin.from("score_submissions").update({ status: "edited", updated_at: new Date().toISOString() }).eq("id", submissionId);

  // Best-effort "scores were corrected" emails to EVERY seated player (including
  // whoever made the correction). Fully wrapped — the correction is committed.
  try {
    const { data: sub } = await admin
      .from("score_submissions")
      .select(
        "id, league_tables(id, table_date, location_name), score_submission_players(user_id, round_score, is_no_show, is_no_show_bonus, profiles(email, full_name, notification_preferences))"
      )
      .eq("id", submissionId)
      .maybeSingle();

    const table = Array.isArray(sub?.league_tables) ? sub.league_tables[0] : sub?.league_tables;
    if (table) {
      for (const row of (sub?.score_submission_players ?? []) as any[]) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
        if (!profile?.email) continue;
        if (!resolvePrefs(profile.notification_preferences).email_score_posted) continue;
        try {
          const res = await sendScoreCorrectedEmail(
            { email: profile.email, fullName: profile.full_name },
            { tableId: table.id, tableDate: table.table_date, locationName: table.location_name },
            { roundScore: row.round_score, isNoShow: row.is_no_show, isNoShowBonus: row.is_no_show_bonus }
          );
          if (!res.ok) console.error("scoreCorrectedEmail not sent", profile.email, res.error);
        } catch (err) {
          console.error("scoreCorrectedEmail send failed", profile.email, err);
        }
      }
    }
  } catch (err) {
    console.error("scoreCorrectedEmail batch failed", err);
  }

  return { ok: true };
}
