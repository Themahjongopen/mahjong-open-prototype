import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { activeSeats } from "@/lib/portal/seats";
import { sendTableInviteEmail } from "@/lib/email/tableInviteEmail";

export const runtime = "nodejs";

const TABLE_SEATS = 4;

// Person-to-person table invites (migration 034). A player SEATED at a table can
// email other registered players in the table's city+series to invite them to
// join. Notification only — inserting a table_invites row never seats anyone; the
// recipient still taps the real "Join this table" button. All table_invites
// access goes through the service-role client here, which does its own
// seated-at-this-table authorization (the table has no permissive RLS policies).

type Candidate = {
  profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
  skill_level: string | null;
  email: string | null;
  already_invited: boolean;
};

// A player is eligible to be invited to THIS table iff all hold:
//   - paid registration (profile_id not null) in the TABLE's city_id AND
//     series_id (read off league_tables, never the caller's active city — this
//     matters for multi-city players),
//   - show_in_directory is not false (opted-out players stay hidden here too),
//   - not currently ACTIVELY seated at this table (a player who CANCELLED a seat
//     here is deliberately still eligible — times/locations change).
// Returns a Map keyed by profile_id (de-duped) of the candidate's profile fields.
// already_invited is layered on by the caller. Used by both GET and POST so the
// eligibility rules can't drift between listing and sending.
async function loadEligible(
  admin: any,
  table: { id: string; city_id: string; series_id: string; table_seats: Array<{ user_id: string; canceled_at: string | null }> }
): Promise<Map<string, Omit<Candidate, "already_invited">>> {
  const seatedUserIds = new Set(activeSeats(table.table_seats as any).map((s: any) => s.user_id));

  const { data } = await admin
    .from("registrations")
    .select("profile_id, profiles!inner(id, email, full_name, avatar_url, skill_level, show_in_directory)")
    .eq("city_id", table.city_id)
    .eq("series_id", table.series_id)
    .eq("paid_status", "paid")
    .not("profile_id", "is", null);

  const eligible = new Map<string, Omit<Candidate, "already_invited">>();
  for (const row of (data ?? []) as any[]) {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    if (!p) continue;
    if (p.show_in_directory === false) continue; // opted out of the directory
    if (seatedUserIds.has(p.id)) continue; // already actively seated here
    if (eligible.has(p.id)) continue; // de-dupe (defensive; one paid reg per cohort)
    eligible.set(p.id, {
      profile_id: p.id,
      full_name: p.full_name ?? null,
      avatar_url: p.avatar_url ?? null,
      skill_level: p.skill_level ?? null,
      email: p.email ?? null,
    });
  }
  return eligible;
}

// Load the table with just the columns the invite flow needs, plus its seats and
// city name. Null if it doesn't exist.
async function loadTable(admin: any, id: string) {
  const { data } = await admin
    .from("league_tables")
    .select("id, city_id, series_id, status, week_number, table_date, table_time, location_name, round_type, cities(name), table_seats(user_id, seat_number, canceled_at)")
    .eq("id", id)
    .maybeSingle();
  return data;
}

function callerIsSeated(table: any, userId: string): boolean {
  return activeSeats(table.table_seats ?? []).some((s: any) => s.user_id === userId);
}

// GET — candidate list for the invite modal: everyone eligible (including
// already-invited players, flagged rather than hidden) plus the live open-seat
// count. 403 unless the caller holds an active seat on this table.
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Invites are unavailable right now." }, { status: 503 });
  }

  const table = await loadTable(admin, id);
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (!callerIsSeated(table, session.id)) {
    return NextResponse.json({ error: "Only a seated player can invite others to this table." }, { status: 403 });
  }

  const openSeats = Math.max(0, TABLE_SEATS - activeSeats(table.table_seats ?? []).length);

  const eligible = await loadEligible(admin, table);

  // Which of the eligible are already invited to this table.
  const { data: invites } = await admin
    .from("table_invites")
    .select("invited_profile_id")
    .eq("table_id", id);
  const invitedIds = new Set((invites ?? []).map((r: any) => r.invited_profile_id));

  const candidates: Candidate[] = [...eligible.values()]
    .map((c) => ({ ...c, already_invited: invitedIds.has(c.profile_id) }))
    // Stable, friendly ordering: name A→Z (nulls last).
    .sort((a, b) => (a.full_name ?? "￿").localeCompare(b.full_name ?? "￿"));

  return NextResponse.json({ candidates, openSeats });
}

