// Formats a Postgres "time" string ("HH:MM" or "HH:MM:SS") as 12-hour
// clock time with AM/PM, e.g. "18:30:00" -> "6:30 PM", "09:00" -> "9:00 AM".
// Returns null for null/empty/unparseable input so call sites can keep
// their existing `table.table_time ? ... : null` guards unchanged.
export function formatTableTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = match[2];
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
}
