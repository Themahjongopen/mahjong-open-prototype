import { redirect } from "next/navigation";
import PortalShellClient from "@/components/portal/PortalShellClient";
import RegisterFirstScreen from "@/components/portal/RegisterFirstScreen";
import { getPortalUser } from "@/lib/portal/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalUser();

  // Not signed in — proxy normally catches this, but guard here too.
  if (!session) {
    redirect("/portal/login");
  }

  // Signed in but no paid registration.
  if (session.status === "unpaid") {
    return <RegisterFirstScreen email={session.email} />;
  }

  return (
    <PortalShellClient
      userName={session.full_name ?? session.email}
      isAdminRole={session.isAdmin}
    >
      {children}
    </PortalShellClient>
  );
}
