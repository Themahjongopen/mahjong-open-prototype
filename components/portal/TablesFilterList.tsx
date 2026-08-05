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

// Client-side filtering of the already-fetched table list (round / day-of-week /
// time-of-day). Server decides Open vs All (what's fetched); these three filters
// narrow that list instantly, no round-trip. All filters combine with AND; Day
// and Time are multi-select (OR within each set), Round is single-select.
export default function TablesFilterList({ tables, currentUserId }: { tables: LeagueTable[]; currentUserId: string | null }) {
  const [round, setRound] = useState<number | null>(null);
  const [days, setDays] = useState<Set<number>>(new Set());
  const [buckets, setBuckets] = useState<Set<TimeBucket>>(new Set());

  // Rounds actually present in the data, ascending — the dropdown options.
  const rounds = useMemo(
    () => Array.from(new Set(tables.map((t) => t.week_number))).sort((a, b) => a - b),
    [tables],
  );

  const filtered = useMemo(() => tables.filter((t) => {
    if (round !== null && t.week_number !== round) return false;
    if (days.size > 0) {
      const wd = tableWeekdayIndex(t.table_date);
      if (wd === null || !days.has(wd)) return false;
    }
    if (buckets.size > 0) {
      const b = timeOfDayBucket(t.table_time);
      if (b === null || !buckets.has(b)) return false;
    }
    return true;
  }), [tables, round, days, buckets]);

  const byWeek = useMemo(() => filtered.reduce<Record<number, LeagueTable[]>>((acc, t) => {
    (acc[t.week_number] ??= []).push(t);
    return acc;
  }, {}), [filtered]);

  const anyActive = round !== null || days.size > 0 || buckets.size > 0;
  function clearAll() { setRound(null); setDays(new Set()); setBuckets(new Set()); }
  function toggleDay(i: number) {
    setDays((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
  }
  function toggleBucket(v: TimeBucket) {
    setBuckets((prev) => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next; });
  }

  return (
    <div>
      {/* Filter controls */}
      <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p style={legendStyle}>Round</p>
          <select
            value={round === null ? "" : String(round)}
            onChange={(e) => setRound(e.target.value === "" ? null : Number(e.target.value))}
            style={{
              width: "100%", padding: "8px 12px", fontSize: 14, color: "var(--ink-800)",
              border: "1px solid var(--hair-300)", borderRadius: "var(--radius-md)", background: "#fff",
            }}
          >
            <option value="">All Rounds</option>
            {rounds.map((r) => <option key={r} value={r}>Round {r}</option>)}
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
              Round {week}
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
