import { getPortalUser } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getCityName, getSeriesStartDate } from "@/lib/portal/tables";
import CreateTableForm from "./CreateTableForm";

export default async function CreateTablePage() {
  const session = await getPortalUser();
  // Admins have no home city; withAdminCity reads their active-city selection.
  const member = session && session.status === "active" ? await withAdminCity(session) : null;
  const [cityName, seriesStartDate] = member
    ? await Promise.all([getCityName(member.city_id), getSeriesStartDate(member.series_id)])
    : [null, null];

  return <CreateTableForm cityName={cityName} seriesStartDate={seriesStartDate} />;
}
