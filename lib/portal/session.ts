import { cache } from "react";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export type PortalMember = {
  status: "active";
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  isCommissioner: boolean;
  isAdmin: boolean;
  city_id: string | null;
  series_id: string | null;
};

// Authenticated but no paid registration (unpaid / unknown email) -> "register first".
export type PortalPending = { status: "unpaid"; email: string };
export type PortalSession = PortalMember | PortalPending | null;

// Resolves the current portal user from the Supabase session, then loads their
// profile + paid membership via the service-role client (profiles/registrations
// are RLS-locked to service-role). Memoized per render pass.
export const getPortalUser = cache(async (): Promise<PortalSession> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin: any = createAdminClient();
  if (!admin) {
    // Supabase unconfigured (local preview): treat the session as pending.
    return { status: "unpaid", email: user.email ?? "" };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  // Latest paid registration for this account = active membership.
  const { data: membership } = await admin
    .from("registrations")
    .select("city_id, series_id, paid_status, created_at")
    .eq("profile_id", user.id)
    .eq("paid_status", "paid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const role = profile?.role ?? "player";
  const isAdmin = role === "admin";

  // Admins always get in; everyone else needs a paid registration.
  if (!membership && !isAdmin) {
    return { status: "unpaid", email: user.email ?? profile?.email ?? "" };
  }

  return {
    status: "active",
    id: user.id,
    full_name: profile?.full_name ?? null,
    email: user.email ?? profile?.email ?? "",
    role,
    isCommissioner: role === "commissioner",
    isAdmin,
    city_id: membership?.city_id ?? null,
    series_id: membership?.series_id ?? null,
  };
});
