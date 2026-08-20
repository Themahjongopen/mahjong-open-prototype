import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";
import { createAdminClient } from "@/lib/supabase/server";
import { loadCohortCandidates } from "@/lib/portal/inviteCandidates";

export const runtime = "nodejs";

// Candidate invitees for the create-table form: paid players in the creator's
// active city+series, in the directory, minus the creator. Same cohort resolution
// as the create route (session cohort, or the admin's active city). Service-role
// read; names are shown to the host by design (that's the point of inviting).
export async function GET() {
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  let cityId = session.city_id;
  let seriesId = session.series_id;
  if (session.isAdmin) {
    const ctx = await getAdminContext();
    cityId = ctx.cityId;
    seriesId = ctx.seriesId;
  }
  if (!cityId || !seriesId) {
    return NextResponse.json({ candidates: [] });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ candidates: [] });
  }

  const map = await loadCohortCandidates(admin, cityId, seriesId, new Set([session.id]));
  const candidates = [...map.values()].sort((a, b) => (a.full_name ?? "￿").localeCompare(b.full_name ?? "￿"));

  return NextResponse.json({ candidates });
}
