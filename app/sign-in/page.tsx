import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// The marketing site has no public sign-in. /sign-in exists only to bounce
// visitors back to the marketing homepage — EXCEPT admins: during Phase 1 an
// authenticated admin is sent to the admin console instead. Members still sign
// in through the player portal at /portal/login, which is untouched.
export default async function SignInRedirect() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // profiles is RLS-locked to service-role, so read the role with the admin
    // (service-role) client — the SSR anon client would see no rows.
    const admin: any = createAdminClient();
    if (admin) {
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "admin") {
        redirect("/admin");
      }
    }
  }

  redirect("/");
}
