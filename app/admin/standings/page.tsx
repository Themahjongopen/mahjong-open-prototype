"use client";

import { useEffect, useRef, useState } from "react";
import { byAceAward, byChampionAward, type StandingRow } from "@/lib/portal/standingsSort";
import Avatar from "@/components/portal/Avatar";

type City = { id: string; name: string; state: string | null; is_active: boolean };
type Series = { id: string; name: string; is_active: boolean };
type CityStandingRow = { city_id: string; city_name: string | null; city_score: number; city_rank: number | null };

const COLS = "40px 1fr 84px 72px";

function Row({ row, rank, value, last }: { row: StandingRow; rank: string; value: string; last: boolean }) {
  const name = row.full_name ?? "Player";
  return (
    <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "12px 16px", borderBottom: last ? "none" : "1px solid var(--hair-200)", alignItems: "center", gap: 8, background: "#fff" }}>
      <p style={{ fontSize: 15, fontFamily: "var(--font-display)", color: rank === "1" ? "var(--crimson-500)" : "var(--ink-700)", margin: 0 }}>{rank}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar src={row.avatar_url} size={28} alt={name} />
        <p style={{ fontSize: 14, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{name}</p>
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", margin: 0 }}>{value}</p>
      <p style={{ fontSize: 13, color: "var(--ink-500)", margin: 0 }}>{row.rounds_played}</p>
    </div>
  );
}

function Board({ title, subtitle, valueHeader, rows, rankOf, valueOf }: {
  title: string; subtitle: string; valueHeader: string; rows: StandingRow[];
  rankOf: (r: StandingRow) => string; valueOf: (r: StandingRow) => string;
}) {
  return (
    <section>
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3 }}>{subtitle}</p>
      </div>
      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 16px", borderBottom: "1px solid var(--hair-200)", gap: 8 }}>
          {["#", "Player", valueHeader, "Rounds"].map((h) => (
            <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.1em", textTransform: "uppercase", margin: 0 }}>{h}</p>
          ))}
        </div>
        {rows.map((row, i) => (
          <Row key={row.user_id} row={row} rank={rankOf(row)} value={valueOf(row)} last={i === rows.length - 1} />
        ))}
      </div>
    </section>
  );
}

