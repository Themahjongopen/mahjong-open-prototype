import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

// Admin-only management of commissioner referral codes.
//   GET    — every code with commissioner name, city, status, and full link
//   PATCH  — { id, is_active } toggle (Deactivate / Reactivate). Deactivating
//            stops the code attributing but leaves existing attribution history.
//   DELETE — { id } permanently removes a code (for one created in error).

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });

  const { data, error } = await admin
    .from("commissioner_referral_codes")
    .select("id, code, is_active, created_at, profile_id, city_id, profiles(full_name), cities(name, state)")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "Could not load referral codes." }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const codes = ((data ?? []) as any[]).map((r) => {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    const c = Array.isArray(r.cities) ? r.cities[0] : r.cities;
    return {
      id: r.id,
      code: r.code,
      is_active: r.is_active,
      commissioner_name: p?.full_name ?? "—",
      city_name: c ? `${c.name}${c.state ? `, ${c.state}` : ""}` : "—",
      url: `${SITE_URL}/join/${r.code}`,
    };
  });
  return NextResponse.json({ codes });
}

export async function PATCH(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = body?.id?.toString();
  const isActive = body?.is_active;
  if (!id || typeof isActive !== "boolean") {
    return NextResponse.json({ error: "id and is_active are required." }, { status: 400 });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  const { error } = await admin.from("commissioner_referral_codes").update({ is_active: isActive }).eq("id", id);
  if (error) return NextResponse.json({ error: "Could not update the referral code." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  const id = body?.id?.toString();
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  const { error } = await admin.from("commissioner_referral_codes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Could not delete the referral code." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
