/**
 * ============================================================================
 *  Standings views test — verifies the migration 013 math against the spec.
 * ============================================================================
 * Seeds an ISOLATED test series + city with four members whose rounds exercise
 * every rule, then asserts member_series_standings:
 *   A — 8 weekly rounds (Riley's values 140,120,100,90,80,150,60,110) plus a
 *       no-show in week 7 (the DROPPED week): cumulative = best-7 (790) − 25
 *       penalty = 765; penalty in the dropped week still counts. 8 played rounds.
 *   B — 6 rounds of 120: average 120.0, ranked (≥5).
 *   C — 4 rounds: under the 5-round gate → average_rank NULL.
 *   D — one 100 round + one +25 stay-bonus in the same week: weekly top-2 = 125
 *       (bonus counts toward Cumulative) but 1 played round, total 100 (bonus
 *       excluded from the average).
 * Ranks are checked within the isolated cohort. Cleans up everything.
 *
 * Run:  npx tsx scripts/standings-test.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const TAG = `standtest+${process.pid}`;

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

type Row = { user_id: string; round_score: number; is_no_show?: boolean; is_no_show_bonus?: boolean };

async function main() {
  // Isolated cohort.
  const { data: series, error: sErr } = await admin
    .from("series")
    .insert({ name: `TEST Standings ${process.pid}`, starts_at: "2026-08-17", ends_at: "2026-10-11", total_weeks: 8, price_cents: 8000, is_active: false })
    .select("id").single();
  if (sErr || !series) throw new Error(`series: ${sErr?.message}`);
  const { data: city, error: cErr } = await admin
    .from("cities")
    .insert({ name: `TEST City ${process.pid}`, state: "TS", slug: `test-city-${process.pid}`, is_active: false })
    .select("id").single();
  if (cErr || !city) throw new Error(`city: ${cErr?.message}`);

  const seriesId = series.id as string;
  const cityId = city.id as string;
  const userIds: string[] = [];

  async function member(tag: string, name: string): Promise<string> {
    const email = `${TAG}.${tag}@example.com`;
    const { data: created, error } = await admin.auth.admin.createUser({ email, password: "Test-Passw0rd-standings", email_confirm: true, user_metadata: { full_name: name } });
    if (error || !created.user) throw new Error(`user ${email}: ${error?.message}`);
    await admin.from("registrations").insert({ full_name: name, email, phone: "6015550100", city_id: cityId, series_id: seriesId, skill_level: "intermediate", paid_status: "paid", profile_id: created.user.id });
    userIds.push(created.user.id);
    return created.user.id;
  }

  async function round(week: number, creatorId: string, players: Row[]) {
    const { data: t } = await admin.from("league_tables").insert({ city_id: cityId, series_id: seriesId, creator_id: creatorId, week_number: week, table_date: "2026-08-20", location_name: "T", status: "completed" }).select("id").single();
    const { data: sub } = await admin.from("score_submissions").insert({ table_id: t!.id, submitted_by: creatorId, status: "submitted" }).select("id").single();
    await admin.from("score_submission_players").insert(players.map((p) => ({ score_submission_id: sub!.id, user_id: p.user_id, round_score: p.round_score, is_no_show: p.is_no_show ?? false, is_no_show_bonus: p.is_no_show_bonus ?? false })));
  }

  try {
    const A = await member("a", "Player A");
    const B = await member("b", "Player B");
    const C = await member("c", "Player C");
    const D = await member("d", "Player D");

    // A: 8 weekly rounds (one per week) with Riley's weekly values.
    const rileyWeekly = [140, 120, 100, 90, 80, 150, 60, 110];
    for (let w = 0; w < 8; w++) await round(w + 1, A, [{ user_id: A, round_score: rileyWeekly[w] }]);
    // A: a no-show in week 7 (the dropped week, value 60).
    await round(7, A, [{ user_id: A, round_score: 0, is_no_show: true }]);

    // B: 6 rounds of 120 (weeks 1-6).
    for (let w = 1; w <= 6; w++) await round(w, B, [{ user_id: B, round_score: 120 }]);
    // C: 4 rounds of 100 (weeks 1-4) — under the gate.
    for (let w = 1; w <= 4; w++) await round(w, C, [{ user_id: C, round_score: 100 }]);
    // D: a 100 round and a +25 stay-bonus, both in week 1.
    await round(1, D, [{ user_id: D, round_score: 100 }]);
    await round(1, D, [{ user_id: D, round_score: 25, is_no_show_bonus: true }]);

    const { data: rows } = await admin
      .from("member_series_standings")
      .select("user_id, rounds_played, total_score, average_score, cumulative_score, cumulative_rank, average_rank")
      .eq("series_id", seriesId).eq("city_id", cityId);
    const by = Object.fromEntries(((rows ?? []) as any[]).map((r) => [r.user_id, r]));

    const a = by[A], b = by[B], c = by[C], d = by[D];

    check("A cumulative = best-7 (790) minus dropped-week penalty (25) = 765", a?.cumulative_score === 765, `got ${a?.cumulative_score}`);
    check("A played rounds = 8 (no-show excluded)", a?.rounds_played === 8, `got ${a?.rounds_played}`);
    check("A total = 850", a?.total_score === 850, `got ${a?.total_score}`);
    check("A cumulative_rank = 1", a?.cumulative_rank === 1, `got ${a?.cumulative_rank}`);

    check("B average = 120.0", Number(b?.average_score) === 120, `got ${b?.average_score}`);
    check("B is ranked on average (>=5 rounds)", b?.average_rank === 1, `got ${b?.average_rank}`);
    check("A average_rank = 2 (behind B)", a?.average_rank === 2, `got ${a?.average_rank}`);

    check("C under 5-round gate → average_rank NULL", c?.rounds_played === 4 && c?.average_rank == null, `rounds ${c?.rounds_played}, rank ${c?.average_rank}`);

    check("D stay-bonus counts to cumulative (125)", d?.cumulative_score === 125, `got ${d?.cumulative_score}`);
    check("D bonus excluded from played rounds (1) + total (100)", d?.rounds_played === 1 && d?.total_score === 100, `rounds ${d?.rounds_played}, total ${d?.total_score}`);
  } finally {
    await admin.from("league_tables").delete().eq("series_id", seriesId); // cascades submissions/players/seats
    await admin.from("registrations").delete().eq("series_id", seriesId);
    await admin.from("series").delete().eq("id", seriesId);
    await admin.from("cities").delete().eq("id", cityId);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
    console.log("\nCleaned up test cohort.");
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
