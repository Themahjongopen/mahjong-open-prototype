import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { computeAttributionRows } from "@/lib/registration/attribution";
import { sendTableUnderfilledEmail } from "@/lib/email/tableUnderfilledEmail";

export const runtime = "nodejs";

// Admin-only: move a registration to a different city, handling the downstream
// effects that a raw UPDATE would miss —
//   * BLOCK if the player hosts an upcoming table in the current city (moving her
//     would strand the other players); the admin must hand off hosting first.
//   * cancel her upcoming NON-hosting seats in the current city (chosen in the UI
//     — an orphaned seat in a city she no longer belongs to is almost never wanted).
//   * rewrite attribution for the destination city via computeAttributionRows
//     (sole commissioner @ 1.0 / even split / unattributed) so revenue re-credits.
//   * write an attribution_audit row, same as the reassignment modal.
//
// GET  → preview (what will be affected). Pass ?dest_city_id= to also get the
//        projected destination attribution.
// POST → perform the move. Re-checks the hosting block server-side (authoritative).

const UPCOMING_STATUSES = ["open", "full"];

// Today's date (YYYY-MM-DD) as seen in Central time — table_date is a DATE, and a
// UTC-evening "today" would otherwise drop the current day's tables an hour early.
function todayInCentral(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}

// The player's upcoming seats in a given city, split into tables she HOSTS
// (creator) vs. seats she merely holds. profileId null → no seats.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadUpcomingSeats(admin: any, profileId: string | null, cityId: string) {
  if (!profileId) return { hostingTables: [], cancelableSeats: [] };
  const { data: seatRows } = await admin
    .from("table_seats")
    .select("id, seat_number, canceled_at, league_tables!inner(id, creator_id, city_id, status, table_date, table_time, location_name)")
    .eq("user_id", profileId)
    .is("canceled_at", null)
    .eq("league_tables.city_id", cityId)
    .in("league_tables.status", UPCOMING_STATUSES)
    .gte("league_tables.table_date", todayInCentral());

  const hostingTables: any[] = [];
  const cancelableSeats: any[] = [];
  for (const s of (seatRows ?? []) as any[]) {
    const t = one<any>(s.league_tables);
    if (!t) continue;
    const info = { seat_id: s.id, table_id: t.id, location_name: t.location_name, table_date: t.table_date, table_time: t.table_time };
    if (t.creator_id === profileId) hostingTables.push({ id: t.id, location_name: t.location_name, table_date: t.table_date, table_time: t.table_time });
    else cancelableSeats.push(info);
  }
  return { hostingTables, cancelableSeats };
}

