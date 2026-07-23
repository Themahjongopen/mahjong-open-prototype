import { redirect } from "next/navigation";
import PortalShellClient from "@/components/portal/PortalShellClient";
import RegisterFirstScreen from "@/components/portal/RegisterFirstScreen";
import { getPortalUser } from "@/lib/portal/session";
import { getAdminContext } from "@/lib/portal/adminCity";

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

  // Admins pick which city they're acting in (they have no home city); the
  // switcher in the app bar sets a cookie this reads.
  const adminCtx = session.isAdmin ? await getAdminContext() : null;

  return (
    <PortalShellClient
      userName={session.full_name ?? session.email}
      isAdminRole={session.isAdmin}
      adminCities={adminCtx?.cities ?? []}
      activeCityId={adminCtx?.cityId ?? null}
      activeCityName={adminCtx?.cityName ?? null}
    >
      {children}
    </PortalShellClient>
  );
}
