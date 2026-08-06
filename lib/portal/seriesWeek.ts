// The series round/week (1–8) a calendar date falls in, or null if the date is
// outside the 8-week window (before the start, or more than 8 weeks after).
// UTC-midnight day math so there's no timezone/DST off-by-one — same approach as
// lib/format/zonedTime.ts. Single source of truth for the create/edit table API
// routes' date-window bounds check.
export function seriesWeekForDate(seriesStartDate: string | null, dateStr: string): number | null {
  if (!seriesStartDate || !dateStr) return null;
  const [sy, sm, sd] = seriesStartDate.split("-").map(Number);
  const [dy, dm, dd] = dateStr.split("-").map(Number);
  if ([sy, sm, sd, dy, dm, dd].some(Number.isNaN)) return null;
  const days = Math.floor((Date.UTC(dy, dm - 1, dd) - Date.UTC(sy, sm - 1, sd)) / 86400000);
  const week = Math.floor(days / 7) + 1;
  return week >= 1 && week <= 8 ? week : null;
}

// Every round's dates in the series window, from starts_at through ends_at,
// grouped by round (7-day chunks starting at starts_at). Clipped at the real
// ends_at rather than assuming exactly 8 weeks — same reasoning as
// getSeriesEndDate(). Pure / no "today" dependency; used by the Create Table
// date dropdown, which applies its own today-forward floor on top of this.
export function enumerateSeriesRounds(
  seriesStartDate: string | null,
  seriesEndDate: string | null
): { round: number; dates: string[] }[] {
  if (!seriesStartDate || !seriesEndDate) return [];
  const [sy, sm, sd] = seriesStartDate.split("-").map(Number);
  const [ey, em, ed] = seriesEndDate.split("-").map(Number);
  if ([sy, sm, sd, ey, em, ed].some(Number.isNaN)) return [];
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  if (endUtc < startUtc) return [];
  const DAY = 86400000;
  const rounds: { round: number; dates: string[] }[] = [];
  let round = 1;
  for (let roundStart = startUtc; roundStart <= endUtc; roundStart += 7 * DAY, round++) {
    const dates: string[] = [];
    for (let t = roundStart; t < roundStart + 7 * DAY && t <= endUtc; t += DAY) {
      dates.push(new Date(t).toISOString().slice(0, 10));
    }
    rounds.push({ round, dates });
  }
  return rounds;
}
