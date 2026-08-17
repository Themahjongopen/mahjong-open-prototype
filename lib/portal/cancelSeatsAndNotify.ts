import { sendTableUnderfilledEmail } from "@/lib/email/tableUnderfilledEmail";

// Shared: cancel a set of seats, reopen any table that drops out of 'full', and
// notify the REMAINING players on the exact 4→3 active-player transition ("a seat
// opened on your table"). Extracted verbatim from the self-serve seat cancel
// (app/api/tables/[id]/seats/cancel) and the admin change-city move — the admin
// refund is the third caller. All three remove a player from a table and must
// leave the others informed and the table joinable again.
//
// The 4→3 gate matches the self-serve original: fire ONLY when a table goes from
// four active players to three, so an already-short table isn't re-spammed.
// excludeProfileId (the player being removed) is left OUT of the recipients.
// Underfilled sends are best-effort and fully wrapped — a send never blocks the
// cancel — and unconditional (not preference-gated), same as before.
//
// Returns the number of seats actually cancelled and the seat-update error (if
// any) so a caller for whom the cancel is the PRIMARY action (self-serve) can
// surface a 500, while side-effect callers (change-city, refund) can ignore it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

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

  // Notify remaining players on the exact 4→3 transition. Best-effort, wrapped.
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
              activeCount: activeAfter,
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
