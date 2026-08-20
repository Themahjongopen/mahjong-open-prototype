import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { loadCohortCandidates } from "@/lib/portal/inviteCandidates";

export const runtime = "nodejs";

// Admin-only candidate list for the "Add player" picker on /admin/tables: paid
// players in the TABLE's city+series, minus anyone already actively seated here.
// Directory-agnostic (includeHidden) — an admin resolving a support case should
// reach any paid player, even one hidden from the public directory. Service-role.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, city_id, series_id, table_seats(user_id, canceled_at)")
    .eq("id", id)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seatedIds = new Set(((table.table_seats ?? []) as any[]).filter((s) => !s.canceled_at).map((s) => s.user_id));
  const map = await loadCohortCandidates(admin, table.city_id, table.series_id, seatedIds as Set<string>, true);
  const players = [...map.values()]
    .map((c) => ({ profile_id: c.profile_id, full_name: c.full_name, skill_level: c.skill_level }))
    .sort((a, b) => (a.full_name ?? "￿").localeCompare(b.full_name ?? "￿"));

  return NextResponse.json({ players });
}
