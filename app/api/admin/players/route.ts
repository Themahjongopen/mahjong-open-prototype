import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from "@/lib/admin/passcode";

// Registration rows shaped for the admin Registrations page.
type RegistrationRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  skill_level: string | null;
  paid_status: string;
  created_at: string;
  city: string | null;
  series: string | null;
  invited: boolean; // has a linked portal account (registrations.profile_id set)
};

// Local-preview fallback used only when no service-role client is configured.
// Reshaped to look like real registrations (name/email/phone/city/series/paid_status/date).
const MOCK_REGISTRATIONS: RegistrationRow[] = [
  { id: "reg-1", full_name: "Morgan Park", email: "morgan@example.com", phone: "(213) 555-0142", skill_level: "advanced", paid_status: "paid", created_at: "2026-06-28T18:30:00Z", city: "Los Angeles, CA", series: "Spring 2026", invited: true },
  { id: "reg-2", full_name: "Alex Kim", email: "alex@example.com", phone: "(310) 555-0199", skill_level: "intermediate", paid_status: "paid", created_at: "2026-06-27T14:05:00Z", city: "Los Angeles, CA", series: "Spring 2026", invited: false },
  { id: "reg-3", full_name: "Sam Rivera", email: "sam@example.com", phone: null, skill_level: "beginner", paid_status: "pending", created_at: "2026-06-26T21:12:00Z", city: "San Francisco, CA", series: "Spring 2026", invited: false },
  { id: "reg-4", full_name: "Taylor Brooks", email: "taylor@example.com", phone: "(415) 555-0173", skill_level: "intermediate", paid_status: "refunded", created_at: "2026-06-24T09:47:00Z", city: "San Francisco, CA", series: "Spring 2026", invited: false },
];

function formatCity(city: { name: string | null; state: string | null } | null | undefined): string | null {
  if (!city?.name) return null;
  return city.state ? `${city.name}, ${city.state}` : city.name;
}

function isAuthorized(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const adminCookie = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE_NAME}=`));
  if (!adminCookie) return false;
  return isValidAdminCookie(adminCookie.slice(ADMIN_COOKIE_NAME.length + 1), process.env.ADMIN_PASSCODE);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `registrations` and `series` aren't in the generated Database types yet, so use
  // an untyped client for this query (same pattern as /api/register).
  const supabase: any = createAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id, full_name, email, phone, skill_level, paid_status, created_at, profile_id, cities(name, state), series(name)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const players: RegistrationRow[] = data.map((row: any) => {
        // Supabase types embedded relations as arrays; normalize to a single object.
        const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
        const series = Array.isArray(row.series) ? row.series[0] : row.series;
        return {
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          skill_level: row.skill_level,
          paid_status: row.paid_status,
          created_at: row.created_at,
          city: formatCity(city),
          series: series?.name ?? null,
          invited: Boolean(row.profile_id),
        };
      });
      // Empty state is returned cleanly as an empty array (page shows "No registrations yet").
      return NextResponse.json({ players });
    }
  }

  return NextResponse.json({ players: MOCK_REGISTRATIONS });
}

// PHASE 2: Player↔Commissioner designation. This updates `profiles.role`, which
// requires portal auth accounts that don't exist in Phase 1 (nothing creates a
// `profiles` row at registration). The Phase-1 Registrations page does NOT render
// the designation control, so this handler is currently unused — it's parked here
// for Phase 2, when it will likely operate against profiles/membership joined back
// to registrations by email.
export async function PUT(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const designation = String(body?.designation ?? "player").toLowerCase();
  const nextRole: "player" | "admin" | "commissioner" = designation === "commissioner" ? "commissioner" : "player";
  const profileId = body?.profileId ?? body?.id;

  const supabase = createAdminClient();
  if (supabase && profileId) {
    await supabase.from("profiles").update({ role: nextRole }).eq("id", profileId);
    if (designation === "commissioner") {
      await supabase.from("profiles").update({ role: "player" }).neq("id", profileId).eq("role", "commissioner");
    }
    return NextResponse.json({ success: true, designation });
  }

  return NextResponse.json({ error: "Player not found" }, { status: 404 });
}
