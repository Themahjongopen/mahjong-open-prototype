import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";

// Columns returned to the admin Series page. Matches the live `series` table
// from migration 003 (league-wide series — no city, no quarter/year).
const SERIES_COLUMNS =
  "id, name, starts_at, ends_at, registration_closes_at, total_weeks, price_cents, is_active, created_at";

// The `name` column is UNIQUE. Guard case-insensitively before writing so the
// admin gets a friendly 409 instead of a raw Postgres constraint error.
async function findDuplicateName(supabase: any, name: string, excludeId?: string) {
  let query = supabase.from("series").select("id").ilike("name", name);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw error;
  }

  return data?.length ? data[0] : null;
}

// Normalize + validate the writable series fields shared by create and update.
// Returns { values } on success or { error } with a user-facing message.
function parseSeriesBody(body: any) {
  const name = body?.name?.toString().trim();
  const startsAt = body?.starts_at?.toString().trim();
  const endsAt = body?.ends_at?.toString().trim();
  const registrationClosesRaw = body?.registration_closes_at?.toString().trim();

  if (!name) {
    return { ok: false as const, error: "Please enter a series name." };
  }
  if (!startsAt || !endsAt) {
    return { ok: false as const, error: "Please set both a start and end date." };
  }
  if (endsAt < startsAt) {
    return { ok: false as const, error: "The end date can't be before the start date." };
  }

  // total_weeks: NOT NULL, defaults to 8 in the schema.
  let totalWeeks = 8;
  if (body?.total_weeks !== undefined && body?.total_weeks !== null && body?.total_weeks !== "") {
    totalWeeks = Number.parseInt(body.total_weeks.toString(), 10);
    if (!Number.isInteger(totalWeeks) || totalWeeks < 1) {
      return { ok: false as const, error: "Total weeks must be a whole number of 1 or more." };
    }
  }

  // price_cents: NOT NULL integer. The client sends whole cents.
  const priceCents = Number.parseInt(body?.price_cents?.toString() ?? "", 10);
  if (!Number.isInteger(priceCents) || priceCents < 0) {
    return { ok: false as const, error: "Please enter a valid price." };
  }

  return {
    ok: true as const,
    values: {
      name,
      starts_at: startsAt,
      ends_at: endsAt,
      registration_closes_at: registrationClosesRaw || null,
      total_weeks: totalWeeks,
      price_cents: priceCents,
    },
  };
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase: any = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("series")
    .select(SERIES_COLUMNS)
    .order("is_active", { ascending: false })
    .order("starts_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Series could not be loaded." }, { status: 500 });
  }

  return NextResponse.json({ series: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseSeriesBody(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const supabase: any = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  try {
    const duplicate = await findDuplicateName(supabase, parsed.values.name);

    if (duplicate) {
      return NextResponse.json({ error: "A series with that name already exists." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("series")
      .insert({ ...parsed.values, is_active: true })
      .select(SERIES_COLUMNS)
      .single();

    if (error) {
      return NextResponse.json({ error: "Series could not be created." }, { status: 500 });
    }

    return NextResponse.json({ series: data });
  } catch (error) {
    console.error("Series creation failed", error);
    return NextResponse.json({ error: "Series could not be created." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id?.toString();
  const action = body?.action?.toString();

  if (!id) {
    return NextResponse.json({ error: "Series id is required." }, { status: 400 });
  }

  const supabase: any = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  try {
    if (action === "toggle") {
      const { data: existing, error: fetchError } = await supabase
        .from("series")
        .select("id, is_active")
        .eq("id", id)
        .single();

      if (fetchError || !existing) {
        return NextResponse.json({ error: "Series could not be found." }, { status: 404 });
      }

      const { data, error } = await supabase
        .from("series")
        .update({ is_active: !existing.is_active })
        .eq("id", id)
        .select(SERIES_COLUMNS)
        .single();

      if (error) {
        return NextResponse.json({ error: "Series status could not be updated." }, { status: 500 });
      }

      return NextResponse.json({ series: data });
    }

    const parsed = parseSeriesBody(body);

    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const duplicate = await findDuplicateName(supabase, parsed.values.name, id);

    if (duplicate) {
      return NextResponse.json({ error: "A series with that name already exists." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("series")
      .update(parsed.values)
      .eq("id", id)
      .select(SERIES_COLUMNS)
      .single();

    if (error) {
      return NextResponse.json({ error: "Series could not be updated." }, { status: 500 });
    }

    return NextResponse.json({ series: data });
  } catch (error) {
    console.error("Series update failed", error);
    return NextResponse.json({ error: "Series could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id?.toString();

  if (!id) {
    return NextResponse.json({ error: "Series id is required." }, { status: 400 });
  }

  const supabase: any = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  try {
    // A series is referenced by registrations, and (via migration 006)
    // league_tables and standings — all ON DELETE CASCADE. Deleting a series
    // in use would silently wipe that data, so block it and steer the admin
    // to deactivate instead. Only truly unused series delete cleanly.
    const dependents: Array<{ table: string; column: string }> = [
      { table: "registrations", column: "series_id" },
      { table: "league_tables", column: "series_id" },
      { table: "standings", column: "series_id" },
    ];

    for (const dependent of dependents) {
      const { data: reference, error: referenceError } = await supabase
        .from(dependent.table)
        .select("id")
        .eq(dependent.column, id)
        .limit(1)
        .maybeSingle();

      if (referenceError) {
        return NextResponse.json({ error: "Series could not be checked for existing data." }, { status: 500 });
      }

      if (reference) {
        return NextResponse.json(
          {
            error:
              "This series has registrations or league data and can't be deleted. Deactivate it instead to hide it from the registration form.",
          },
          { status: 409 }
        );
      }
    }

    const { error } = await supabase.from("series").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Series could not be deleted." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Series deletion failed", error);
    return NextResponse.json({ error: "Series could not be deleted." }, { status: 500 });
  }
}
