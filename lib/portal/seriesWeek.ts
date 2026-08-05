// The series round/week (1–8) a calendar date falls in, or null if the date is
// outside the 8-week window (before the start, or more than 8 weeks after).
// UTC-midnight day math so there's no timezone/DST off-by-one — same approach as
// lib/format/zonedTime.ts. Single source of truth shared by the Create form
// (auto-fill of the round) and the edit route (date-window bounds check).
export function seriesWeekForDate(seriesStartDate: string | null, dateStr: string): number | null {
  if (!seriesStartDate || !dateStr) return null;
  const [sy, sm, sd] = seriesStartDate.split("-").map(Number);
  const [dy, dm, dd] = dateStr.split("-").map(Number);
  if ([sy, sm, sd, dy, dm, dd].some(Number.isNaN)) return null;
  const days = Math.floor((Date.UTC(dy, dm - 1, dd) - Date.UTC(sy, sm - 1, sd)) / 86400000);
  const week = Math.floor(days / 7) + 1;
  return week >= 1 && week <= 8 ? week : null;
}
