"use client";

import { useMemo, useState } from "react";
// Pure type + helpers only — this is a client component, so it must not pull the
// server-only @/lib/portal/tables module into the bundle (see seats.ts note).
import { type LeagueTable } from "@/lib/portal/seats";
import { timeOfDayBucket, tableWeekdayIndex, type TimeBucket } from "@/lib/format/time";
import OpenTableCard from "@/components/portal/OpenTableCard";

// Day chips render Mon–Sun; getUTCDay() returns 0=Sun..6=Sat, so map display
// order to those indices.
const DAYS: { label: string; index: number }[] = [
  { label: "Mon", index: 1 }, { label: "Tue", index: 2 }, { label: "Wed", index: 3 },
  { label: "Thu", index: 4 }, { label: "Fri", index: 5 }, { label: "Sat", index: 6 },
  { label: "Sun", index: 0 },
];
const TIME_BUCKETS: { label: string; value: TimeBucket }[] = [
  { label: "Morning", value: "morning" },
  { label: "Afternoon", value: "afternoon" },
  { label: "Evening", value: "evening" },
];

const chipBase: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, padding: "6px 12px", borderRadius: "999px",
  cursor: "pointer", border: "1px solid var(--hair-300)", background: "#fff",
  color: "var(--ink-700)", transition: "background 120ms, color 120ms, border-color 120ms",
};
const chipActive: React.CSSProperties = {
  ...chipBase, background: "var(--pink-500)", color: "#fff", borderColor: "var(--pink-500)",
};
const legendStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
  color: "var(--ink-500)", marginBottom: 8,
};

// Client-side filtering of the already-fetched table list (week / day-of-week /
// time-of-day). Server decides Open vs All (what's fetched); these three filters
// narrow that list instantly, no round-trip. All filters combine with AND; Day
// and Time are multi-select (OR within each set), Week is single-select.
export default function TablesFilterList({ tables, currentUserId }: { tables: LeagueTable[]; currentUserId: string | null }) {
  const [week, setWeek] = useState<number | null>(null);
  const [days, setDays] = useState<Set<number>>(new Set());
  const [buckets, setBuckets] = useState<Set<TimeBucket>>(new Set());
  const [areas, setAreas] = useState<Set<string>>(new Set());

  // Weeks actually present in the data, ascending — the dropdown options.
  const weeks = useMemo(
    () => Array.from(new Set(tables.map((t) => t.week_number))).sort((a, b) => a - b),
    [tables],
  );

  // Areas actually present in the CURRENTLY LOADED tables (not a global list),
  // sorted. If none, the Area control below doesn't render at all — cities that
  // never use areas see no change.
  const areaOptions = useMemo(
    () => Array.from(new Set(tables.map((t) => t.area).filter((a): a is string => !!a))).sort((a, b) => a.localeCompare(b)),
    [tables],
  );

  const filtered = useMemo(() => tables.filter((t) => {
    if (week !== null && t.week_number !== week) return false;
    if (days.size > 0) {
      const wd = tableWeekdayIndex(t.table_date);
      if (wd === null || !days.has(wd)) return false;
    }
    if (buckets.size > 0) {
      const b = timeOfDayBucket(t.table_time);
      if (b === null || !buckets.has(b)) return false;
    }
    // Area-less tables show when NO area is selected; they're excluded only once a
    // player explicitly picks an area (she's asking for a specific part of town).
    if (areas.size > 0) {
      if (!t.area || !areas.has(t.area)) return false;
    }
    return true;
  }), [tables, week, days, buckets, areas]);

  const byWeek = useMemo(() => filtered.reduce<Record<number, LeagueTable[]>>((acc, t) => {
    (acc[t.week_number] ??= []).push(t);
    return acc;
  }, {}), [filtered]);

  const anyActive = week !== null || days.size > 0 || buckets.size > 0 || areas.size > 0;
  function clearAll() { setWeek(null); setDays(new Set()); setBuckets(new Set()); setAreas(new Set()); }
  function toggleDay(i: number) {
    setDays((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
  }
  function toggleBucket(v: TimeBucket) {
    setBuckets((prev) => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next; });
  }
  function toggleArea(v: string) {
    setAreas((prev) => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next; });
  }

  return (
    <div>
      {/* Filter controls */}
      <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p style={legendStyle}>Week</p>
          <select
            value={week === null ? "" : String(week)}
            onChange={(e) => setWeek(e.target.value === "" ? null : Number(e.target.value))}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, color: "var(--ink-800)",
              border: "1px solid var(--hair-300)", borderRadius: "var(--radius-md)", background: "#fff",
            }}
          >
            <option value="">All Weeks</option>
            {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
          </select>
        </div>

        <div>
          <p style={legendStyle}>Day</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {DAYS.map((d) => (
              <button key={d.index} type="button" onClick={() => toggleDay(d.index)}
                aria-pressed={days.has(d.index)} style={days.has(d.index) ? chipActive : chipBase}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={legendStyle}>Time of day</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {TIME_BUCKETS.map((tb) => (
              <button key={tb.value} type="button" onClick={() => toggleBucket(tb.value)}
                aria-pressed={buckets.has(tb.value)} style={buckets.has(tb.value) ? chipActive : chipBase}>
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        {/* Area — only rendered when at least one loaded table has an area, so
            cities that never use areas see no new control. */}
        {areaOptions.length > 0 && (
          <div>
            <p style={legendStyle}>Part of town</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {areaOptions.map((a) => (
                <button key={a} type="button" onClick={() => toggleArea(a)}
                  aria-pressed={areas.has(a)} style={areas.has(a) ? chipActive : chipBase}>
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Count + clear */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
          {anyActive ? `${filtered.length} of ${tables.length} tables shown` : `${tables.length} table${tables.length === 1 ? "" : "s"}`}
        </span>
        {anyActive && (
          <button type="button" onClick={clearAll}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--pink-600)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            Clear filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--ink-500)" }}>
          <p style={{ fontSize: 15, marginBottom: 12 }}>No tables match these filters.</p>
          <button type="button" onClick={clearAll}
            style={{ fontSize: 14, fontWeight: 600, color: "var(--pink-600)", background: "none", border: "none", cursor: "pointer" }}>
            Clear filters
          </button>
        </div>
      ) : (
        Object.entries(byWeek).map(([week, weekTables]) => (
          <div key={week} style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--lime-600)", marginBottom: 12 }}>
              Week {week}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {weekTables.map((table) => (
                <OpenTableCard key={table.id} table={table} currentUserId={currentUserId} />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
