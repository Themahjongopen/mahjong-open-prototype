import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { sanitizePrefs } from "@/lib/portal/notificationPrefs";

const SKILLS = new Set(["beginner", "intermediate", "advanced"]);

// Update the authenticated member's OWN profile. profiles is RLS-locked to
// service-role, so we resolve the caller from their session, then write their
// own row (id = auth.uid()) with the admin client. A member can only ever edit
// themselves — the id is taken from the session, never from the body.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const update: {
    full_name?: string;
    skill_level?: string | null;
    notification_preferences?: Record<string, boolean>;
  } = {};

  if ("full_name" in body) {
    const name = body.full_name?.toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    update.full_name = name;
  }

  if ("skill_level" in body) {
    const skill = body.skill_level;
    if (skill !== null && !SKILLS.has(String(skill))) {
      return NextResponse.json({ error: "Invalid skill level." }, { status: 400 });
    }
    update.skill_level = skill === null ? null : String(skill);
  }

  if ("notification_preferences" in body) {
    update.notification_preferences = sanitizePrefs(body.notification_preferences);
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Profile service is unavailable." }, { status: 503 });
  }

  const { data, error } = await admin
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("full_name, skill_level, notification_preferences")
    .single();

  if (error) {
    return NextResponse.json({ error: "Your profile could not be updated." }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
