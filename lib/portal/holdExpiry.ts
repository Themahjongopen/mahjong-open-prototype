// The one place the held-seat TTL lives. A sent invitation holds a seat's
// capacity until it expires; expiry is DERIVED on read from the invite's
// created_at plus this constant — never stored per row — so changing the value
// applies immediately to every outstanding hold, not just new ones.
//
// A change from one hour to two is the single edit below. Making the rule
// conditional later ("one hour, or the table's start time, whichever is sooner")
// is an edit to holdExpiresAt alone — it already receives the table — touching no
// call site.

export const HOLD_TTL_MS = 60 * 60 * 1000; // one hour

// The subset of a table_invites row the hold logic reads.
export type HoldInvite = { status: string; created_at: string };

// A table's start, for the (deferred) start-time cutoff. Accepted now so the
// conditional rule is a one-line change in holdExpiresAt later.
export type HoldTableStart = { table_date?: string | null; table_time?: string | null; timezone?: string | null };

// When a hold lapses. v1: created_at + TTL. The conditional form later:
//   min(created_at + TTL, <table start instant>)
// which is why this takes the table even though it ignores it today.
export function holdExpiresAt(invite: { created_at: string }, _table?: HoldTableStart): Date {
  return new Date(new Date(invite.created_at).getTime() + HOLD_TTL_MS);
}

// A hold counts toward capacity iff it is still 'pending' in the DB AND has not
// lapsed. A pending row past its TTL is logically expired but still 'pending' in
// the row (expiry is never written on read) — this returns false for it, so
// capacity is correct without any write.
export function isHoldActive(invite: HoldInvite, now: number = Date.now(), table?: HoldTableStart): boolean {
  return invite.status === "pending" && now < holdExpiresAt(invite, table).getTime();
}

// The instant before which a 'pending' hold is considered lapsed. Passed to the
// claim_seat / create_hold RPCs (as `now - TTL`) so the one-hour value lives ONLY
// here and is never duplicated in SQL.
export function holdCutoffIso(now: number = Date.now()): string {
  return new Date(now - HOLD_TTL_MS).toISOString();
}
