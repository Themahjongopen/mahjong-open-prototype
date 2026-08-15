import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { resolvePrefs } from "@/lib/portal/notificationPrefs";
import { sendTableReminderEmail } from "@/lib/email/tableReminderEmail";

export const runtime = "nodejs";
// Launch runs process every city's next-day tables in one invocation (~100+
// tables, ~400 emails). Give it plenty of headroom over the default so it can't
// time out mid-batch. Bounded concurrency below keeps the real time ~10-15s.
export const maxDuration = 300;

// How many tables to process at once. Each table sends its ≤4 emails
// sequentially, so peak concurrent Resend calls = this number — modest enough
// to avoid rate-limit bursts, high enough to clear 100+ tables fast.
const CONCURRENCY = 5;

// Daily cron (Vercel Cron, vercel.json: "0 13 * * *" = 13:00 UTC = 8:00 AM CDT)
// that emails a reminder to each player seated at a table happening today or
// tomorrow. Runs with no user session (service role), authenticated by the
// Bearer CRON_SECRET header Vercel Cron sends when CRON_SECRET is set.
//
// SAFETY NET against the silent-skip failure mode: the window is today AND
// tomorrow (not just tomorrow). Normally a table is reminded the day before and
// stamped; if a run times out or every send for a table fails, that table is
// left UNSTAMPED and the next day's run catches it as a day-of reminder instead
// of the window moving past it forever. A table is stamped only when there was
// nothing to send OR at least one email succeeded — so an all-failed table stays
// retriable with no double-send risk (nobody got theirs yet).
//
// Stamp = league_tables.reminder_sent_at (migration 021); only NULL-stamp tables
// are picked up. Every run logs a one-line [table-reminders] summary so a
// zero-table run is distinguishable from a failed one.
//
// The reminder email states the actual day + time (no "tomorrow"), so a day-of
// re-pickup still reads correctly.

async function pool<T>(items: T[], size: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        await worker(items[idx]);
      }
    })
  );
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

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

  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString().slice(0, 10);

  const { data: tables, error } = await admin
    .from("league_tables")
    .select("id, table_date, table_time, location_name, location_address, round_type, status, reminder_sent_at, table_seats(user_id, canceled_at)")
    .gte("table_date", today)
    .lte("table_date", tomorrow)
    .in("status", ["open", "full"])
    .is("reminder_sent_at", null);

  if (error) {
    console.error("[table-reminders] query failed", error);
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }

  const allTables = (tables ?? []) as any[];

  // Fetch every seated player's profile up front, in chunks (a single .in with
  // hundreds of ids would overflow PostgREST's URL length).
  const seatedIds = [
    ...new Set(
      allTables.flatMap((t) => (t.table_seats ?? []).filter((s: any) => !s.canceled_at && s.user_id).map((s: any) => String(s.user_id)))
    ),
  ];
  const profileById = new Map<string, any>();
  for (const ids of chunk(seatedIds, 100)) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, full_name, notification_preferences")
      .in("id", ids);
    for (const p of (profiles ?? []) as any[]) profileById.set(String(p.id), p);
  }

  let emailsSent = 0;
  let emailsFailed = 0;
  let tablesStamped = 0;
  let tablesLeftForRetry = 0;

  await pool(allTables, CONCURRENCY, async (table) => {
    const recipients = (table.table_seats ?? [])
      .filter((s: any) => !s.canceled_at && s.user_id)
      .map((s: any) => profileById.get(String(s.user_id)))
      .filter((p: any) => p && p.email && resolvePrefs(p.notification_preferences).email_table_reminders);

    let sent = 0;
    let failed = 0;
    for (const p of recipients) {
      try {
        const res = await sendTableReminderEmail(
          { email: p.email, fullName: p.full_name },
          {
            tableId: table.id,
            tableDate: table.table_date,
            tableTime: table.table_time,
            locationName: table.location_name,
            locationAddress: table.location_address,
            roundType: table.round_type,
          }
        );
        if (res.ok) sent++;
        else { failed++; console.error("[table-reminders] not sent", p.email, res.error); }
      } catch (err) {
        failed++;
        console.error("[table-reminders] send failed", p.email, err);
      }
    }
    emailsSent += sent;
    emailsFailed += failed;

    // Stamp only if nothing needed sending, or at least one send succeeded.
    // If there were recipients and ALL failed, leave it unstamped so the next
    // run retries it — nobody got theirs, so no double-send risk.
    if (recipients.length === 0 || sent > 0) {
      await admin.from("league_tables").update({ reminder_sent_at: new Date().toISOString() }).eq("id", table.id);
      tablesStamped++;
    } else {
      tablesLeftForRetry++;
    }
  });

  const summary = {
    window: `${today}..${tomorrow}`,
    tablesFound: allTables.length,
    tablesStamped,
    tablesLeftForRetry,
    emailsSent,
    emailsFailed,
  };
  console.log("[table-reminders]", JSON.stringify(summary));
  return NextResponse.json(summary);
}
