import { getPortalUser } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getCityName, getSeriesStartDate, getSeriesEndDate } from "@/lib/portal/tables";
import CreateTableForm from "./CreateTableForm";

export default async function CreateTablePage() {
  const session = await getPortalUser();
  // Admins have no home city; withAdminCity reads their active-city selection.
  const member = session && session.status === "active" ? await withAdminCity(session) : null;
  const [cityName, seriesStartDate, seriesEndDate] = member
    ? await Promise.all([getCityName(member.city_id), getSeriesStartDate(member.series_id), getSeriesEndDate(member.series_id)])
    : [null, null, null];

  return <CreateTableForm cityId={member?.city_id ?? null} cityName={cityName} seriesStartDate={seriesStartDate} seriesEndDate={seriesEndDate} isAdmin={member?.isAdmin ?? false} />;
}
