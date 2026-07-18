import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server component — cookie mutations ignored
          }
        },
      },
    }
  );
}

/** Admin client using service role — never call from client components */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createSupabaseClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type AuthUserSummary = { id: string; last_sign_in_at: string | null };

/**
 * List every Supabase Auth user, keyed by lowercased email. Service-role only.
 * Used to derive portal invite state (invited-but-not-accepted vs. active) for
 * the admin Registrations page, since last_sign_in_at isn't exposed via PostgREST.
 * Pages through all users so it stays correct beyond the default page size.
 */
export async function listAuthUsersByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Map<string, AuthUserSummary>> {
  const byEmail = new Map<string, AuthUserSummary>();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    const users: Array<{ id: string; email?: string | null; last_sign_in_at?: string | null }> =
      data?.users ?? [];
    if (error || users.length === 0) break;
    for (const u of users) {
      if (u.email) {
        byEmail.set(u.email.toLowerCase(), { id: u.id, last_sign_in_at: u.last_sign_in_at ?? null });
      }
    }
    if (users.length < perPage) break;
  }
  return byEmail;
}
