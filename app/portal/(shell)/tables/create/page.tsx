import { getPortalUser } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getCityName } from "@/lib/portal/tables";
import CreateTableForm from "./CreateTableForm";

export default async function CreateTablePage() {
  const session = await getPortalUser();
  // Admins have no home city; withAdminCity reads their active-city selection.
  const member = session && session.status === "active" ? await withAdminCity(session) : null;
  const cityName = member ? await getCityName(member.city_id) : null;

  return <CreateTableForm cityName={cityName} />;
}
