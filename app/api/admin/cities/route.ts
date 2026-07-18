import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensureUniqueCity(supabase: any, name: string, state: string, excludeId?: string) {
  let query = supabase.from("cities").select("id").ilike("name", name).ilike("state", state);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.limit(1);

  if (error) {
    throw error;
  }

  return data?.length ? data[0] : null;
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
    .from("cities")
    .select("id, name, state, slug, is_active, created_at")
    .order("is_active", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Cities could not be loaded." }, { status: 500 });
  }

  return NextResponse.json({ cities: data ?? [] });
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = body?.name?.toString().trim();
  const state = body?.state?.toString().trim();

  if (!name || !state) {
    return NextResponse.json({ error: "Please enter a city name and state." }, { status: 400 });
  }

  const supabase: any = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  try {
    const duplicate = await ensureUniqueCity(supabase, name, state);

    if (duplicate) {
      return NextResponse.json({ error: "That city already exists." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("cities")
      .insert({
        name,
        state,
        slug: slugify(`${name}-${state}`) || "city",
        is_active: true,
      })
      .select("id, name, state, slug, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "City could not be created." }, { status: 500 });
    }

    return NextResponse.json({ city: data });
  } catch (error) {
    console.error("City creation failed", error);
    return NextResponse.json({ error: "City could not be created." }, { status: 500 });
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
    return NextResponse.json({ error: "City id is required." }, { status: 400 });
  }

  const supabase: any = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  try {
    if (action === "toggle") {
      const { data: existingCity, error: fetchError } = await supabase
        .from("cities")
        .select("id, is_active")
        .eq("id", id)
        .single();

      if (fetchError || !existingCity) {
        return NextResponse.json({ error: "City could not be found." }, { status: 404 });
      }

      const { data, error } = await supabase
        .from("cities")
        .update({ is_active: !existingCity.is_active })
        .eq("id", id)
        .select("id, name, state, slug, is_active, created_at")
        .single();

      if (error) {
        return NextResponse.json({ error: "City status could not be updated." }, { status: 500 });
      }

      return NextResponse.json({ city: data });
    }

    const name = body?.name?.toString().trim();
    const state = body?.state?.toString().trim();

    if (!name || !state) {
      return NextResponse.json({ error: "Please enter a city name and state." }, { status: 400 });
    }

    const duplicate = await ensureUniqueCity(supabase, name, state, id);

    if (duplicate) {
      return NextResponse.json({ error: "That city already exists." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("cities")
      .update({
        name,
        state,
        slug: slugify(`${name}-${state}`) || "city",
      })
      .eq("id", id)
      .select("id, name, state, slug, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: "City could not be updated." }, { status: 500 });
    }

    return NextResponse.json({ city: data });
  } catch (error) {
    console.error("City update failed", error);
    return NextResponse.json({ error: "City could not be updated." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = body?.id?.toString();

  if (!id) {
    return NextResponse.json({ error: "City id is required." }, { status: 400 });
  }

  const supabase: any = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ error: "Admin service is unavailable." }, { status: 503 });
  }

  try {
    const { data: reference, error: referenceError } = await supabase
      .from("registrations")
      .select("id")
      .eq("city_id", id)
      .limit(1)
      .maybeSingle();

    if (referenceError) {
      return NextResponse.json({ error: "City could not be checked for registrations." }, { status: 500 });
    }

    if (reference) {
      return NextResponse.json(
        { error: "This city has registrations and can't be deleted. Deactivate it instead to hide it from the form." },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("cities").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: "City could not be deleted." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("City deletion failed", error);
    return NextResponse.json({ error: "City could not be deleted." }, { status: 500 });
  }
}
