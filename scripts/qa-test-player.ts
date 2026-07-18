/**
 * QA helper — provision or remove a persistent test player for browser smoke
 * tests on the LIVE project. NOT for production data; remove before launch.
 *
 *   npx tsx scripts/qa-test-player.ts create
 *   npx tsx scripts/qa-test-player.ts delete
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

const EMAIL = "jordanpaulco+player2@gmail.com";
const PASSWORD = "MahjongTest2026!";
const FULL_NAME = "Player Two";

async function findUserId(): Promise<string | null> {
  for (let page = 1; ; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === EMAIL);
    if (hit) return hit.id;
    if (users.length < 1000) return null;
  }
}

const REFERENCE_MEMBER = "jordanpaulco+bulk@gmail.com";

async function create() {
  // Mirror the reference member's cohort so both accounts share a city+series
  // and can see each other's tables; fall back to the first active pair.
  const { data: ref } = await admin
    .from("registrations")
    .select("city_id, series_id, cities(id, name), series(id, name)")
    .eq("email", REFERENCE_MEMBER)
    .eq("paid_status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let city: { id: string; name: string } | null = (ref as any)?.cities ?? null;
  let series: { id: string; name: string } | null = (ref as any)?.series ?? null;

  if (!city || !series) {
    const { data: s } = await admin.from("series").select("id, name").eq("is_active", true).order("starts_at").limit(1).maybeSingle();
    const { data: c } = await admin.from("cities").select("id, name").eq("is_active", true).order("name").limit(1).maybeSingle();
    series = s ?? null;
    city = c ?? null;
  }
  if (!series || !city) throw new Error("Need a reference member or an active series + city");

  let userId = await findUserId();
  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: FULL_NAME } });
    if (error || !data.user) throw new Error(`createUser: ${error?.message}`);
    userId = data.user.id;
  } else {
    await admin.auth.admin.updateUserById(userId, { password: PASSWORD });
  }

  const { data: existing } = await admin.from("registrations").select("id").eq("email", EMAIL).eq("series_id", series.id).maybeSingle();
  if (!existing) {
    await admin.from("registrations").insert({ full_name: FULL_NAME, email: EMAIL, phone: "6015550111", city_id: city.id, series_id: series.id, skill_level: "beginner", paid_status: "paid", profile_id: userId });
  } else {
    await admin.from("registrations").update({ paid_status: "paid", profile_id: userId, city_id: city.id }).eq("id", existing.id);
  }

  console.log(`Provisioned QA player in ${city.name} / ${series.name}`);
  console.log(`  email:    ${EMAIL}`);
  console.log(`  password: ${PASSWORD}`);
}

async function del() {
  await admin.from("registrations").delete().eq("email", EMAIL);
  const userId = await findUserId();
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log(`Removed QA player ${EMAIL}`);
}

const cmd = process.argv[2];
(cmd === "delete" ? del() : create()).catch((e) => { console.error(e); process.exit(1); });
