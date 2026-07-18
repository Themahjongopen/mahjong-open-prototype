/**
 * ============================================================================
 *  Member-scoped RLS test — directory_members view + private-data lockdown.
 * ============================================================================
 * Verifies that a logged-in player:
 *   1. CAN read the directory (directory_members) and see fellow members'
 *      SAFE columns (name, city, skill, commissioner badge),
 *   2. CANNOT read anyone's private data directly (profiles / registrations /
 *      payments are RLS-locked and return zero rows), and
 *   3. Cannot reach private columns THROUGH the view (email/phone don't exist
 *      on directory_members).
 *
 * It provisions two ephemeral test members in the same city+series cohort via
 * the service-role key, signs in as one over the anon key, runs the assertions,
 * and deletes everything it created in a finally block.
 *
 * Requires migration 009 (directory_members view) to be applied first.
 * Run:  npx tsx scripts/rls-directory-test.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---- env -------------------------------------------------------------------
function loadEnvLocal() {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / ANON / SERVICE_ROLE key in .env.local");
}

// Unique-ish run tag without Math.random/Date (kept deterministic-friendly).
const TAG = `rlstest+${process.pid}`;
const VIEWER_EMAIL = `${TAG}.viewer@example.com`;
const OTHER_EMAIL = `${TAG}.other@example.com`;
const PASSWORD = "Test-Passw0rd-rls-only";

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

// ---- tiny assert harness ---------------------------------------------------
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

type Created = { userId: string; regId: string };

async function createMember(email: string, fullName: string, cityId: string, seriesId: string): Promise<Created> {
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (userErr || !created.user) throw new Error(`createUser failed for ${email}: ${userErr?.message}`);
  const userId = created.user.id;

  // Paid registration in the target cohort, linked straight to the profile.
  // (The 007 trigger only backfills profile_id for registrations that already
  // exist at sign-up time; we set it explicitly here.)
  const { data: reg, error: regErr } = await admin
    .from("registrations")
    .insert({
      full_name: fullName,
      email,
      phone: "6015550100",
      city_id: cityId,
      series_id: seriesId,
      skill_level: "intermediate",
      paid_status: "paid",
      profile_id: userId,
    })
    .select("id")
    .single();
  if (regErr || !reg) throw new Error(`registration insert failed for ${email}: ${regErr?.message}`);
  return { userId, regId: reg.id };
}

async function cleanup(created: Created[]) {
  for (const c of created) {
    await admin.from("registrations").delete().eq("id", c.regId);
    await admin.auth.admin.deleteUser(c.userId); // cascades the profiles row
  }
}

async function main() {
  // Pick a cohort: first active series + first active city.
  const { data: series, error: sErr } = await admin
    .from("series").select("id, name").eq("is_active", true).order("starts_at").limit(1).maybeSingle();
  if (sErr || !series) throw new Error(`No active series to test against: ${sErr?.message ?? "none found"}`);
  const { data: city, error: cErr } = await admin
    .from("cities").select("id, name").eq("is_active", true).order("name").limit(1).maybeSingle();
  if (cErr || !city) throw new Error(`No active city to test against: ${cErr?.message ?? "none found"}`);

  console.log(`Cohort: city="${city.name}"  series="${series.name}"\n`);

  const created: Created[] = [];
  try {
    const viewer = await createMember(VIEWER_EMAIL, "RLS Viewer", city.id, series.id);
    created.push(viewer);
    const other = await createMember(OTHER_EMAIL, "RLS Other", city.id, series.id);
    created.push(other);

    // Sign in as the viewer over the anon key -> member-scoped JWT.
    const member: SupabaseClient = createClient(URL!, ANON!, { auth: { persistSession: false } });
    const { error: signInErr } = await member.auth.signInWithPassword({ email: VIEWER_EMAIL, password: PASSWORD });
    if (signInErr) throw new Error(`viewer sign-in failed: ${signInErr.message}`);

    // 1) Directory is visible and includes the other member.
    const { data: dir, error: dirErr } = await member.from("directory_members").select("*");
    check("directory readable by member", !dirErr && Array.isArray(dir), dirErr?.message ?? "");
    const rows = dir ?? [];
    check("directory includes the viewer", rows.some((r: any) => r.profile_id === viewer.userId));
    check("directory includes the other cohort member", rows.some((r: any) => r.profile_id === other.userId));

    // 2) Only safe columns are exposed by the view.
    const allowed = new Set(["profile_id", "full_name", "city_id", "city_name", "skill_level", "is_commissioner", "series_id"]);
    const leaked = rows.length ? Object.keys(rows[0]).filter((k) => !allowed.has(k)) : [];
    check("directory exposes only safe columns", leaked.length === 0, leaked.length ? `leaked: ${leaked.join(", ")}` : "");
    const otherRow = rows.find((r: any) => r.profile_id === other.userId);
    check("other member's safe fields present", !!otherRow && otherRow.full_name === "RLS Other" && !!otherRow.city_name && "is_commissioner" in (otherRow ?? {}));

    // 3) Private tables are NOT readable directly (RLS -> zero rows).
    const { data: prof } = await member.from("profiles").select("id, email, phone");
    check("profiles NOT directly readable", (prof ?? []).length === 0, `${(prof ?? []).length} rows returned`);
    const { data: regs } = await member.from("registrations").select("id, email, phone");
    check("registrations NOT directly readable", (regs ?? []).length === 0, `${(regs ?? []).length} rows returned`);
    const { data: pays } = await member.from("payments").select("id");
    check("payments NOT directly readable", (pays ?? []).length === 0, `${(pays ?? []).length} rows returned`);

    // 4) Private columns can't be reached through the view.
    const { error: colErr } = await member.from("directory_members").select("email");
    check("view has no private 'email' column", !!colErr, colErr ? "" : "email column unexpectedly selectable");

    await member.auth.signOut();
  } finally {
    await cleanup(created);
    console.log("\nCleaned up test members.");
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
