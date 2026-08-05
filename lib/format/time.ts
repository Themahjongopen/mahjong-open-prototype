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

export type TimeBucket = "morning" | "afternoon" | "evening";

// Buckets a "HH:MM[:SS]" table_time into a coarse time-of-day band for the
// Tables page filter: Morning = before 12:00 PM, Afternoon = 12:00 PM–5:00 PM,
// Evening = 5:00 PM and later. Boundaries land on whole hours (12:00, 17:00) so
// bucketing on the hour is exact — 11:59 -> morning, 12:00 -> afternoon,
// 17:00 -> evening. Returns null for a null/unparseable time so callers can
// decide how an untimed table participates in a time filter.
export function timeOfDayBucket(time: string | null | undefined): TimeBucket | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

// Day-of-week index (0 = Sunday … 6 = Saturday) for a plain "YYYY-MM-DD" table
// date. Parses the components and builds the date in UTC rather than passing the
// string to `new Date(...)`, which would parse it as local midnight and can shift
// the weekday by a day in negative-offset zones (the same timezone trap that bit
// the table-time work on 2026-08-04). So "2026-08-17" is Monday everywhere.
export function tableWeekdayIndex(date: string | null | undefined): number | null {
  if (!date) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
}
