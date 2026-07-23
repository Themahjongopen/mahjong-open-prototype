import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_CITY_COOKIE } from "@/lib/portal/adminCity";

// Set the admin's "active city" cookie. Admin-only, and the target must be an
// active city. The cookie only selects which city's data to display — it is not
// used for authorization anywhere (service-role/RLS still gate actions).
export async function POST(request: Request) {
  const session = await getPortalUser();
  if (!session || session.status !== "active" || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cityId = body?.cityId?.toString();
  if (!cityId) {
    return NextResponse.json({ error: "A city is required." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Unavailable right now." }, { status: 503 });
  }

  const { data: city } = await admin
    .from("cities")
    .select("id")
    .eq("id", cityId)
    .eq("is_active", true)
    .maybeSingle();
  if (!city) {
    return NextResponse.json({ error: "That isn't an active city." }, { status: 400 });
  }

  const store = await cookies();
  store.set(ADMIN_CITY_COOKIE, cityId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });

  return NextResponse.json({ ok: true });
}
