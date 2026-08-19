"use client";

import { useEffect, useState } from "react";

type Row = {
  commissioner_profile_id: string | null;
  commissioner_name: string | null;
  is_unattributed: boolean;
  direct_cents: number;
  direct_players: number;
  organic_cents: number;
  organic_players: number;
  organic_ways: number[];
  refunded_cents: number;
  refunded_players: number;
  total_cents: number;
};
type City = { city_id: string; city_name: string; paid_player_count: number; attributed_paid_count: number; city_total_cents: number; rows: Row[] };
type Series = { id: string; name: string; starts_at: string | null };

function usd(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function waysLabel(ways: number[]) {
  if (ways.length === 0) return "";
  if (ways.length === 1) return `split ${ways[0]} ways`;
  return `split ${ways[0]}–${ways[ways.length - 1]} ways`;
}

export default function AdminRevenuePage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [cities, setCities] = useState<City[]>([]);
  const [pct, setPct] = useState<Record<string, string>>({}); // rowKey -> percent (client-only, never persisted)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(seriesId?: string) {
    setLoading(true);
    const res = await fetch(`/api/admin/revenue${seriesId ? `?series_id=${encodeURIComponent(seriesId)}` : ""}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Revenue could not be loaded.");
      setLoading(false);
      return;
    }
    setSeries(payload.series ?? []);
    setSelected(payload.selectedSeriesId ?? "");
    setCities(payload.cities ?? []);
    setPct({}); // percentages are per-view judgement calls — clear on any reload
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const rowKey = (city: City, row: Row) => `${city.city_id}:${row.commissioner_profile_id ?? "unattr"}`;

  return (
    <div style={{ maxWidth: 900 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 6 }}>Commissioner revenue</h1>
      <p style={{ fontSize: 14, color: "var(--ink-500)", marginBottom: 4 }}>
        Attributed revenue per commissioner per city. Revenue is fractional — a split registration is divided by weight.
      </p>
      <p style={{ fontSize: 13, color: "var(--ink-400)", marginBottom: 20 }}>
        All figures are <strong>gross</strong> — before Stripe fees (~2.9% + 30¢). A percentage entered below is applied to gross.
      </p>

      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>League</label>
        <select
          className="input-mo"
          value={selected}
          onChange={(e) => load(e.target.value)}
          style={{ maxWidth: 360 }}
        >
          {series.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {error ? (
        <div style={{ background: "#fdecee", border: "1px solid var(--danger)", borderRadius: "var(--radius-md)", padding: "10px 14px", color: "var(--danger)", fontSize: 14 }}>{error}</div>
      ) : loading ? (
        <p style={{ fontSize: 14, color: "var(--ink-500)" }}>Loading…</p>
      ) : cities.length === 0 ? (
        <p style={{ fontSize: 14, color: "var(--ink-500)" }}>No attributed revenue for this league yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {cities.map((city) => (
            <section key={city.city_id} style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", overflow: "hidden" }}>
              {/* City rollup header */}
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair-200)", background: "var(--pink-50)", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)" }}>{city.city_name}</span>
                  <span style={{ fontSize: 13, color: "var(--ink-500)", marginLeft: 10 }}>{city.paid_player_count} paid player{city.paid_player_count === 1 ? "" : "s"}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)" }}>City total {usd(city.city_total_cents)}</span>
              </div>

              {/* Incompleteness warning — attributed count below paid-player count
                  means the pre-attribution backfill hasn't reached everyone, so
                  this city's revenue is understated. Read it as partial, not real. */}
              {city.attributed_paid_count < city.paid_player_count ? (
                <div style={{ padding: "8px 16px", background: "var(--butter-50, #fdf6e3)", borderBottom: "1px solid var(--hair-200)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--butter-700, #9a7b1a)" }}>⚠ Incomplete</span>
                  <span style={{ fontSize: 13, color: "var(--ink-700)" }}>
                    {city.attributed_paid_count} of {city.paid_player_count} registrations attributed — revenue below is understated until the rest are attributed.
                  </span>
                </div>
              ) : null}

              {city.rows.map((row, i) => {
                const key = rowKey(city, row);
                const pctVal = pct[key] ?? "";
                const pctNum = parseFloat(pctVal);
                const payoutCents = Number.isFinite(pctNum) ? row.total_cents * (pctNum / 100) : null;
                return (
                  <div key={key} style={{ padding: "14px 16px", borderBottom: i < city.rows.length - 1 ? "1px solid var(--hair-200)" : "none", display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ minWidth: 240, flex: 1 }}>
                      <p style={{ fontSize: 15, fontWeight: 600, color: row.is_unattributed ? "var(--ink-500)" : "var(--ink-900)", margin: 0 }}>
                        {row.is_unattributed ? "Unattributed" : (row.commissioner_name ?? "—")}
                      </p>
                      <p style={{ fontSize: 13, color: "var(--ink-600)", margin: "6px 0 0" }}>
                        Direct: <strong>{usd(row.direct_cents)}</strong> · {row.direct_players} player{row.direct_players === 1 ? "" : "s"}
                      </p>
                      {row.organic_players > 0 || row.organic_cents > 0 ? (
                        <p style={{ fontSize: 13, color: "var(--ink-600)", margin: "3px 0 0" }}>
                          Share of organic: <strong>{usd(row.organic_cents)}</strong> · {row.organic_players} player{row.organic_players === 1 ? "" : "s"}
                          {row.organic_ways.length ? ` (${waysLabel(row.organic_ways)})` : ""}
                        </p>
                      ) : null}
                      {row.refunded_cents > 0 ? (
                        <p style={{ fontSize: 13, color: "var(--danger)", margin: "3px 0 0" }}>
                          Refunded: <strong>−{usd(row.refunded_cents)}</strong> · {row.refunded_players} player{row.refunded_players === 1 ? "" : "s"} <span style={{ color: "var(--ink-400)" }}>(excluded from total)</span>
                        </p>
                      ) : null}
                      <p style={{ fontSize: 14, color: "var(--ink-900)", margin: "6px 0 0" }}>
                        Total: <strong>{usd(row.total_cents)}</strong>
                      </p>
                    </div>

                    {/* Percentage input + live payout (client-only, never persisted) */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, alignSelf: "flex-start" }}>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={100}
                        step={0.5}
                        placeholder="%"
                        value={pctVal}
                        onChange={(e) => setPct((p) => ({ ...p, [key]: e.target.value }))}
                        aria-label={`Commission percentage for ${row.commissioner_name ?? "unattributed"} in ${city.city_name}`}
                        style={{ width: 64, boxSizing: "border-box", padding: "8px 10px", fontSize: 14, border: "1px solid var(--hair-200)", borderRadius: 8, textAlign: "right" }}
                      />
                      <span style={{ fontSize: 13, color: "var(--ink-500)" }}>%</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: payoutCents === null ? "var(--ink-300)" : "var(--pink-700)", minWidth: 84, textAlign: "right" }}>
                        {payoutCents === null ? "—" : usd(payoutCents)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
