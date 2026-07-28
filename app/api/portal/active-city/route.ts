import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPortalUser } from "@/lib/portal/session";
import { PLAYER_CITY_COOKIE } from "@/lib/portal/playerCity";

// Set a multi-city player's "viewing city" cookie. The target must be one of the
// caller's OWN paid cities. Like the admin-city route, this cookie only selects
// which city's data to display — it is never used for authorization (RLS /
// service-role still gate every action).
export async function POST(request: Request) {
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cityId = body?.cityId?.toString();
  if (!cityId) {
    return NextResponse.json({ error: "A city is required." }, { status: 400 });
  }

  // Only allow switching to a city the caller actually holds a paid seat in.
  const isOwnCity = session.memberships.some((m) => m.city_id === cityId);
  if (!isOwnCity) {
    return NextResponse.json({ error: "That isn't one of your cities." }, { status: 400 });
  }

  const store = await cookies();
  store.set(PLAYER_CITY_COOKIE, cityId, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
  });

  return NextResponse.json({ ok: true });
}
