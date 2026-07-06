import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./types";

// Refreshes the Supabase auth session on each request and reports the current
// user. Runs inside `proxy.ts` (Next's renamed middleware), so it must use the
// NextRequest/NextResponse cookie stores — not `next/headers`. Returns the
// response carrying refreshed auth cookies; any redirect the proxy issues must
// copy these cookies over so the refreshed session isn't dropped.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No Supabase configured (local preview) — treat as unauthenticated, no-op.
  if (!supabaseUrl || !anonKey) {
    return { response, user: null };
  }

  const supabase = createServerClient<Database>(supabaseUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() revalidates the token with the Auth server and triggers cookie refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
