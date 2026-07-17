import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";

// Cancel a table (creator or admin only). Seats are left intact; status drives
// display everywhere.
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (body?.action !== "cancel") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const admin: any = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Tables are unavailable right now." }, { status: 503 });
  }

  const { data: table } = await admin
    .from("league_tables")
    .select("id, creator_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!table) {
    return NextResponse.json({ error: "That table no longer exists." }, { status: 404 });
  }
  if (table.creator_id !== session.id && !session.isAdmin) {
    return NextResponse.json({ error: "Only the table creator can cancel this table." }, { status: 403 });
  }
  if (table.status === "canceled") {
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin.from("league_tables").update({ status: "canceled" }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: "The table couldn't be cancelled. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