// Attach commissioner display names to a set of computed/stored attribution rows.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function withNames(admin: any, rows: Array<{ commissioner_profile_id: string | null; weight: number; source: string }>) {
  const ids = [...new Set(rows.map((r) => r.commissioner_profile_id).filter(Boolean))] as string[];
  const nameById = new Map<string, string | null>();
  if (ids.length) {
    const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", ids);
    for (const p of (profs ?? []) as any[]) nameById.set(p.id, p.full_name ?? null);
  }
  return rows.map((r) => ({
    commissioner_profile_id: r.commissioner_profile_id,
    commissioner_name: r.commissioner_profile_id ? nameById.get(r.commissioner_profile_id) ?? null : null,
    weight: Number(r.weight),
    source: r.source,
  }));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getPortalUser();
  if (!session || session.status !== "active" || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });

  const { data: reg } = await admin
    .from("registrations")
    .select("id, full_name, profile_id, city_id, series_id, paid_status, cities(name, state)")
    .eq("id", id)
    .maybeSingle();
  if (!reg) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

  const currentCity = one<any>(reg.cities);
  const { hostingTables, cancelableSeats } = await loadUpcomingSeats(admin, reg.profile_id, reg.city_id);

  // Current attribution (who's credited today).
  const { data: attr } = await admin
    .from("registration_attributions")
    .select("commissioner_profile_id, weight, source, profiles(full_name)")
    .eq("registration_id", id);
  const currentAttribution = ((attr ?? []) as any[]).map((a) => {
    const p = one<any>(a.profiles);
    return { commissioner_profile_id: a.commissioner_profile_id ?? null, commissioner_name: p?.full_name ?? null, weight: Number(a.weight ?? 0), source: a.source ?? null };
  });

  // Destinations: every OTHER city, INCLUDING deactivated ones (moving someone out
  // of a closing city is a main use case — those are hidden from the normal switcher).
  const { data: cityRows } = await admin.from("cities").select("id, name, state, is_active").order("name", { ascending: true });
  const destinations = ((cityRows ?? []) as any[])
    .filter((c) => c.id !== reg.city_id)
    .map((c) => ({ id: c.id, name: c.name, state: c.state ?? null, is_active: !!c.is_active }));

  // Optional: projected attribution for a chosen destination.
  const destCityId = new URL(request.url).searchParams.get("dest_city_id");
  let projectedAttribution: any = undefined;
  if (destCityId) {
    if (!destinations.some((d) => d.id === destCityId)) {
      return NextResponse.json({ error: "That destination city isn't valid." }, { status: 400 });
    }
    const computed = await computeAttributionRows(admin, { cityId: destCityId });
    projectedAttribution = await withNames(admin, computed);
  }

  return NextResponse.json({
    registration: {
      id: reg.id,
      full_name: reg.full_name,
      city_id: reg.city_id,
      current_city_name: currentCity ? `${currentCity.name}${currentCity.state ? `, ${currentCity.state}` : ""}` : null,
      series_id: reg.series_id,
      profile_id: reg.profile_id ?? null,
      paid_status: reg.paid_status,
    },
    hostingTables,
    cancelableSeats,
    currentAttribution,
    destinations,
    ...(projectedAttribution !== undefined ? { projectedAttribution } : {}),
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getPortalUser();
  if (!session || session.status !== "active" || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const destCityId = body?.destCityId ? String(body.destCityId) : "";
  const requestedSeatIds: string[] = Array.isArray(body?.cancelSeatIds) ? body.cancelSeatIds.map(String) : [];
  if (!destCityId) return NextResponse.json({ error: "A destination city is required." }, { status: 400 });

  const { data: reg } = await admin
    .from("registrations")
    .select("id, profile_id, city_id, series_id")
    .eq("id", id)
    .maybeSingle();
  if (!reg) return NextResponse.json({ error: "Registration not found." }, { status: 404 });
  if (reg.city_id === destCityId) return NextResponse.json({ error: "That's already this registration's city." }, { status: 400 });

  // Destination must be a real city (deactivated is allowed).
  const { data: destCity } = await admin.from("cities").select("id").eq("id", destCityId).maybeSingle();
  if (!destCity) return NextResponse.json({ error: "That destination city isn't valid." }, { status: 400 });

  // Authoritative hosting block — never trust a stale modal. If she hosts an
  // upcoming table in the current city, refuse and name them.
  const { hostingTables, cancelableSeats } = await loadUpcomingSeats(admin, reg.profile_id, reg.city_id);
  if (hostingTables.length > 0) {
    return NextResponse.json(
      { error: "This player is hosting an upcoming table in her current city. Hand off hosting first, then move her.", hostingTables },
      { status: 409 }
    );
  }

  // Only cancel seats that are genuinely hers, upcoming, non-hosting, and requested.
  const cancelableIds = new Set(cancelableSeats.map((s) => s.seat_id));
  const seatIdsToCancel = requestedSeatIds.filter((sid) => cancelableIds.has(sid));

  // Read-only compute of the destination attribution BEFORE any write, so a bad
  // destination aborts before we've changed anything.
  const previousAttribution = (
    (await admin.from("registration_attributions").select("commissioner_profile_id, weight, source").eq("registration_id", id)).data ?? []
  ) as any[];
  const nextAttribution = await computeAttributionRows(admin, { cityId: destCityId });

  // 1) Move the registration (the primary write).
  const { error: cityErr } = await admin.from("registrations").update({ city_id: destCityId }).eq("id", id);
  if (cityErr) return NextResponse.json({ error: "Could not move the registration." }, { status: 500 });

  // 2) Rewrite attribution for the destination (delete-then-insert; no PostgREST tx).
  let attributionOk = true;
  const { error: delAttrErr } = await admin.from("registration_attributions").delete().eq("registration_id", id);
  if (delAttrErr) attributionOk = false;
  else {
    const insertRows = nextAttribution.map((r) => ({ registration_id: id, commissioner_profile_id: r.commissioner_profile_id, weight: r.weight, source: r.source }));
    const { error: insAttrErr } = await admin.from("registration_attributions").insert(insertRows);
    if (insAttrErr) attributionOk = false;
  }
  if (!attributionOk) console.error("change-city: registration moved but attribution rewrite failed", id);

  // 3) Cancel the chosen non-hosting seats; reopen any table that drops out of 'full'.
  let canceledSeatCount = 0;
  if (seatIdsToCancel.length) {
    const { data: canceled, error: seatErr } = await admin
      .from("table_seats")
      .update({ canceled_at: new Date().toISOString() })
      .in("id", seatIdsToCancel)
      .is("canceled_at", null)
      .select("id, table_id");
    if (seatErr) {
      console.error("change-city: seat cancellation failed", id, seatErr);
    } else {
      canceledSeatCount = (canceled ?? []).length;
      const tableIds = [...new Set((canceled ?? []).map((s: any) => s.table_id))];
      if (tableIds.length) {
        // A full table that just lost a seat is open again.
        const { error: reopenErr } = await admin.from("league_tables").update({ status: "open" }).in("id", tableIds).eq("status", "full");
        if (reopenErr) console.error("change-city: reopen full tables failed", id, reopenErr);

        // Underfilled notifications — identical to the self-serve seat cancel
        // (app/api/tables/[id]/seats/cancel): for each affected table that just
        // dropped 4 → 3 active players, tell the REMAINING players a seat opened
        // so someone can fill it. From their side the outcome is the same as any
        // other cancellation. Fire ONLY on the exact 4→3 transition (activeAfter
        // === 3) so a table already short of four isn't re-spammed. Best-effort,
        // fully wrapped — the move is already committed and must not be blocked
        // by a send; sent UNCONDITIONALLY (not preference-gated), same as there.
        try {
          const { data: affected } = await admin
            .from("league_tables")
            .select("id, table_date, table_time, location_name, location_address, round_type, table_seats(user_id, canceled_at)")
            .in("id", tableIds);
          for (const t of (affected ?? []) as any[]) {
            const activeAfter = (t.table_seats ?? []).filter((s: any) => !s.canceled_at).length;
            if (activeAfter !== 3) continue;
            const remainingIds = [
              ...new Set(
                (t.table_seats ?? [])
                  .filter((s: any) => !s.canceled_at && s.user_id && s.user_id !== reg.profile_id)
                  .map((s: any) => s.user_id)
              ),
            ] as string[];
            if (!remainingIds.length) continue;
            const { data: profiles } = await admin.from("profiles").select("id, email, full_name").in("id", remainingIds);
            for (const p of (profiles ?? []) as any[]) {
              if (!p.email) continue;
              try {
                const res = await sendTableUnderfilledEmail(
                  { email: p.email, fullName: p.full_name },
                  {
                    tableId: t.id,
                    tableDate: t.table_date,
                    tableTime: t.table_time,
                    locationName: t.location_name,
                    locationAddress: t.location_address,
                    roundType: t.round_type,
                    activeCount: activeAfter,
                  }
                );
                if (!res.ok) console.error("change-city underfilled email not sent", p.email, res.error);
              } catch (err) {
                console.error("change-city underfilled email send failed", p.email, err);
              }
            }
          }
        } catch (err) {
          console.error("change-city underfilled batch failed", err);
        }
      }
    }
  }

  // 4) Audit — full prior + new attribution sets, who changed it (same as reassignment).
  const { error: auditErr } = await admin.from("attribution_audit").insert({
    registration_id: id,
    changed_by_profile_id: session.id,
    previous: previousAttribution.map((r) => ({ commissioner_profile_id: r.commissioner_profile_id ?? null, weight: Number(r.weight), source: r.source })),
    next: nextAttribution.map((r) => ({ commissioner_profile_id: r.commissioner_profile_id, weight: r.weight, source: r.source })),
  });
  if (auditErr) console.error("change-city: attribution_audit write failed (move already applied)", auditErr);

  return NextResponse.json({ ok: true, canceledSeatCount, attributionOk, newAttribution: await withNames(admin, nextAttribution) });
}
