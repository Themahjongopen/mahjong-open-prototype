import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { sendSeriesAnnouncementEmail } from "@/lib/email/seriesAnnouncementEmail";

export const runtime = "nodejs";

type Outcome = { email: string; status: "sent" | "skipped" | "error"; message?: string };

// Admin broadcast: send a composed announcement to paid, portal-linked players in
// a series (optionally scoped to one city). Gated like every /api/admin/* route.
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const seriesId = body?.seriesId?.toString().trim();
  const cityId = body?.cityId ? body.cityId.toString().trim() : null; // null = every city in the series
  const subject = body?.subject?.toString().trim();
  const message = body?.message?.toString().trim();
  if (!seriesId || !subject || !message) {
    return NextResponse.json({ error: "A series, subject, and message are all required." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Announcement service is unavailable." }, { status: 503 });
  }

  // Audience: paid registrations in this series that are linked to a portal
  // profile (the only way to know their notification pref), optionally one city.
  let query = supabase
    .from("registrations")
    .select("profile_id, profiles(id, email, full_name, notification_preferences)")
    .eq("series_id", seriesId)
    .eq("paid_status", "paid")
    .not("profile_id", "is", null);
  if (cityId) query = query.eq("city_id", cityId);
  const { data: regs, error } = await query;
  if (error) {
    return NextResponse.json({ error: "Could not resolve the audience." }, { status: 500 });
  }

  // De-dup by profile id: a multi-city player registered in two cities of this
  // series would otherwise be targeted twice when cityId is null (all cities).
  const byProfile = new Map<string, { id: string; email: string | null; full_name: string | null; notification_preferences: unknown }>();
  for (const r of (regs ?? []) as any[]) {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    if (p?.id && !byProfile.has(p.id)) byProfile.set(p.id, p);
  }

  const outcomes: Outcome[] = [];
  for (const p of byProfile.values()) {
    if (!p.email) continue; // no address on file — not a reachable recipient
    if (!resolvePrefs(p.notification_preferences).email_series_updates) {
      outcomes.push({ email: p.email, status: "skipped", message: "Opted out of series updates." });
      continue;
    }
    try {
      const res = await sendSeriesAnnouncementEmail({ email: p.email, fullName: p.full_name }, { subject, message });
      outcomes.push(res.ok ? { email: p.email, status: "sent" } : { email: p.email, status: "error", message: res.error });
    } catch (err) {
      console.error("seriesAnnouncement send failed", p.email, err);
      outcomes.push({ email: p.email, status: "error", message: "Send failed." });
    }
  }

  const sent = outcomes.filter((o) => o.status === "sent").length;
  const failed = outcomes.filter((o) => o.status === "error").length;
  const skipped = outcomes.filter((o) => o.status === "skipped").length;
  return NextResponse.json({ ok: sent > 0, sent, failed, skipped, outcomes });
}
