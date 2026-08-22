import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { loadCohortCandidates } from "@/lib/portal/inviteCandidates";

export const runtime = "nodejs";

// Admin-only paid-player list for a given city + league, for the "Record a past
// round" pickers. Directory-agnostic (includeHidden) — an admin recording history
// should reach any paid player. No table context here (unlike the per-table
// /eligible route), so nothing is excluded. Service-role; the same cohort source
// the record-round route validates against, so picker and guard can't drift.
export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cityId = searchParams.get("city_id");
  const seriesId = searchParams.get("series_id");
  if (!cityId || !seriesId) {
    return NextResponse.json({ error: "A city and league are required." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  const map = await loadCohortCandidates(admin, cityId, seriesId, new Set<string>(), true);
  const players = [...map.values()]
    .map((c) => ({ profile_id: c.profile_id, full_name: c.full_name, skill_level: c.skill_level }))
    .sort((a, b) => (a.full_name ?? "￿").localeCompare(b.full_name ?? "￿"));

  return NextResponse.json({ players });
}