// POST — send invites. Body: { profileIds: string[] }. Inserts rows and emails
// sequentially (never Promise.all — matches resend-bulk's rate-limit posture).
// Returns { sent, skipped, failed }.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Invites are unavailable right now." }, { status: 503 });
  }

  const table = await loadTable(admin, id);
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (!callerIsSeated(table, session.id)) {
    return NextResponse.json({ error: "Only a seated player can invite others to this table." }, { status: 403 });
  }
  // A full, cancelled, or completed table can't take invites.
  if (table.status !== "open") {
    return NextResponse.json({ error: "This table isn't open for new players." }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const profileIds: string[] = Array.isArray(body?.profileIds)
    ? body.profileIds.map((v: unknown) => String(v)).filter(Boolean)
    : [];

  if (profileIds.length === 0) {
    return NextResponse.json({ error: "Pick at least one player to invite." }, { status: 400 });
  }
  if (new Set(profileIds).size !== profileIds.length) {
    return NextResponse.json({ error: "Duplicate players in the request." }, { status: 400 });
  }

  // Recompute open seats INSIDE the handler — never trust the count the client
  // got from GET; seats can fill between opening the modal and hitting send.
  const openSeats = Math.max(0, TABLE_SEATS - activeSeats(table.table_seats ?? []).length);
  if (openSeats === 0) {
    return NextResponse.json({ error: "This table is full." }, { status: 409 });
  }
  if (profileIds.length > openSeats) {
    return NextResponse.json(
      { error: `Only ${openSeats} seat${openSeats === 1 ? "" : "s"} left — pick at most ${openSeats}.` },
      { status: 400 }
    );
  }

  // Re-validate every id against the same eligibility rules as GET. Never trust
  // the client's list — a tampered profileId (unpaid, wrong city/series, opted
  // out, or already seated) is rejected here, not silently invited.
  const eligible = await loadEligible(admin, table);
  const invalid = profileIds.filter((pid) => !eligible.has(pid));
  if (invalid.length > 0) {
    return NextResponse.json({ error: "One or more selected players can't be invited to this table." }, { status: 400 });
  }

  const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
  const cityName = city?.name ?? null;

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const failedNames: string[] = []; // names of players whose email couldn't be sent

  // Sequential (not Promise.all) to avoid bursting Resend's rate limit, matching
  // /api/admin/registrations/resend-bulk.
  for (const pid of profileIds) {
    const cand = eligible.get(pid)!;
    // Insert the invite row. A unique-violation (23505) means someone else
    // invited this player a moment earlier — count as skipped, not failed, and
    // send no email (the first inviter's email already went out).
    const { data: inserted, error: insErr } = await admin
      .from("table_invites")
      .insert({ table_id: id, invited_profile_id: pid, invited_by_profile_id: session.id })
      .select("id")
      .single();
    if (insErr) {
      if (insErr.code === "23505") {
        skipped += 1;
      } else {
        failed += 1;
        failedNames.push(cand.full_name ?? "a player");
      }
      continue;
    }

    // The email IS the invite — a row with no delivered notice invites no one. So
    // if the send fails (bounce, transient Resend outage, missing address), DELETE
    // the row we just wrote so "email failed" means "not invited" and a retry
    // works. Otherwise the once-per-table unique constraint would silently and
    // permanently lock this player out of ever being invited to this table. A
    // failure is surfaced (failedNames) so the host can reach them another way.
    const undo = () => admin.from("table_invites").delete().eq("id", inserted.id);
    let ok = false;
    if (cand.email) {
      try {
        const res = await sendTableInviteEmail(
          { email: cand.email, fullName: cand.full_name },
          {
            tableId: id,
            inviterName: session.full_name,
            cityName,
            weekNumber: table.week_number,
            tableDate: table.table_date,
            tableTime: table.table_time,
            locationName: table.location_name,
            roundType: table.round_type,
            openSeats,
          }
        );
        ok = res.ok;
        if (!ok) console.error("tableInviteEmail not sent", cand.email, res.error);
      } catch (err) {
        console.error("tableInviteEmail send failed", cand.email, err);
      }
    }

    if (ok) {
      sent += 1;
    } else {
      await undo(); // roll the invite back so the player isn't permanently locked out
      failed += 1;
      failedNames.push(cand.full_name ?? "a player");
    }
  }

  return NextResponse.json({ ok: sent > 0, sent, skipped, failed, failedNames });
}
