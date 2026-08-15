import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { normalizeArea } from "@/lib/portal/area";

// Admin area management for a city.
//   GET  /api/admin/areas?city_id=…  → [{ area, count }] in-use areas + table counts
//   POST /api/admin/areas { city_id, from: string[], to } → merge/rename: set
//        league_tables.area = normalize(to) for every table in this city whose
//        area is in `from`. A single-element `from` is an in-place rename; two or
//        more is a merge. Admin-gated.

export async function GET(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const cityId = new URL(request.url).searchParams.get("city_id");
  if (!cityId) return NextResponse.json({ areas: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });

  const { data, error } = await admin
    .from("league_tables")
    .select("area")
    .eq("city_id", cityId)
    .not("area", "is", null);
  if (error) return NextResponse.json({ error: "Areas could not be loaded." }, { status: 500 });

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { area: string | null }[]) {
    if (row.area) counts.set(row.area, (counts.get(row.area) ?? 0) + 1);
  }
  const areas = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([area, count]) => ({ area, count }));
  return NextResponse.json({ areas });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cityId = body?.city_id?.toString();
  const from = Array.isArray(body?.from) ? body.from.map((x: unknown) => String(x)).filter(Boolean) : [];
  // Normalize the target with the SAME helper the create/edit paths use, so a
  // merge can't produce a value those paths never would.
  const to = normalizeArea(body?.to?.toString());

  if (!cityId || from.length === 0 || !to) {
    return NextResponse.json({ error: "Pick at least one area and a target name." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });

  // Scoped to the city; setting area=to where area already =to is a harmless no-op.
  const { data, error } = await admin
    .from("league_tables")
    .update({ area: to })
    .eq("city_id", cityId)
    .in("area", from)
    .select("id");
  if (error) return NextResponse.json({ error: "The merge could not be completed." }, { status: 500 });

  return NextResponse.json({ updated: (data ?? []).length, to });
}
