import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";
import { createAdminClient } from "@/lib/supabase/server";

// GET /api/tables/areas?city_id=… — distinct non-null areas used by tables in
// that city (member's series), most-frequent first, capped at ~20. Powers the
// create/edit combobox so hosts reuse existing areas instead of inventing near-
// duplicates.
//
// BEST-EFFORT BY DESIGN: this endpoint NEVER returns an error status. On missing
// auth, missing params, a dead admin client, or a query error it returns
// { areas: [] } with 200, so the combobox simply shows no suggestions and
// degrades to a plain text input. A failure here must never block table creation.
export async function GET(request: Request) {
  try {
    const session = await getPortalUser();
    if (!session || session.status !== "active") {
      return NextResponse.json({ areas: [] });
    }

    const cityId = new URL(request.url).searchParams.get("city_id");

    // Scope to the requesting member's series (admins: their active series).
    let seriesId = session.series_id;
    if (session.isAdmin) {
      const ctx = await getAdminContext();
      seriesId = ctx.seriesId;
    }
    if (!cityId || !seriesId) return NextResponse.json({ areas: [] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin: any = createAdminClient();
    if (!admin) return NextResponse.json({ areas: [] });

    const { data, error } = await admin
      .from("league_tables")
      .select("area")
      .eq("city_id", cityId)
      .eq("series_id", seriesId)
      .not("area", "is", null);
    if (error) return NextResponse.json({ areas: [] });

    // Aggregate frequency in JS — a city holds only tens of tables, so this is
    // cheaper and simpler than a PostgREST group-by RPC.
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as { area: string | null }[]) {
      if (!row.area) continue;
      counts.set(row.area, (counts.get(row.area) ?? 0) + 1);
    }
    const areas = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([area]) => area);

    return NextResponse.json({ areas });
  } catch {
    return NextResponse.json({ areas: [] });
  }
}
