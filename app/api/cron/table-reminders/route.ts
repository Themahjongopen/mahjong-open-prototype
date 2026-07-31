import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { sendTableReminderEmail } from "@/lib/email/tableReminderEmail";

export const runtime = "nodejs";

// Daily cron (Vercel Cron, see vercel.json) that emails a day-before reminder to
// each player seated at a table happening tomorrow. Runs with no user session
// (service role). Authenticated by the Bearer CRON_SECRET header Vercel Cron
// sends automatically when CRON_SECRET is set in the project env.
//
// Idempotent via league_tables.reminder_sent_at (migration 021): only tables
// with a NULL stamp are picked up, and each is stamped after processing —
// regardless of individual send outcomes — so a retry/double-fire can't
// double-email. One daily batch covers every city's "tomorrow" tables; table_date
// is a plain date with no timezone (see the build notes), which is fine for a
// once-daily heads-up.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Service unavailable." }, { status: 503 });
  }

  // "Tomorrow" = current UTC date + 1 day, as YYYY-MM-DD.
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString().slice(0, 10);

  const { data: tables, error } = await admin
    .from("league_tables")
    .select("id, table_date, table_time, location_name, location_address, round_type, status, reminder_sent_at, table_seats(user_id, canceled_at)")
    .eq("table_date", tomorrow)
    .in("status", ["open", "full"])
    .is("reminder_sent_at", null);

  if (error) {
    console.error("table-reminders query failed", error);
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }

  let tablesProcessed = 0;
  let emailsSent = 0;
  let emailsFailed = 0;

  for (const table of (tables ?? []) as any[]) {
    const seatedIds = (table.table_seats ?? [])
      .filter((s: any) => !s.canceled_at)
      .map((s: any) => String(s.user_id));

    if (seatedIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, email, full_name, notification_preferences")
        .in("id", seatedIds);

      for (const profile of (profiles ?? []) as any[]) {
        if (!profile.email) continue;
        if (!resolvePrefs(profile.notification_preferences).email_table_reminders) continue;
        try {
          const res = await sendTableReminderEmail(
            { email: profile.email, fullName: profile.full_name },
            {
              tableId: table.id,
              tableDate: table.table_date,
              tableTime: table.table_time,
              locationName: table.location_name,
              locationAddress: table.location_address,
              roundType: table.round_type,
            }
          );
          if (res.ok) emailsSent++;
          else { emailsFailed++; console.error("tableReminder not sent", profile.email, res.error); }
        } catch (err) {
          emailsFailed++;
          console.error("tableReminder send failed", profile.email, err);
        }
      }
    }

    // Stamp AFTER processing, regardless of individual send outcomes: the goal is
    // "attempted once", so a retry never re-emails whoever already got theirs.
    await admin.from("league_tables").update({ reminder_sent_at: new Date().toISOString() }).eq("id", table.id);
    tablesProcessed++;
  }

  return NextResponse.json({ tablesProcessed, emailsSent, emailsFailed });
}
