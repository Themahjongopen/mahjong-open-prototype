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

  // Multi-city players get their own "viewing city" switcher, driven by the
  // cities they hold paid seats in. Single-city players (the common case) pass a
  // one-entry list, so the app bar renders no switcher.
  const playerCities = session.isAdmin ? [] : session.memberships.map((m) => ({ id: m.city_id, name: m.city_name ?? "Your city" }));
  const activePlayerCity = session.isAdmin ? null : session.memberships.find((m) => m.city_id === session.city_id) ?? null;

  return (
    <PortalShellClient
      userId={session.id}
      userName={session.full_name ?? session.email}
      isAdminRole={session.isAdmin}
      isCommissionerRole={session.isCommissioner}
      commissionerCityId={session.commissionerCityId}
      adminCities={adminCtx?.cities ?? []}
      activeCityId={adminCtx?.cityId ?? null}
      activeCityName={adminCtx?.cityName ?? null}
      playerCities={playerCities}
      playerActiveCityId={session.city_id}
      playerActiveCityName={activePlayerCity?.city_name ?? null}
    >
      {children}
    </PortalShellClient>
  );
}
