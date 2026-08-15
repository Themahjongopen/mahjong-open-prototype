import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// Admin-only: manually set a registration's attribution set — one commissioner at
// weight 1.0, or a split across several summing to 1.0. Writes source='manual' and
// an attribution_audit row (full prior + new sets) on every change. Weights that
// don't sum to 1.0 are REJECTED — a silently mis-summed split produces wrong money.
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getPortalUser();
  if (!session || session.status !== "active" || !session.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });

  const body = await request.json().catch(() => null);
  const raw = Array.isArray(body?.attributions) ? body.attributions : null;
  if (!raw || raw.length === 0) {
    return NextResponse.json({ error: "At least one attribution is required." }, { status: 400 });
  }

  // Normalize + validate entries.
  const entries: Array<{ commissioner_profile_id: string | null; weight: number }> = [];
  for (const e of raw) {
    const cid = e?.commissioner_profile_id ?? null;
    const w = Number(e?.weight);
    if (!Number.isFinite(w) || w <= 0) {
      return NextResponse.json({ error: "Every weight must be a positive number." }, { status: 400 });
    }
    entries.push({ commissioner_profile_id: cid === null ? null : String(cid), weight: Math.round(w * 10000) / 10000 });
  }
  // Distinct non-null commissioners.
  const nonNull = entries.map((e) => e.commissioner_profile_id).filter(Boolean) as string[];
  if (new Set(nonNull).size !== nonNull.length) {
    return NextResponse.json({ error: "The same commissioner appears more than once." }, { status: 400 });
  }
  // Weights must sum to 1.0 (tolerance covers even splits like 0.3333×3 = 0.9999).
  const sum = entries.reduce((s, e) => s + e.weight, 0);
  if (Math.abs(sum - 1) > 0.001) {
    return NextResponse.json({ error: `Weights must sum to 1.0 (they sum to ${sum.toFixed(4)}).` }, { status: 400 });
  }

  // Registration must exist.
  const { data: reg } = await admin.from("registrations").select("id").eq("id", id).maybeSingle();
  if (!reg) return NextResponse.json({ error: "Registration not found." }, { status: 404 });

  // Any named commissioners must be real profiles.
  if (nonNull.length) {
    const { data: profs } = await admin.from("profiles").select("id").in("id", nonNull);
    const found = new Set((profs ?? []).map((p: any) => p.id));
    const missing = nonNull.filter((pid) => !found.has(pid));
    if (missing.length) return NextResponse.json({ error: "One or more commissioners don't exist." }, { status: 400 });
  }

  // Capture the FULL prior set for the audit trail.
  const { data: previous } = await admin
    .from("registration_attributions")
    .select("commissioner_profile_id, weight, source")
    .eq("registration_id", id);

  // Replace: delete old, insert new (source='manual'). No PostgREST transaction, so
  // this is delete-then-insert; an admin can retry if the insert half fails.
  const { error: delErr } = await admin.from("registration_attributions").delete().eq("registration_id", id);
  if (delErr) return NextResponse.json({ error: "Could not update attribution." }, { status: 500 });

  const nextRows = entries.map((e) => ({ registration_id: id, commissioner_profile_id: e.commissioner_profile_id, weight: e.weight, source: "manual" }));
  const { error: insErr } = await admin.from("registration_attributions").insert(nextRows);
  if (insErr) return NextResponse.json({ error: "Could not write the new attribution." }, { status: 500 });

  // Audit — full prior + new sets, who changed it.
  const { error: auditErr } = await admin.from("attribution_audit").insert({
    registration_id: id,
    changed_by_profile_id: session.id,
    previous: previous ?? [],
    next: entries.map((e) => ({ commissioner_profile_id: e.commissioner_profile_id, weight: e.weight, source: "manual" })),
  });
  if (auditErr) console.error("attribution_audit write failed (attribution change already applied)", auditErr);

  return NextResponse.json({ ok: true, attributions: entries });
}
