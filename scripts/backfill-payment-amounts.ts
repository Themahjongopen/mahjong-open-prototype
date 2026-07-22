/**
 * ============================================================================
 *  One-time backfill: payments.amount_cents ← real amount charged (via Stripe)
 * ============================================================================
 * Sets each SUCCEEDED payment's amount_cents to the actual amount Stripe
 * collected (after discount codes), so revenue reporting is accurate for
 * registrations completed BEFORE the webhook started writing back
 * session.amount_total. Fixes e.g. $0 comps that were stored at the $80 list
 * price. Idempotent: rows already correct are left untouched.
 *
 * Source of truth per payment:
 *   - provider_payment_id = "pi_..."  → PaymentIntent.amount_received
 *   - provider_payment_id is empty    → a $0 (100%-off coupon) checkout creates
 *                                        no PaymentIntent, so the real amount is 0
 *
 * DRY RUN by default (prints what WOULD change, writes nothing).
 * Pass --apply to actually update rows.
 *
 * This touches PRODUCTION data. Registrations/payment intents were created with
 * the LIVE Stripe account, so run with the LIVE secret key (an inline var wins
 * over .env.local):
 *
 *   STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/backfill-payment-amounts.ts
 *   STRIPE_SECRET_KEY=sk_live_... npx tsx scripts/backfill-payment-amounts.ts --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Minimal .env.local loader (no dotenv dependency in this project). Does NOT
// clobber vars already set in the environment, so an inline STRIPE_SECRET_KEY
// (e.g. the live key) takes precedence over whatever .env.local holds.
function loadEnvLocal() {
  try {
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
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    // No .env.local — rely on the ambient environment.
  }
}

async function main() {
  loadEnvLocal();
  const APPLY = process.argv.includes("--apply");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).");
  }
  if (!stripeKey) throw new Error("Missing STRIPE_SECRET_KEY.");

  const liveMode = stripeKey.startsWith("sk_live_");
  console.log("\nBackfill payments.amount_cents from Stripe");
  console.log(`  Stripe mode: ${liveMode ? "LIVE" : "TEST"}`);
  console.log(`  Run mode:    ${APPLY ? "APPLY (writes rows)" : "DRY RUN (no writes)"}\n`);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const stripe = new Stripe(stripeKey, { apiVersion: "2026-06-24.dahlia" });

  // Only succeeded payments count toward revenue; those are the ones to correct.
  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, registration_id, amount_cents, provider_payment_id")
    .eq("status", "succeeded")
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = payments ?? [];
  console.log(`Succeeded payments: ${rows.length}\n`);

  let changed = 0;
  let unchanged = 0;
  let skipped = 0;
  let sumBefore = 0;
  let sumAfter = 0;

  for (const p of rows) {
    const before = typeof p.amount_cents === "number" ? p.amount_cents : 0;
    const pid: string | null = p.provider_payment_id;
    let real: number | null = null;

    if (pid && pid.startsWith("pi_")) {
      try {
        const pi = await stripe.paymentIntents.retrieve(pid);
        real = pi.amount_received ?? pi.amount ?? null;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ! ${p.id}  could not retrieve ${pid}: ${msg} — SKIPPED`);
        skipped++;
        sumBefore += before;
        sumAfter += before;
        continue;
      }
    } else if (!pid) {
      // No PaymentIntent → $0 (100%-off coupon) checkout; nothing was charged.
      real = 0;
    } else {
      console.log(`  ! ${p.id}  unrecognized provider_payment_id "${pid}" — SKIPPED`);
      skipped++;
      sumBefore += before;
      sumAfter += before;
      continue;
    }

    if (real === null) {
      console.log(`  ! ${p.id}  Stripe returned no amount — SKIPPED`);
      skipped++;
      sumBefore += before;
      sumAfter += before;
      continue;
    }

    sumBefore += before;
    sumAfter += real;

    if (real === before) {
      unchanged++;
      continue;
    }

    console.log(
      `  ~ ${p.id}  reg=${p.registration_id}  ${before} -> ${real} cents  (${pid ?? "no PaymentIntent / $0 comp"})`
    );

    if (APPLY) {
      const { error: upErr } = await supabase.from("payments").update({ amount_cents: real }).eq("id", p.id);
      if (upErr) {
        console.log(`      update FAILED: ${upErr.message}`);
        skipped++;
        continue;
      }
    }
    changed++;
  }

  console.log("\nSummary");
  console.log(`  changed:   ${changed}${APPLY ? " (written)" : " (dry run — nothing written)"}`);
  console.log(`  unchanged: ${unchanged}`);
  console.log(`  skipped:   ${skipped}`);
  console.log(`  revenue (succeeded): $${(sumBefore / 100).toFixed(2)} -> $${(sumAfter / 100).toFixed(2)}\n`);
  if (!APPLY && changed > 0) {
    console.log(`Re-run with --apply to write these ${changed} change(s).\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
