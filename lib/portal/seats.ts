// Pure, environment-agnostic seat shapes + helpers. Deliberately free of any
// server-only imports (no createAdminClient / next/headers) so client components
// like TableDetailClient can call scoringSeats() without dragging server code
// into the browser bundle. Server data-access lives in ./tables, which re-exports
// everything here so existing "@/lib/portal/tables" imports keep working.

import { zonedTimeToUtc } from "@/lib/format/zonedTime";

// Fallback venue timezone (majority zone) when a city has no timezone set —
// e.g. an old/demo row not yet backfilled by migration 024.
const DEFAULT_TIMEZONE = "America/Chicago";

export type SeatRow = {
  id: string;
  user_id: string;
  seat_number: number;
  canceled_at: string | null;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
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
