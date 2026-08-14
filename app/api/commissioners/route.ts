import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Public endpoint: the active commissioners for a city, powering the registration
// modal's "How did you hear about us?" dropdown (shown only for split_commission
// cities). "Active" = holds an ACTIVE referral code — so deactivating a code
// removes that commissioner from the dropdown (and, server-side, from organic
// splits) in one move. Service-role read; commissioner names are shown to
// prospective registrants by design (that's the whole point of the dropdown).
export async function GET(request: Request) {
  const cityId = new URL(request.url).searchParams.get("city_id");
  if (!cityId) return NextResponse.json({ commissioners: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ commissioners: [] });

  const { data } = await admin
    .from("commissioner_referral_codes")
    .select("profile_id, profiles(full_name)")
    .eq("city_id", cityId)
    .eq("is_active", true);

  const commissioners = ((data ?? []) as any[])
    .map((r) => ({
      profile_id: r.profile_id,
      full_name: (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles)?.full_name ?? null,
    }))
    .filter((c) => c.full_name)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return NextResponse.json({ commissioners });
}
