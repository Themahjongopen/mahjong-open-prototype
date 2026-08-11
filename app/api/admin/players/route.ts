import { NextResponse } from "next/server";
import { createAdminClient, listAuthUsersByEmail, type AuthUserSummary } from "@/lib/supabase/server";
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
  // When the last portal set-password link was sent (invited_at/recovery_sent_at
  // off the Auth user). Null for never-invited or unreadable accounts.
  invite_sent_at: string | null;
  profile_id?: string | null;
  role?: string | null;
  // Every city this profile leads (migration 029). Same list on every row for
  // that profile; the page shows the badge only on rows whose city is in here.
  commissioner_city_ids?: string[];
};

// Local-preview fallback used only when no service-role client is configured.
// Reshaped to look like real registrations (name/email/phone/city/series/paid_status/date).
const MOCK_REGISTRATIONS: RegistrationRow[] = [
  { id: "reg-1", full_name: "Morgan Park", email: "morgan@example.com", phone: "(213) 555-0142", skill_level: "advanced", paid_status: "paid", created_at: "2026-06-28T18:30:00Z", city: "Los Angeles, CA", city_id: null, series: "Spring 2026", series_id: null, paid_city_count: 1, invited: true, invite_state: "active", invite_sent_at: "2026-06-28T19:00:00Z" },
  { id: "reg-2", full_name: "Alex Kim", email: "alex@example.com", phone: "(310) 555-0199", skill_level: "intermediate", paid_status: "paid", created_at: "2026-06-27T14:05:00Z", city: "Los Angeles, CA", city_id: null, series: "Spring 2026", series_id: null, paid_city_count: 1, invited: true, invite_state: "invited", invite_sent_at: "2026-06-27T15:10:00Z" },
  { id: "reg-3", full_name: "Sam Rivera", email: "sam@example.com", phone: null, skill_level: "beginner", paid_status: "pending", created_at: "2026-06-26T21:12:00Z", city: "San Francisco, CA", city_id: null, series: "Spring 2026", series_id: null, paid_city_count: 0, invited: false, invite_state: "none", invite_sent_at: null },
  { id: "reg-4", full_name: "Taylor Brooks", email: "taylor@example.com", phone: "(415) 555-0173", skill_level: "intermediate", paid_status: "refunded", created_at: "2026-06-24T09:47:00Z", city: "San Francisco, CA", city_id: null, series: "Spring 2026", series_id: null, paid_city_count: 0, invited: false, invite_state: "none", invite_sent_at: null },
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
      // Cities each profile leads (migration 029's join table), attached as
      // commissioner_city_ids to every row. commissioner_cities is tiny (one row
      // per commissioner-city), so fetch the WHOLE table rather than filtering by
      // the page's profile ids — a .in(...) with hundreds of registrant ids
      // overflows PostgREST's URL length limit and 400s, which (being ignored
      // here) would silently blank every commissioner badge at production scale.
      const commissionerCitiesByProfile = new Map<string, string[]>();
      const { data: ccRows } = await supabase
        .from("commissioner_cities")
        .select("profile_id, city_id");
      for (const cc of (ccRows ?? []) as Array<{ profile_id: string; city_id: string }>) {
        const arr = commissionerCitiesByProfile.get(cc.profile_id) ?? [];
        arr.push(cc.city_id);
        commissionerCitiesByProfile.set(cc.profile_id, arr);
      }
      // last_sign_in_at (accepted vs. invited) isn't exposed via PostgREST, so read
      // it from the Auth admin API. Non-fatal if it fails — we degrade to "invited"
      // for any linked account rather than blocking the page.
      let usersByEmail = new Map<string, AuthUserSummary>();
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
          invite_sent_at: authUser?.invite_sent_at ?? null,
          profile_id: row.profile_id ?? null,
          role: profile?.role ?? null,
          commissioner_city_ids: row.profile_id ? (commissionerCitiesByProfile.get(row.profile_id) ?? []) : [],
        };
      });
      // Empty state is returned cleanly as an empty array (page shows "No registrations yet").
      return NextResponse.json({ players });
    }
  }

  return NextResponse.json({ players: MOCK_REGISTRATIONS });
}

// Player↔Commissioner designation against real profiles. Commissioner status is
// now a SET of cities per profile (migration 029's commissioner_cities), so both
// promote and demote are city-scoped and require an explicit cityId:
//   - promote: add the city to the set (never touches other cities they lead);
//   - demote:  remove just that city; only flip role -> 'player' once the set is
//              empty (they no longer lead ANY city).
// A city may still have more than one commissioner; nothing here demotes anyone
// else who leads the same city.
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
    // Demote is CITY-SCOPED — remove just the named city, not every city this
    // profile leads. cityId is required (the admin UI always has it, since
    // demote is only ever offered from a specific city's row).
    const cityId = (body?.cityId)?.toString();
    if (!cityId) {
      return NextResponse.json({ error: "A city is required to remove a commissioner." }, { status: 400 });
    }
    const { error: delErr } = await supabase
      .from("commissioner_cities")
      .delete()
      .eq("profile_id", profileId)
      .eq("city_id", cityId);
    if (delErr) return NextResponse.json({ error: "Could not update the player." }, { status: 500 });

    // Only demote role -> 'player' if they no longer lead ANY city.
    const { count } = await supabase
      .from("commissioner_cities")
      .select("city_id", { count: "exact", head: true })
      .eq("profile_id", profileId);
    if (!count) {
      await supabase.from("profiles").update({ role: "player" }).eq("id", profileId);
    }
    return NextResponse.json({ ok: true, designation: "player", cityId });
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

  // Add this city to the set they lead — never touches any other city they
  // already lead. This is the actual fix: promoting to a second city no longer
  // silently un-commissions the first.
  const { error: insErr } = await supabase
    .from("commissioner_cities")
    .upsert({ profile_id: profileId, city_id: cityId }, { onConflict: "profile_id,city_id" });
  if (insErr) return NextResponse.json({ error: "Could not update the player." }, { status: 500 });
  await supabase.from("profiles").update({ role: "commissioner" }).eq("id", profileId);

  return NextResponse.json({ ok: true, designation: "commissioner", cityId });
}
