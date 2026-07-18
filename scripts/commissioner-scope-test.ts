/**
 * ============================================================================
 *  Commissioner city-scope test — verifies the players PUT bug fix.
 * ============================================================================
 * The old code demoted EVERY commissioner when promoting one. This replicates
 * the route's promote queries against an isolated two-city cohort and asserts
 * that promoting a commissioner in city A only demotes city A's current
 * commissioner — city B's commissioner is untouched.
 *
 * Run:  npx tsx scripts/commissioner-scope-test.ts
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
const TAG = `commtest+${process.pid}`;
let failures = 0;
const check = (name: string, ok: boolean, detail = "") => { console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`); if (!ok) failures++; };

// The exact promote logic from PUT /api/admin/players (city-scoped).
async function promoteCommissioner(profileId: string) {
  const { data: reg } = await admin.from("registrations").select("city_id").eq("profile_id", profileId).eq("paid_status", "paid").order("created_at", { ascending: false }).limit(1).maybeSingle();
  const cityId = (reg as any)?.city_id ?? null;
  if (cityId) {
    const { data: peers } = await admin.from("registrations").select("profile_id, profiles!inner(role)").eq("city_id", cityId).eq("paid_status", "paid").eq("profiles.role", "commissioner");
    const demote = [...new Set(((peers ?? []) as any[]).map((r) => r.profile_id).filter((pid: string) => pid && pid !== profileId))];
    if (demote.length) await admin.from("profiles").update({ role: "player" }).in("id", demote);
  }
  await admin.from("profiles").update({ role: "commissioner" }).eq("id", profileId);
}

async function role(id: string) {
  const { data } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
  return (data as any)?.role ?? null;
}

async function main() {
  const { data: series } = await admin.from("series").insert({ name: `TEST Comm ${process.pid}`, starts_at: "2026-08-17", ends_at: "2026-10-11", total_weeks: 8, price_cents: 8000, is_active: false }).select("id").single();
  const { data: cityA } = await admin.from("cities").insert({ name: `TEST CityA ${process.pid}`, state: "TS", slug: `test-ca-${process.pid}`, is_active: false }).select("id").single();
  const { data: cityB } = await admin.from("cities").insert({ name: `TEST CityB ${process.pid}`, state: "TS", slug: `test-cb-${process.pid}`, is_active: false }).select("id").single();
  const seriesId = series!.id, cityAId = cityA!.id, cityBId = cityB!.id;
  const userIds: string[] = [];

  async function member(tag: string, cityId: string): Promise<string> {
    const email = `${TAG}.${tag}@example.com`;
    const { data: u } = await admin.auth.admin.createUser({ email, password: "Test-Passw0rd-comm", email_confirm: true, user_metadata: { full_name: tag } });
    await admin.from("registrations").insert({ full_name: tag, email, phone: "6015550100", city_id: cityId, series_id: seriesId, skill_level: "intermediate", paid_status: "paid", profile_id: u!.user!.id });
    userIds.push(u!.user!.id);
    return u!.user!.id;
  }

  try {
    const A1 = await member("a1", cityAId);
    const A2 = await member("a2", cityAId);
    const B1 = await member("b1", cityBId);

    // Seed one commissioner in each city.
    await admin.from("profiles").update({ role: "commissioner" }).in("id", [A1, B1]);
    check("setup: A1 + B1 are commissioners", (await role(A1)) === "commissioner" && (await role(B1)) === "commissioner");

    // Promote A2 (city A). Should replace A1 in city A only.
    await promoteCommissioner(A2);

    check("A2 promoted to commissioner", (await role(A2)) === "commissioner", `got ${await role(A2)}`);
    check("A1 demoted (same city)", (await role(A1)) === "player", `got ${await role(A1)}`);
    check("B1 UNTOUCHED (other city)", (await role(B1)) === "commissioner", `got ${await role(B1)}`);
  } finally {
    await admin.from("registrations").delete().eq("series_id", seriesId);
    await admin.from("series").delete().eq("id", seriesId);
    await admin.from("cities").delete().in("id", [cityAId, cityBId]);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
    console.log("\nCleaned up.");
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
