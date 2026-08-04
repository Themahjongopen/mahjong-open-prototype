// Converts a wall-clock date+time in a given IANA timezone into the correct
// UTC instant, using Intl.DateTimeFormat (no external date library, matching
// this project's existing convention — see lib/format/time.ts).
//
// Table times (league_tables.table_date / table_time) are stored as plain
// wall-clock values at the venue's local time with no zone, so parsing them
// with `new Date("YYYY-MM-DDTHH:MM")` is wrong: the JS spec interprets that as
// the *runtime's* local time (the viewer's phone client-side, UTC on Vercel
// server-side), not the venue's timezone. This resolves them against the venue
// timezone instead.
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm, ss] = timeStr.split(":").map(Number);
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, ss || 0);

  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value]));
  const hour = Number(parts.hour) === 24 ? 0 : Number(parts.hour);
  const asIfUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second));
  const offset = asIfUtc - utcGuess;
  return new Date(utcGuess - offset);
}