export default function AdminStandingsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [cityId, setCityId] = useState<string>("");
  const [seriesId, setSeriesId] = useState<string>("");
  const [cityName, setCityName] = useState<string | null>(null);
  const [seriesName, setSeriesName] = useState<string | null>(null);
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [cityRows, setCityRows] = useState<CityStandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(0);

  // Load the two dropdowns; both routes return active-first, so default to the
  // first entry (an active city + the active series).
  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([fetch("/api/admin/cities"), fetch("/api/admin/series")]);
      const cPayload = await cRes.json().catch(() => ({}));
      const sPayload = await sRes.json().catch(() => ({}));
      if (!cRes.ok || !sRes.ok) { setError("Could not load cities or series."); setLoading(false); return; }
      const cs: City[] = cPayload.cities ?? [];
      const ss: Series[] = sPayload.series ?? [];
      setCities(cs);
      setSeries(ss);
      setCityId(cs[0]?.id ?? "");
      setSeriesId(ss[0]?.id ?? "");
      if (!cs[0] || !ss[0]) { setLoading(false); }
    })();
  }, []);

  // Re-fetch whenever either selection changes. A per-request token drops stale
  // responses; clearing rows + showing loading avoids a flash of the old city.
  useEffect(() => {
    if (!cityId || !seriesId) return;
    const token = ++reqRef.current;
    setLoading(true);
    setError(null);
    setRows([]);
    (async () => {
      const res = await fetch(`/api/admin/standings?city_id=${encodeURIComponent(cityId)}&series_id=${encodeURIComponent(seriesId)}`);
      const payload = await res.json().catch(() => ({}));
      if (token !== reqRef.current) return; // a newer request superseded this one
      if (!res.ok) { setError(payload.error || "Standings could not be loaded."); setRows([]); }
      else { setCityName(payload.cityName ?? null); setSeriesName(payload.seriesName ?? null); setRows(payload.rows ?? []); }
      setLoading(false);
    })();
  }, [cityId, seriesId]);

  // City-vs-city board is inherently cross-city — it only depends on the series.
  useEffect(() => {
    if (!seriesId) { setCityRows([]); return; }
    let active = true;
    (async () => {
      const res = await fetch(`/api/admin/city-standings?series_id=${encodeURIComponent(seriesId)}`);
      const payload = await res.json().catch(() => ({}));
      if (!active) return;
      setCityRows(res.ok ? (payload.rows ?? []) : []);
    })();
    return () => { active = false; };
  }, [seriesId]);

  const selectStyle: React.CSSProperties = { padding: "9px 12px", borderRadius: 10, border: "1px solid var(--hair-200)", background: "#fff", fontSize: 14, color: "var(--ink-900)", minWidth: 200 };

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 8 }}>Standings</h1>
      <p style={{ fontSize: 14, color: "var(--ink-500)", marginBottom: 24 }}>
        Read-only leaderboards for any city and series — the same numbers players see.
      </p>

      {/* City + series selectors */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-800)" }}>City</label>
          <select style={selectStyle} value={cityId} onChange={(e) => setCityId(e.target.value)} disabled={cities.length === 0}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>{c.state ? `${c.name}, ${c.state}` : c.name}{c.is_active ? "" : " (inactive)"}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-800)" }}>Series</label>
          <select style={selectStyle} value={seriesId} onChange={(e) => setSeriesId(e.target.value)} disabled={series.length === 0}>
            {series.map((s) => (
              <option key={s.id} value={s.id}>{s.name}{s.is_active ? "" : " (inactive)"}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div style={{ background: "#fff5f7", border: "1px solid #f4cbd6", padding: "12px 14px", borderRadius: 10, color: "var(--pink-700)", fontSize: 14 }}>{error}</div>
      ) : loading ? (
        <p style={{ color: "var(--ink-500)", fontSize: 14 }}>Loading standings…</p>
      ) : rows.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 28, textAlign: "center", boxShadow: "var(--shadow-xs)" }}>
          <p style={{ fontSize: 15, color: "var(--ink-700)", margin: 0 }}>No scores yet for this city/series.</p>
          <p style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 6 }}>
            {(cityName ?? "This city")}{seriesName ? ` · ${seriesName}` : ""} has no scored rounds yet.
          </p>
        </div>
      ) : (
        <>
          {cityName || seriesName ? (
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-500)", marginBottom: 16 }}>
              {cityName}{cityName && seriesName ? " · " : ""}{seriesName}
            </p>
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start" }}>
            <Board
              title="Ace Award"
              subtitle="Your single highest round score this series."
              valueHeader="Score"
              rows={byAceAward(rows)}
              rankOf={(r) => String(r.ace_award_rank ?? "—")}
              valueOf={(r) => String(r.ace_award_score)}
            />
            <Board
              title="Champion Award"
              subtitle="Weekly average of your lowest and highest round, summed across your best 7 of 8 weeks."
              valueHeader="Score"
              rows={byChampionAward(rows)}
              rankOf={(r) => String(r.champion_award_rank ?? "—")}
              valueOf={(r) => r.champion_award_score.toFixed(1)}
            />
          </div>
          {cityRows.length > 0 ? (
            <section style={{ marginTop: 32, maxWidth: 520 }}>
              <div style={{ marginBottom: 12 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: 0 }}>City Leaderboard</h2>
                <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 3 }}>
                  Top 3 individual round scores in each city, added together. The leading city is The Mahjong Open Leader.
                </p>
              </div>
              <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
                {cityRows.map((c, i) => (
                  <div
                    key={c.city_id}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "14px 16px",
                      borderBottom: i === cityRows.length - 1 ? "none" : "1px solid var(--hair-200)",
                      background: c.city_rank === 1 ? "var(--crimson-50)" : "#fff",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <p style={{ fontSize: 15, fontFamily: "var(--font-display)", color: c.city_rank === 1 ? "var(--crimson-500)" : "var(--ink-700)", margin: 0 }}>{c.city_rank ?? "—"}</p>
                      <p style={{ fontSize: 14, color: "var(--ink-900)", margin: 0 }}>{c.city_name}</p>
                      {c.city_rank === 1 ? (
                        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--crimson-600)", background: "var(--crimson-100)", border: "1px solid var(--crimson-400)", borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>
                          The Mahjong Open Leader
                        </span>
                      ) : null}
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", margin: 0 }}>{c.city_score}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
