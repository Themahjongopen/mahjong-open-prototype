import { NextResponse } from "next/server";
import { createAdminClient, listAuthUsersByEmail } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/auth";

// Portal account state for a registrant:
//   none     — no auth account yet (can be invited if paid)
//   invited  — account exists but they've never signed in (can be re-sent)
//   active   — they've signed in at least once (point them at password reset)
type InviteState = "none" | "invited" | "active";

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
  city_id: string | null;
  series: string | null;
  series_id: string | null;
  // Distinct cities this email holds a PAID registration in (multi-city, per the
  // migration 019 membership model). Same value on every row for that email.
  paid_city_count: number;
  invited: boolean; // convenience: invite_state !== "none"
  invite_state: InviteState;
  profile_id?: string | null;
  role?: string | null;
};

// Local-preview fallback used only when no service-role client is configured.
// Reshaped to look like real registrations (name/email/phone/city/series/paid_status/date).
const MOCK_REGISTRATIONS: RegistrationRow[] = [
  { id: "reg-1", full_name: "Morgan Park", email: "morgan@example.com", phone: "(213) 555-0142", skill_level: "advanced", paid_status: "paid", created_at: "2026-06-28T18:30:00Z", city: "Los Angeles, CA", city_id: null, series: "Spring 2026", series_id: null, paid_city_count: 1, invited: true, invite_state: "active" },
  { id: "reg-2", full_name: "Alex Kim", email: "alex@example.com", phone: "(310) 555-0199", skill_level: "intermediate", paid_status: "paid", created_at: "2026-06-27T14:05:00Z", city: "Los Angeles, CA", city_id: null, series: "Spring 2026", series_id: null, paid_city_count: 1, invited: true, invite_state: "invited" },
  { id: "reg-3", full_name: "Sam Rivera", email: "sam@example.com", phone: null, skill_level: "beginner", paid_status: "pending", created_at: "2026-06-26T21:12:00Z", city: "San Francisco, CA", city_id: null, series: "Spring 2026", series_id: null, paid_city_count: 0, invited: false, invite_state: "none" },
  { id: "reg-4", full_name: "Taylor Brooks", email: "taylor@example.com", phone: "(415) 555-0173", skill_level: "intermediate", paid_status: "refunded", created_at: "2026-06-24T09:47:00Z", city: "San Francisco, CA", city_id: null, series: "Spring 2026", series_id: null, paid_city_count: 0, invited: false, invite_state: "none" },
];

function formatCity(city: { name: string | null; state: string | null } | null | undefined): string | null {
  if (!city?.name) return null;
  return city.state ? `${city.name}, ${city.state}` : city.name;
}


export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // `registrations` and `series` aren't in the generated Database types yet, so use
  // an untyped client for this query (same pattern as /api/register).
  const supabase: any = createAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("registrations")
      .select("id, full_name, email, phone, skill_level, paid_status, created_at, profile_id, city_id, series_id, cities(name, state), series(name), profiles(role)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // last_sign_in_at (accepted vs. invited) isn't exposed via PostgREST, so read
      // it from the Auth admin API. Non-fatal if it fails — we degrade to "invited"
      // for any linked account rather than blocking the page.
      let usersByEmail = new Map<string, { id: string; last_sign_in_at: string | null }>();
      try {
        usersByEmail = await listAuthUsersByEmail(supabase);
      } catch {
        usersByEmail = new Map();
      }

      // Multi-city membership per migration 019: count DISTINCT cities each email
      // holds a PAID registration in. Keyed by lowercased email; same count is
      // attached to every one of that email's rows below.
      const paidCitiesByEmail = new Map<string, Set<string>>();
      for (const row of data as any[]) {
        if (row.paid_status === "paid" && row.city_id) {
          const key = String(row.email).toLowerCase();
          const set = paidCitiesByEmail.get(key) ?? new Set<string>();
          set.add(row.city_id);
          paidCitiesByEmail.set(key, set);
        }
      }

      const players: RegistrationRow[] = data.map((row: any) => {
        // Supabase types embedded relations as arrays; normalize to a single object.
        const city = Array.isArray(row.cities) ? row.cities[0] : row.cities;
        const series = Array.isArray(row.series) ? row.series[0] : row.series;

        const authUser = usersByEmail.get(String(row.email).toLowerCase());
        let invite_state: InviteState = "none";
        if (authUser) {
          invite_state = authUser.last_sign_in_at ? "active" : "invited";
        } else if (row.profile_id) {
          invite_state = "invited"; // linked account we couldn't read sign-in state for
        }

        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

        return {
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          phone: row.phone,
          skill_level: row.skill_level,
          paid_status: row.paid_status,
          created_at: row.created_at,
          city: formatCity(city),
          city_id: row.city_id ?? null,
          series: series?.name ?? null,
          series_id: row.series_id ?? null,
          paid_city_count: paidCitiesByEmail.get(String(row.email).toLowerCase())?.size ?? 0,
          invited: invite_state !== "none",
          invite_state,
          profile_id: row.profile_id ?? null,
          role: profile?.role ?? null,
        };
      });
      // Empty state is returned cleanly as an empty array (page shows "No registrations yet").
      return NextResponse.json({ players });
    }
  }

  return NextResponse.json({ players: MOCK_REGISTRATIONS });
}

// Player↔Commissioner designation against real profiles. A city may have MORE
// THAN ONE commissioner, tracked per-profile by profiles.commissioner_city_id.
// Promoting requires the caller to name the city (cityId) — we no longer guess
// it from the target's most-recent registration, which could pick the wrong city
// once a player is registered in more than one (migration 019). Promoting only
// updates the named player's row; it never demotes anyone else who leads that city.
export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const designation = String(body?.designation ?? "player").toLowerCase();
  const profileId = (body?.profileId ?? body?.id)?.toString();
  if (!profileId) {
    return NextResponse.json({ error: "Player id is required." }, { status: 400 });
  }

  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  if (designation !== "commissioner") {
    // Demote: clear both the role and the city link.
    const { error } = await supabase
      .from("profiles")
      .update({ role: "player", commissioner_city_id: null })
      .eq("id", profileId);
    if (error) return NextResponse.json({ error: "Could not update the player." }, { status: 500 });
    return NextResponse.json({ ok: true, designation: "player" });
  }

  // Promote to commissioner — the city must be named explicitly, not guessed.
  const cityId = (body?.cityId)?.toString();
  if (!cityId) {
    return NextResponse.json({ error: "A city is required to make someone a commissioner." }, { status: 400 });
  }

  // The named city must be one the target actually holds a paid registration in.
  const { data: reg } = await supabase
    .from("registrations")
    .select("id")
    .eq("profile_id", profileId)
    .eq("city_id", cityId)
    .eq("paid_status", "paid")
    .limit(1)
    .maybeSingle();
  if (!reg) {
    return NextResponse.json({ error: "That city isn't one of this player's paid registrations." }, { status: 400 });
  }

  // A city can have more than one commissioner — promoting this player does NOT
  // demote anyone else who already leads the same city; only this row changes.
  const { error } = await supabase
    .from("profiles")
    .update({ role: "commissioner", commissioner_city_id: cityId })
    .eq("id", profileId);
  if (error) return NextResponse.json({ error: "Could not update the player." }, { status: 500 });

  return NextResponse.json({ ok: true, designation: "commissioner", cityId });
}
