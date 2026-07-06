import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Landing route for Supabase invite / password-recovery emails. The email
// templates point their action link here as:
//   /portal/auth/callback?token_hash=...&type=invite&next=/portal/set-password
// We verify the one-time token to establish a session, then forward to `next`.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const rawNext = url.searchParams.get("next") ?? "/portal";
  // Only allow internal relative redirects.
  const next = rawNext.startsWith("/") ? rawNext : "/portal";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/portal/login?error=link_invalid", url.origin));
}
