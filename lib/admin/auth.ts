import { getPortalUser } from "@/lib/portal/session";

// Phase 2 admin gate: admins sign in through the portal (Supabase auth) and are
// authorized by profiles.role = 'admin'. Used by every admin API route in place
// of the retired passcode cookie.
export async function isAdminRequest(): Promise<boolean> {
  const session = await getPortalUser();
  return !!session && session.status === "active" && session.isAdmin;
}
