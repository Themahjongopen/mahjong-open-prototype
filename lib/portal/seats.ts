// Pure, environment-agnostic seat shapes + helpers. Deliberately free of any
// server-only imports (no createAdminClient / next/headers) so client components
// like TableDetailClient can call scoringSeats() without dragging server code
// into the browser bundle. Server data-access lives in ./tables, which re-exports
// everything here so existing "@/lib/portal/tables" imports keep working.

import { zonedTimeToUtc } from "@/lib/format/zonedTime";
import { isHoldActive, type HoldInvite, type HoldTableStart } from "@/lib/portal/holdExpiry";

// Fallback venue timezone (majority zone) when a city has no timezone set —
// e.g. an old/demo row not yet backfilled by migration 024.
const DEFAULT_TIMEZONE = "America/Chicago";

export type SeatRow = {
  id: string;
  user_id: string;
  seat_number: number;
  canceled_at: string | null;
  profiles?: { full_name: string | null; avatar_url: string | null; skill_level?: string | null } | null;
};

export type LeagueTable = {
  id: string;
  city_id: string;
  series_id: string;
  creator_id: string;
  week_number: number;
  table_date: string;
  table_time: string | null;
  timezone: string | null; // IANA name of the venue's local time (cities.timezone)
  location_name: string;
  location_address: string | null;
  area: string | null; // free-text "part of town" (nullable; pre-area tables are null)
  skill_level: string | null;
  round_type: string | null;
  notes: string | null;
  status: string;
  table_seats: SeatRow[];
};

export const activeSeats = (seats: SeatRow[]) => seats.filter((s) => !s.canceled_at);

// A seat counts toward the required 4 if it's still actively held, OR its most
// recent occupant cancelled within 24h of the table's scheduled time and nobody
// re-claimed that seat number since. The latter is forced to a no-show at score
// time (see scores.ts / api/scores). Returns active seats and late-cancellation
// seats separately so callers can total them (`active.length + lateCancellations.length`)
// or treat them differently (score entry needs to flag which is which).
export function scoringSeats(table: Pick<LeagueTable, "table_date" | "table_time" | "timezone" | "table_seats">): { active: SeatRow[]; lateCancellations: SeatRow[] } {
  const active = activeSeats(table.table_seats);
  const activeSeatNumbers = new Set(active.map((s) => s.seat_number));
  // Resolve the venue-local start time to a real UTC instant so the 24h cutoff
  // is correct regardless of where this runs (server = UTC). See zonedTimeToUtc.
  const cutoff = zonedTimeToUtc(table.table_date, table.table_time ?? "12:00:00", table.timezone ?? DEFAULT_TIMEZONE).getTime() - 24 * 60 * 60 * 1000;

  const lateCancellations: SeatRow[] = [];
  const bySeatNumber = new Map<number, SeatRow>(); // most recent cancellation per seat_number
  for (const s of table.table_seats) {
    if (activeSeatNumbers.has(s.seat_number) || !s.canceled_at) continue;
    const existing = bySeatNumber.get(s.seat_number);
    if (!existing || s.canceled_at > existing.canceled_at!) bySeatNumber.set(s.seat_number, s);
  }
  for (const seat of bySeatNumber.values()) {
    if (new Date(seat.canceled_at!).getTime() >= cutoff) lateCancellations.push(seat);
  }
  return { active, lateCancellations };
}

// ---- Held-seat capacity (migration 044) ------------------------------------
// A held seat is a 'pending' table_invites row, NOT a table_seats row — so it
// never reaches activeSeats/scoringSeats above and can never be counted as a
// player in no-show or score entry. These helpers derive capacity as
// "active seats + unexpired holds" for the join gate, the open-seat count, and
// the "N seated · M held" display. Pure (no server imports) so client components
// and API routes share one definition.

// The subset of a table_invites row capacity math reads.
export type HoldRow = HoldInvite & { invited_profile_id: string };

// Holds that currently count toward capacity: still pending and not past the TTL.
export function activeHolds(holds: HoldRow[], now: number = Date.now(), table?: HoldTableStart): HoldRow[] {
  return holds.filter((h) => isHoldActive(h, now, table));
}

// Seats filled for capacity purposes: real active seats PLUS unexpired holds,
// with a hold for someone already seated dropped so accepting an invite (which
// creates a real seat while their own hold may briefly linger) never
// double-counts one person.
export function capacityFilled(
  seats: SeatRow[],
  holds: HoldRow[],
  now: number = Date.now(),
  table?: HoldTableStart
): number {
  const seated = activeSeats(seats);
  const seatedIds = new Set(seated.map((s) => s.user_id));
  const heldCounted = activeHolds(holds, now, table).filter((h) => !seatedIds.has(h.invited_profile_id));
  return seated.length + heldCounted.length;
}
