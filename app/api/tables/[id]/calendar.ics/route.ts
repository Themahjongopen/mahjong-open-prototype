import { getPortalUser } from "@/lib/portal/session";
import { createAdminClient } from "@/lib/supabase/server";
import { zonedTimeToUtc } from "@/lib/format/zonedTime";

// Server-generated .ics for a table's calendar event. Built server-side (instead
// of the old client `data:text/calendar` + <a download>, which iOS Safari
// handles unreliably) and — crucially — resolves the venue-local start time to a
// real UTC instant via the city's timezone, so the event lands at the correct
// wall-clock time regardless of the viewer's device timezone.

const DEFAULT_TIMEZONE = "America/Chicago";

function toUtcStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await getPortalUser();
  if (!session || session.status !== "active") {
    return new Response("Please sign in.", { status: 401 });
  }

  const admin: any = createAdminClient();
  if (!admin) return new Response("Unavailable.", { status: 503 });

  const { data: table } = await admin
    .from("league_tables")
    .select("id, table_date, table_time, location_name, location_address, skill_level, cities(timezone)")
    .eq("id", id)
    .maybeSingle();

  if (!table) return new Response("That table no longer exists.", { status: 404 });

  const city = Array.isArray(table.cities) ? table.cities[0] : table.cities;
  const start = zonedTimeToUtc(table.table_date, table.table_time ?? "12:00:00", city?.timezone ?? DEFAULT_TIMEZONE);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Mahjong Open//EN",
    "BEGIN:VEVENT",
    `UID:${table.id}@themahjongopen.com`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:The Mahjong Open table at ${table.location_name}`,
    `DESCRIPTION:Skill level: ${table.skill_level ?? "Open"}\\nLocation: ${table.location_name}${table.location_address ? `\\n${table.location_address}` : ""}`,
    `LOCATION:${table.location_address ?? table.location_name}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="mahjong-table-${table.id}.ics"`,
    },
  });
}
