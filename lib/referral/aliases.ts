// Rename-compatibility for commissioner referral codes.
//
// A commissioner's code embeds their city's slug (e.g. "kellie-greater-greenville-sc").
// When a city is renamed we mint a NEW code that matches the new name and make it
// the primary (the one shown in admin + printed on new material), but codes get
// spoken aloud and printed, so any ALREADY-shared /join link must keep attributing
// forever. We can't keep two rows per (commissioner, city) — commissioner_referral_codes
// has UNIQUE(profile_id, city_id) and the "active commissioner count" logic counts
// rows per city — so retired codes live here instead and both resolution paths
// (/join/[code] and the register attribution step) canonicalize through this map.
//
// Add one entry per retired code when a city is renamed: "<old code>": "<new code>".
export const REFERRAL_CODE_ALIASES: Record<string, string> = {
  // 2026-08-15 launch renames:
  "kellie-greater-greenville-sc": "kellie-greenville-pickens-sc", // Greater Greenville → Greenville/Pickens
  "gretchen-greensboro-nc": "gretchen-the-triad-nc", // Greensboro → The Triad
  "amy-charlotte-nc": "amy-matthews-nc", // Charlotte → Matthews
};

// Map a retired code to its current one; passes any live/unknown code through
// unchanged so this is safe to call on every lookup.
export function canonicalReferralCode(code: string): string {
  return REFERRAL_CODE_ALIASES[code] ?? code;
}
