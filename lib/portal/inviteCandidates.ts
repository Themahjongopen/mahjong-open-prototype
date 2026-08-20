// Eligible invitees for a cohort (city + series), shared by the create-table
// candidate list and the create route's server-side validation so the two can't
// drift. Same eligibility as the post-creation invite route's loadEligible —
// paid registration in this city+series, has a profile, opted into the directory —
// MINUS the seated-at-a-table filter, because at creation the table doesn't exist
// yet. The caller passes excludeIds (always at least the creator).

export type InviteCandidate = {
  profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
  skill_level: string | null;
  email: string | null;
};

// includeHidden: when true, players who opted out of the directory
// (show_in_directory = false) are STILL returned. Used only by the admin
// add-to-table flow — an admin seating someone to resolve a support case should
// reach any paid player in the cohort, directory preference notwithstanding. The
// public invite flows leave it false so opted-out players stay hidden.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadCohortCandidates(
  admin: any,
  cityId: string,
  seriesId: string,
  excludeIds: Set<string>,
  includeHidden = false
): Promise<Map<string, InviteCandidate>> {
  const { data } = await admin
    .from("registrations")
    .select("profile_id, profiles!inner(id, email, full_name, avatar_url, skill_level, show_in_directory)")
    .eq("city_id", cityId)
    .eq("series_id", seriesId)
    .eq("paid_status", "paid")
    .not("profile_id", "is", null);

  const map = new Map<string, InviteCandidate>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (data ?? []) as any[]) {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!p) continue;
    if (!includeHidden && p.show_in_directory === false) continue; // opted out of the directory
    if (excludeIds.has(p.id)) continue;
    if (map.has(p.id)) continue; // de-dupe (defensive; one paid reg per cohort)
    map.set(p.id, {
      profile_id: p.id,
      full_name: p.full_name ?? null,
      avatar_url: p.avatar_url ?? null,
      skill_level: p.skill_level ?? null,
      email: p.email ?? null,
    });
  }
  return map;
}
