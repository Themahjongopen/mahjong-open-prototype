import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getPortalUser } from "@/lib/portal/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalUser();

  // Middleware guarantees a session for /admin; enforce the admin role here.
  if (!session) {
    redirect("/portal/login");
  }
  if (session.status !== "active" || !session.isAdmin) {
    redirect("/portal");
  }

  return <AdminShell adminName={session.full_name ?? session.email}>{children}</AdminShell>;
}
