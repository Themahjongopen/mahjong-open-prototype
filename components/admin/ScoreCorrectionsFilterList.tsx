"use client";

import { useMemo, useState } from "react";
import type { AdminScoreSubmission } from "@/lib/admin/scores";
import { timeOfDayBucket, tableWeekdayIndex, type TimeBucket } from "@/lib/format/time";
import ScoreCorrectionCard from "@/components/admin/ScoreCorrectionCard";

// Day chips render Mon–Sun; getUTCDay() returns 0=Sun..6=Sat, so map display
// order to those indices (same shape as TablesFilterList).
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

// Client-side search + filtering of the already-fetched submission list. No new
// API route — everything narrows the list in place. All filters AND together; Day
// and Time-of-day are each multi-select (OR within each set).
export default function ScoreCorrectionsFilterList({ submissions }: { submissions: AdminScoreSubmission[] }) {
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [days, setDays] = useState<Set<number>>(new Set());
  const [buckets, setBuckets] = useState<Set<TimeBucket>>(new Set());

  // Distinct city names present in the submissions, sorted alphabetically.
  const cityOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of submissions) if (s.city_name) names.add(s.city_name);
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [submissions]);

  // Distinct week numbers present, sorted numerically.
  const weekOptions = useMemo(() => {
    const weeks = new Set<number>();
    for (const s of submissions) if (typeof s.week_number === "number") weeks.add(s.week_number);
    return Array.from(weeks).sort((a, b) => a - b);
  }, [submissions]);

  // AND across all active filters; search matches venue, city, or any player name.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return submissions.filter((s) => {
      if (cityFilter !== "all" && s.city_name !== cityFilter) return false;
      if (weekFilter !== "all" && String(s.week_number) !== weekFilter) return false;
      if (days.size > 0) {
        const wd = tableWeekdayIndex(s.table_date);
        if (wd === null || !days.has(wd)) return false;
      }
      if (buckets.size > 0) {
        const b = timeOfDayBucket(s.table_time);
        if (b === null || !buckets.has(b)) return false;
      }
      if (q) {
        const hay = [s.location_name, s.city_name, ...s.players.map((p) => p.full_name)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [submissions, search, cityFilter, weekFilter, days, buckets]);

  const anyActive = !!search.trim() || cityFilter !== "all" || weekFilter !== "all" || days.size > 0 || buckets.size > 0;
  function clearAll() {
    setSearch(""); setCityFilter("all"); setWeekFilter("all"); setDays(new Set()); setBuckets(new Set());
  }
  function toggleDay(i: number) {
    setDays((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
  }
  function toggleBucket(v: TimeBucket) {
    setBuckets((prev) => { const next = new Set(prev); next.has(v) ? next.delete(v) : next.add(v); return next; });
  }

  return (
    <div>
      {/* Search */}
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search venue, city, or player…"
        aria-label="Search score corrections"
        className="input-mo"
        style={{ width: "100%", maxWidth: 360, marginBottom: 12 }}
      />

      {/* City + week dropdowns */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <select aria-label="Filter by city" className="input-mo" style={{ maxWidth: 260 }} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="all">All cities</option>
          {cityOptions.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Filter by week" className="input-mo" style={{ maxWidth: 200 }} value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}>
          <option value="all">All weeks</option>
          {weekOptions.map((w) => (
            <option key={w} value={String(w)}>Week {w}</option>
          ))}
        </select>
      </div>

      {/* Day + time-of-day chip rows (identical to TablesFilterList) */}
      <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 16 }}>
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
          {anyActive ? `${filtered.length} of ${submissions.length} shown` : `${submissions.length} round${submissions.length === 1 ? "" : "s"}`}
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
          <p style={{ fontSize: 15, marginBottom: 12 }}>No rounds match these filters.</p>
          <button type="button" onClick={clearAll}
            style={{ fontSize: 14, fontWeight: 600, color: "var(--pink-600)", background: "none", border: "none", cursor: "pointer" }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((s) => (
            <ScoreCorrectionCard key={s.id} submission={s} />
          ))}
        </div>
      )}
    </div>
  );
}
