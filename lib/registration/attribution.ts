import { canonicalReferralCode } from "@/lib/referral/aliases";

// Shared registration attribution — the SINGLE source of truth for who a signup
// is credited to. Used by both the create path (/api/register, via
// writeAttribution) and the payment webhook (/api/stripe/webhook, via
// ensureAttributionOnPaid). The branching lives once, in computeAttributionRows.

export type AttributionRow = { commissioner_profile_id: string | null; weight: number; source: string };

// Compute the attribution rows for a registration. NO writes. Reads the city's
// active commissioner referral codes and picks:
//   1) referral link  — active code for THIS city (weight 1.0, 'link')
//   2) dropdown        — split-city "how did you hear" choice ('dropdown' /
//                        even 'organic_split' for the "organic" option)
//   3) fallback (no code, no dropdown):
//        1 active commissioner  → credited at 1.0 ('link')
//        N ≥ 2 active           → split EVENLY, 1/N each ('organic_split')
//        0 active               → one NULL 'organic_split' row (zero-commissioner
//                                 cities — genuinely unattributed)
// Weights are FROZEN here (rounded to 4 places), never recomputed at read time.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function computeAttributionRows(
  supabase: any,
  { cityId, referralCode, heardAbout }: { cityId: string; referralCode?: string | null; heardAbout?: string | null }
): Promise<AttributionRow[]> {
  // Active commissioners in this city = those holding an ACTIVE referral code.
  const { data: codeRows } = await supabase
    .from("commissioner_referral_codes")
    .select("profile_id, is_active")
    .eq("city_id", cityId)
    .eq("is_active", true);
  const active = (codeRows ?? []) as Array<{ profile_id: string }>;

  const rows: AttributionRow[] = [];
  let handled = false;

  // 1) Referral link — must be active AND for THIS city (a switched city drops it).
  if (referralCode) {
    // Canonicalize so a pre-rename (aliased) code still attributes to its city.
    const { data: rc } = await supabase
      .from("commissioner_referral_codes")
      .select("profile_id, city_id, is_active")
      .eq("code", canonicalReferralCode(referralCode))
      .maybeSingle();
    if (rc && rc.is_active && rc.city_id === cityId) {
      rows.push({ commissioner_profile_id: rc.profile_id, weight: 1.0, source: "link" });
      handled = true;
    }
  }

  // 2) Dropdown (split city).
  if (!handled && heardAbout) {
    if (heardAbout === "organic") {
      if (active.length === 0) {
        rows.push({ commissioner_profile_id: null, weight: 1.0, source: "organic_split" });
      } else {
        // Weight FROZEN at write time — 1/N to 4 places, one row per commissioner.
        const w = Math.round((1 / active.length) * 10000) / 10000;
        for (const c of active) rows.push({ commissioner_profile_id: c.profile_id, weight: w, source: "organic_split" });
      }
      handled = true;
    } else if (active.some((c) => c.profile_id === heardAbout)) {
      rows.push({ commissioner_profile_id: heardAbout, weight: 1.0, source: "dropdown" });
      handled = true;
    }
  }

  // 3) No code, no (valid) dropdown — non-split city, or a fall-through above.
  //    1 active commissioner  → credited at 1.0 ('link').
  //    N ≥ 2 active           → split EVENLY, 1/N per commissioner ('organic_split'),
  //                             the same frozen-weight shape the split-flagged path
  //                             produces — so a non-split multi-commissioner city
  //                             (Greater Tuscaloosa, Golden Triangle, Dallas County)
  //                             credits both/all commissioners instead of a NULL row.
  //    0 active               → one honest unattributed NULL 'organic_split' row
  //                             (genuine zero-commissioner cities — Pensacola, 30A).
  if (!handled) {
    if (active.length === 1) {
      rows.push({ commissioner_profile_id: active[0].profile_id, weight: 1.0, source: "link" });
    } else if (active.length >= 2) {
      const w = Math.round((1 / active.length) * 10000) / 10000; // frozen at write time
      for (const c of active) rows.push({ commissioner_profile_id: c.profile_id, weight: w, source: "organic_split" });
    } else {
      rows.push({ commissioner_profile_id: null, weight: 1.0, source: "organic_split" });
    }
  }

  return rows;
}

const toInsert = (registrationId: string, rows: AttributionRow[]) =>
  rows.map((r) => ({ registration_id: registrationId, ...r }));

// Create path (/api/register): idempotent REPLACE — clears any prior attribution
// for this row first, so a pending re-registration reflects the latest choice
// rather than stacking duplicates. Runs on a still-pending registration; paid
// rows 409 before ever reaching here, so a 'backfill' row on a paid registration
// is never touched. Never throws (self-contained try/catch) so the caller's
// charge path is never affected.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeAttribution(
  supabase: any,
  opts: { registrationId: string; cityId: string; referralCode?: string | null; heardAbout?: string | null }
) {
  try {
    const rows = await computeAttributionRows(supabase, opts);
    await supabase.from("registration_attributions").delete().eq("registration_id", opts.registrationId);
    await supabase.from("registration_attributions").insert(toInsert(opts.registrationId, rows));
  } catch (err) {
    console.error("writeAttribution error (swallowed)", err);
  }
}

// Payment-webhook path (/api/stripe/webhook): write attribution ONLY IF the
// registration has none yet. Closes the gap where a registration created before
// the live-attribution code shipped pays AFTER the one-time backfill ran —
// nothing else would attribute it.
//
// IDEMPOTENT + INSERT-ONLY: if any attribution row already exists (the normal
// case for anything created after the live code shipped), this does NOTHING —
// never a second set, never an overwrite. Safe to run repeatedly on Stripe's
// webhook retries. Never throws (self-contained try/catch); the caller also
// wraps it, mirroring /api/register's treatment of writeAttribution.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function ensureAttributionOnPaid(
  supabase: any,
  opts: { registrationId: string; cityId: string; referralCode?: string | null; heardAbout?: string | null }
) {
  try {
    const { data: existing } = await supabase
      .from("registration_attributions")
      .select("id")
      .eq("registration_id", opts.registrationId)
      .limit(1);
    if (existing && existing.length > 0) return; // already attributed — do nothing

    const rows = await computeAttributionRows(supabase, opts);
    await supabase.from("registration_attributions").insert(toInsert(opts.registrationId, rows));
  } catch (err) {
    console.error("ensureAttributionOnPaid error (swallowed)", err);
  }
}
