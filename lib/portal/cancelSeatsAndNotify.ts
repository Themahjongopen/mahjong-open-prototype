import { sendTableUnderfilledEmail } from "@/lib/email/tableUnderfilledEmail";
import { zonedTimeToUtc } from "@/lib/format/zonedTime";

// Shared: cancel a set of seats, reopen any table that drops out of 'full', and
// notify the REMAINING players when a seat opens. Used by all four seat-removing
// paths (self-serve leave-seat, admin change-city, admin refund, admin
// remove-seat) so they stay in lockstep.
//
// Notify triggers (OR, deduplicated to one email per recipient):
//   * a 4→3 drop (a full table losing a player — the long-standing default), OR
//   * ANY active-seat decrease when the table starts within the next 24h
//     (a late drop is urgent whether the table was at 4 or 3, and notifying can
//     prevent the −20 no-show that stands only when the open seat is never
//     re-filled).
// Suppressed when: the table already started (hoursUntil ≤ 0), it's completed or
// canceled, no one is left to notify, or the cancel didn't actually reduce the
// count. excludeProfileId (the departing player) is always left out. Sends are
// best-effort/wrapped — a send never blocks the cancel — and unconditional.
//
// Returns the number of seats actually cancelled and the seat-update error (if
// any) so a caller for whom the cancel is the PRIMARY action (self-serve) can
// surface a 500, while side-effect callers (change-city, refund) can ignore it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

// Hours until a table's local start time, or null if it can't be computed. The
// ONLY place table_date + table_time are combined. Both are naive wall-clock
// values (no zone) at the venue's local time, so they're anchored to the city's
// IANA timezone (cities.timezone). Active cities today span BOTH Central and
// Eastern, so this must use the row's own zone, not a constant — America/Chicago
// is only a defensive fallback for a column that is NOT NULL and shouldn't ever
// be blank (revisit if a series launches outside the US). Never throws; returns
// null on missing/malformed data, and callers treat null as "not imminent".
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hoursUntilTablePlays(table: any): number | null {
  if (!table?.table_date || !table?.table_time) return null;
  const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
  const tz = city?.timezone || "America/Chicago";
  const instant = zonedTimeToUtc(table.table_date, table.table_time, tz);
  if (Number.isNaN(instant.getTime())) return null;
  return (instant.getTime() - Date.now()) / (1000 * 60 * 60);
}

export async function cancelSeatsAndNotify(
  admin: Admin,
  seatIds: string[],
  excludeProfileId: string | null
): Promise<{ canceledCount: number; cancelError: unknown }> {
  if (!seatIds.length) return { canceledCount: 0, cancelError: null };

  const { data: canceled, error: cancelError } = await admin
    .from("table_seats")
    .update({ canceled_at: new Date().toISOString() })
    .in("id", seatIds)
    .is("canceled_at", null)
    .select("id, table_id");
  if (cancelError) {
    console.error("cancelSeatsAndNotify: seat cancellation failed", cancelError);
    return { canceledCount: 0, cancelError };
  }

  const canceledCount = (canceled ?? []).length;
  const tableIds = [...new Set((canceled ?? []).map((s: any) => s.table_id))] as string[];
  if (!tableIds.length) return { canceledCount, cancelError: null };

  // A full table that just lost a seat is open again.
  const { error: reopenErr } = await admin.from("league_tables").update({ status: "open" }).in("id", tableIds).eq("status", "full");
  if (reopenErr) console.error("cancelSeatsAndNotify: reopen full tables failed", reopenErr);

  // Notify remaining players when a seat opens — 4→3 always, or ANY decrease when
  // the table is within 24h. Best-effort, wrapped.
  try {
    const { data: affected } = await admin
      .from("league_tables")
      .select("id, status, table_date, table_time, location_name, location_address, round_type, cities(timezone), table_seats(user_id, canceled_at)")
      .in("id", tableIds);
    for (const t of (affected ?? []) as any[]) {
      const nextActive = (t.table_seats ?? []).filter((s: any) => !s.canceled_at).length;
      // Each row in `canceled` was active before (the .is("canceled_at", null)
      // guard on the update), so the count we just cancelled on THIS table
      // reconstructs the pre-cancel active count.
      const canceledHere = (canceled ?? []).filter((c: any) => c.table_id === t.id).length;
      const prevActive = nextActive + canceledHere;

      const hoursUntil = hoursUntilTablePlays(t);
      const started = hoursUntil !== null && hoursUntil <= 0; // start time already passed
      const isImminent = hoursUntil !== null && hoursUntil > 0 && hoursUntil <= 24;
      const droppedFromFull = prevActive === 4 && nextActive === 3;
      const reduced = nextActive < prevActive;
      // Trigger = 4→3 OR any decrease within 24h — but never after the table has
      // started, on a completed/canceled table, or with no one left to notify.
      // A single send loop → a 4→3-within-24h drop sends exactly one email each.
      const shouldNotify =
        t.status !== "completed" && t.status !== "canceled" &&
        nextActive > 0 && reduced && !started &&
        (droppedFromFull || (isImminent && reduced));

      if (!shouldNotify) continue;

      const remainingIds = [
        ...new Set(
          (t.table_seats ?? [])
            .filter((s: any) => !s.canceled_at && s.user_id && s.user_id !== excludeProfileId)
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
              activeCount: nextActive,
              imminent: isImminent,
            }
          );
          if (!res.ok) console.error("underfilled email not sent", p.email, res.error);
        } catch (err) {
          console.error("underfilled email send failed", p.email, err);
        }
      }
    }
  } catch (err) {
    console.error("cancelSeatsAndNotify underfilled batch failed", err);
  }

  return { canceledCount, cancelError: null };
}
