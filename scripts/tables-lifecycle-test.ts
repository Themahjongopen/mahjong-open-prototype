/**
 * ============================================================================
 *  Tables + seats lifecycle test (data layer).
 * ============================================================================
 * Exercises the create -> join -> fill-to-full -> leave -> reopen -> re-join ->
 * cancel lifecycle at the database layer, mirroring what the API routes do, and
 * asserts the load-bearing invariants:
 *   - creating a table seats the creator at seat 1
 *   - the seat-name embed (league_tables -> table_seats -> profiles) resolves
 *   - a user can't hold two active seats at one table (uq_table_seats_active_user)
 *   - two active occupants can't share a seat number (uq_table_seats_active_seat)
 *   - a canceled seat frees its slot for re-join (partial unique indexes)
 *   - status flips full at 4 and back to open when a seat frees
 *
 * Provisions ephemeral members on the LIVE project and cleans everything up.
 * Run:  npx tsx scripts/tables-lifecycle-test.ts
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
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !SERVICE) throw new Error("Missing Supabase env in .env.local");

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
const TAG = `tabletest+${process.pid}`;
const PASSWORD = "Test-Passw0rd-tables-only";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

type Member = { userId: string; regId: string; email: string };

async function createMember(tagName: string, cityId: string, seriesId: string): Promise<Member> {
  const email = `${TAG}.${tagName}@example.com`;
  const { data: created, error: uErr } = await admin.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: `Table ${tagName}` },
  });
  if (uErr || !created.user) throw new Error(`createUser ${email}: ${uErr?.message}`);
  const { data: reg, error: rErr } = await admin
    .from("registrations")
    .insert({ full_name: `Table ${tagName}`, email, phone: "6015550100", city_id: cityId, series_id: seriesId, skill_level: "intermediate", paid_status: "paid", profile_id: created.user.id })
    .select("id").single();
  if (rErr || !reg) throw new Error(`registration ${email}: ${rErr?.message}`);
  return { userId: created.user.id, regId: reg.id, email };
}

function freeSeat(activeSeatNumbers: number[]): number | undefined {
  const taken = new Set(activeSeatNumbers);
  return [1, 2, 3, 4].find((n) => !taken.has(n));
}

async function activeSeatNumbers(tableId: string): Promise<number[]> {
  const { data } = await admin.from("table_seats").select("seat_number").eq("table_id", tableId).is("canceled_at", null);
  return (data ?? []).map((s: any) => s.seat_number);
}

async function main() {
  const { data: series } = await admin.from("series").select("id, name").eq("is_active", true).order("starts_at").limit(1).maybeSingle();
  const { data: city } = await admin.from("cities").select("id, name").eq("is_active", true).order("name").limit(1).maybeSingle();
  if (!series || !city) throw new Error("Need an active series + city");
  console.log(`Cohort: city="${city.name}" series="${series.name}"\n`);

  const members: Member[] = [];
  let tableId: string | null = null;
  try {
    const [A, B, C, D] = await Promise.all([
      createMember("a", city.id, series.id),
      createMember("b", city.id, series.id),
      createMember("c", city.id, series.id),
      createMember("d", city.id, series.id),
    ]);
    members.push(A, B, C, D);

    const futureDate = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    // CREATE (A) — insert table + seat 1.
    const { data: table, error: tErr } = await admin
      .from("league_tables")
      .insert({ city_id: city.id, series_id: series.id, creator_id: A.userId, week_number: 1, table_date: futureDate, table_time: "18:00:00", location_name: "Test Parlor", status: "open" })
      .select("id").single();
    check("create table", !tErr && !!table, tErr?.message ?? "");
    tableId = table!.id;
    const { error: s1 } = await admin.from("table_seats").insert({ table_id: tableId, user_id: A.userId, seat_number: 1 });
    check("creator seated at seat 1", !s1, s1?.message ?? "");

    // READ — seat-name embed resolves and shows A.
    const { data: detail } = await admin
      .from("league_tables")
      .select("id, status, table_seats(seat_number, user_id, canceled_at, profiles(full_name))")
      .eq("id", tableId).maybeSingle();
    const seat1 = (detail?.table_seats ?? []).find((s: any) => s.seat_number === 1);
    check("seat-name embed resolves creator name", seat1?.profiles?.full_name === "Table a", seat1?.profiles?.full_name ?? "no name");

    // JOIN B into the lowest free seat (2).
    const seatB = freeSeat(await activeSeatNumbers(tableId));
    const { error: jB } = await admin.from("table_seats").insert({ table_id: tableId, user_id: B.userId, seat_number: seatB });
    check("second player joins seat 2", !jB && seatB === 2, jB?.message ?? `seat ${seatB}`);

    // DUP USER — B can't hold a second active seat.
    const { error: dupUser } = await admin.from("table_seats").insert({ table_id: tableId, user_id: B.userId, seat_number: 3 });
    check("same user can't take a 2nd active seat", dupUser?.code === "23505", dupUser?.code ?? "no error");

    // DUP SEAT — C can't take B's occupied seat 2.
    const { error: dupSeat } = await admin.from("table_seats").insert({ table_id: tableId, user_id: C.userId, seat_number: 2 });
    check("two players can't share an active seat", dupSeat?.code === "23505", dupSeat?.code ?? "no error");

    // Fill to 4 (C->3, D->4) then flip to full.
    await admin.from("table_seats").insert({ table_id: tableId, user_id: C.userId, seat_number: 3 });
    await admin.from("table_seats").insert({ table_id: tableId, user_id: D.userId, seat_number: 4 });
    const filled = (await activeSeatNumbers(tableId)).length;
    if (filled >= 4) await admin.from("league_tables").update({ status: "full" }).eq("id", tableId);
    const { data: fullRow } = await admin.from("league_tables").select("status").eq("id", tableId).maybeSingle();
    check("table flips to full at 4 seats", filled === 4 && fullRow?.status === "full", `${filled} seats, status ${fullRow?.status}`);

    // LEAVE B — cancel seat, reopen table.
    await admin.from("table_seats").update({ canceled_at: new Date().toISOString() }).eq("table_id", tableId).eq("user_id", B.userId).is("canceled_at", null);
    await admin.from("league_tables").update({ status: "open" }).eq("id", tableId);
    const afterLeave = await activeSeatNumbers(tableId);
    check("leaving frees a seat and reopens table", afterLeave.length === 3 && !afterLeave.includes(2), `active: [${afterLeave.join(",")}]`);

    // RE-JOIN — freed seat 2 is claimable again (partial unique index).
    const seatRe = freeSeat(afterLeave);
    const { error: reErr } = await admin.from("table_seats").insert({ table_id: tableId, user_id: B.userId, seat_number: seatRe });
    check("freed seat is re-joinable", !reErr && seatRe === 2, reErr?.message ?? `seat ${seatRe}`);

    // MY TABLES embed for A resolves the table.
    const { data: mine } = await admin
      .from("table_seats")
      .select("seat_number, league_tables(id, week_number, status)")
      .eq("user_id", A.userId).is("canceled_at", null);
    check("my-tables embed returns creator's table", (mine ?? []).some((r: any) => r.league_tables?.id === tableId));

    // CANCEL TABLE (A).
    await admin.from("league_tables").update({ status: "canceled" }).eq("id", tableId);
    const { data: canceled } = await admin.from("league_tables").select("status").eq("id", tableId).maybeSingle();
    check("creator cancels the table", canceled?.status === "canceled", canceled?.status ?? "");
  } finally {
    if (tableId) await admin.from("league_tables").delete().eq("id", tableId); // cascades seats
    for (const m of members) {
      await admin.from("registrations").delete().eq("id", m.regId);
      await admin.auth.admin.deleteUser(m.userId);
    }
    console.log("\nCleaned up test members + table.");
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
