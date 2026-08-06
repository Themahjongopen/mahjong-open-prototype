import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isAdminRequest } from "@/lib/admin/auth";

export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Admin edit of a registrant's name / email / phone. Updates every place that
// info lives: the registration row, the linked profile (if any), and — when the
// email changes for a linked account — their actual Supabase Auth login email,
// so the player signs in with the new address going forward (confirmed with
// Jordan: no separate confirmation step, admin changes it directly).
//
// `registrations`/`profiles` aren't in the generated Database types, and
// profiles.phone is a real column missing from those types (migrations 007/015)
// — so use the untyped admin client, same as the rest of the admin routes.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const fullName = body?.full_name?.toString().trim();
  const email = body?.email?.toString().trim();
  const phone = body?.phone?.toString().trim();

  // All three are required at registration; an edit can't blank one out.
  if (!fullName || !email || !phone) {
    return NextResponse.json({ error: "Name, email, and phone are all required." }, { status: 400 });
  }
  // Light email sanity check — updateUserById would reject a malformed address,
  // but only AFTER we'd already written the DB, so catch it up front.
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  const { data: reg, error: loadError } = await supabase
    .from("registrations")
    .select("id, email, profile_id, city_id, series_id")
    .eq("id", id)
    .maybeSingle();
  if (loadError) {
    return NextResponse.json({ error: "Could not load the registration." }, { status: 502 });
  }
  if (!reg) {
    return NextResponse.json({ error: "That registration no longer exists." }, { status: 404 });
  }

  const emailChanged = String(reg.email).toLowerCase() !== email.toLowerCase();

  // Uniqueness mirrors migration 019's UNIQUE (email, series_id, city_id): a
  // different registration can't already hold this email in the same city+series.
  // Checked in JS (not ilike, whose _/% would misfire on valid emails) over the
  // same city+series, excluding this row. Only meaningful when both are set —
  // with a null city/series Postgres doesn't enforce the constraint anyway.
  if (emailChanged && reg.series_id && reg.city_id) {
    const { data: clashes, error: clashError } = await supabase
      .from("registrations")
      .select("id, email")
      .eq("series_id", reg.series_id)
      .eq("city_id", reg.city_id)
      .neq("id", id);
    if (clashError) {
      return NextResponse.json({ error: "Could not verify the email is available." }, { status: 502 });
    }
    const collides = (clashes ?? []).some((c: any) => String(c.email).toLowerCase() === email.toLowerCase());
    if (collides) {
      return NextResponse.json({ error: "That email is already registered for this city and series." }, { status: 409 });
    }
  }

  const { error: regError } = await supabase
    .from("registrations")
    .update({ full_name: fullName, email, phone })
    .eq("id", id);
  if (regError) {
    return NextResponse.json({ error: "Could not update the registration." }, { status: 500 });
  }

  // Keep the linked profile in sync (profiles.id === auth uid, per migration 007).
  if (reg.profile_id) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, email, phone })
      .eq("id", reg.profile_id);
    if (profileError) {
      return NextResponse.json({ error: "The registration was updated, but their profile could not be updated — please try again." }, { status: 500 });
    }

    // The actual login credential. Do this last: if it fails, the DB already
    // holds the new email but their sign-in email doesn't — surface that clearly
    // rather than reporting a clean success.
    if (emailChanged) {
      const { error: authError } = await supabase.auth.admin.updateUserById(reg.profile_id, { email });
      if (authError) {
        return NextResponse.json(
          { error: "The registration and profile were updated, but the login email could not be changed. Try again, or contact support." },
          { status: 500 }
        );
      }
    }
  }

  return NextResponse.json({ ok: true });
}
