import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { sendTableInviteDeclinedEmail } from "@/lib/email/tableInviteDeclinedEmail";

export const runtime = "nodejs";

// Release a held seat: the invitee declines, OR the host/inviter releases it early.
// Backed by the release_hold RPC (migration 044), which flips the pending invite to
// 'declined', bumps league_tables.updated_at (so Open Tables refetches the reopened
// seat), and returns the inviter for the decline email.
//
// Notification asymmetry, by design:
//   * invitee declines  -> email the INVITER ("who declined, seat's open again")
//   * host/inviter self-releases -> no email (they did it)
//   * a hold LAPSING (TTL) -> silent (expiry is read-derived, no write to hang an
//     email on, and no scheduled job — see holdExpiry.ts)
export async function DELETE(_request: Request, context: { params: Promise<{ id: string; profileId: string }> }) {
  const { id, profileId } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Unavailable right now." }, { status: 503 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, creator_id, table_date, table_time, location_name, round_type")
    .eq("id", id)
    .maybeSingle();
  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }

  // The live hold being released — needed both to 404 cleanly and to authorize by
  // its inviter.
  const { data: invite } = await admin
    .from("table_invites")
    .select("id, invited_by_profile_id")
    .eq("table_id", id)
    .eq("invited_profile_id", profileId)
    .eq("status", "pending")
    .maybeSingle();
  if (!invite) {
    return NextResponse.json({ error: "There's no pending invitation to release." }, { status: 404 });
  }

  // Authorized: the invitee themselves, the table's host, the original inviter, or
  // an admin. Nobody else can release another player's hold.
  const isDecline = session.id === profileId;
  const authorized =
    isDecline ||
    session.isAdmin ||
    session.id === table.creator_id ||
    session.id === invite.invited_by_profile_id;
  if (!authorized) {
    return NextResponse.json({ error: "You can't release this invitation." }, { status: 403 });
  }

  const { data: released, error: releaseError } = await admin.rpc("release_hold", {
    p_table_id: id,
    p_invited_profile_id: profileId,
  });
  if (releaseError || !released?.ok) {
    return NextResponse.json({ error: "The invitation couldn't be released." }, { status: 500 });
  }
  if (!released.released) {
    // Lost a race to another release/accept — nothing pending anymore. Not an error.
    return NextResponse.json({ ok: true, released: 0 });
  }

  // Email the inviter ONLY on an invitee-initiated decline (never a self-release).
  // Best-effort: the release already committed and must not be rolled back.
  if (isDecline && released.invited_by_profile_id) {
    try {
      const { data: people } = await admin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", [released.invited_by_profile_id, profileId]);
      const inviter = (people ?? []).find((p: any) => p.id === released.invited_by_profile_id);
      const decliner = (people ?? []).find((p: any) => p.id === profileId);
      if (inviter?.email) {
        const res = await sendTableInviteDeclinedEmail(
          { email: inviter.email, fullName: inviter.full_name },
          {
            tableId: id,
            declinerName: decliner?.full_name ?? null,
            tableDate: table.table_date,
            tableTime: table.table_time,
            locationName: table.location_name,
            roundType: table.round_type,
          }
        );
        if (!res.ok) console.error("tableInviteDeclinedEmail not sent", inviter.email, res.error);
      }
    } catch (err) {
      console.error("tableInviteDeclinedEmail send failed", err);
    }
  }

  return NextResponse.json({ ok: true, released: 1 });
}
