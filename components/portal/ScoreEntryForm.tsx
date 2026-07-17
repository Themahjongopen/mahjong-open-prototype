"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoreableTable } from "@/lib/portal/scores";

type Entry = { round_score: string; is_no_show: boolean };

function initEntries(table: ScoreableTable | undefined): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  for (const s of table?.seats ?? []) out[s.user_id] = { round_score: "0", is_no_show: false };
  return out;
}

export default function ScoreEntryForm({ tables, initialTableId }: { tables: ScoreableTable[]; initialTableId: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialTableId || tables[0]?.id || "");
  const selected = tables.find((t) => t.id === selectedId);
  const [entries, setEntries] = useState<Record<string, Entry>>(() => initEntries(tables.find((t) => t.id === (initialTableId || tables[0]?.id))));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyNoShow = Object.values(entries).some((e) => e.is_no_show);

  function changeTable(id: string) {
    setSelectedId(id);
    setEntries(initEntries(tables.find((t) => t.id === id)));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setLoading(true);
    setError(null);

    const players = selected.seats.map((s) => ({
      user_id: s.user_id,
      round_score: Number.parseInt(entries[s.user_id]?.round_score || "0", 10) || 0,
      is_no_show: entries[s.user_id]?.is_no_show ?? false,
    }));

    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table_id: selected.id, players }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Scores could not be submitted.");
      setLoading(false);
      return;
    }
    router.push(`/portal/tables/${selected.id}`);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Table</label>
        <select className="input-mo" value={selectedId} onChange={(e) => changeTable(e.target.value)}>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              Round {t.week_number} — {new Date(`${t.table_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.location_name}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)", marginBottom: 6 }}>Round scores</p>
          <p style={{ fontSize: 13, color: "var(--ink-500)", marginBottom: 12 }}>
            Enter each player&rsquo;s total for the round (including any bonuses applied at the table), or mark a player as a no-show.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {selected.seats.map((s) => {
              const entry = entries[s.user_id] ?? { round_score: "0", is_no_show: false };
              return (
                <div key={s.user_id} style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: "14px 16px", boxShadow: "var(--shadow-xs)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{s.full_name ?? "Player"}</p>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-600)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={entry.is_no_show}
                        onChange={(ev) => setEntries((prev) => ({ ...prev, [s.user_id]: { ...entry, is_no_show: ev.target.checked } }))}
                        style={{ width: 16, height: 16, accentColor: "var(--pink-500)" }}
                      />
                      No-show
                    </label>
                  </div>
                  {!anyNoShow && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-500)", marginBottom: 4, display: "block" }}>Round score</label>
                      <input
                        className="input-mo"
                        type="number"
                        min={0}
                        value={entry.round_score}
                        onChange={(ev) => setEntries((prev) => ({ ...prev, [s.user_id]: { ...entry, round_score: ev.target.value } }))}
                        style={{ maxWidth: 140 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {anyNoShow && (
            <div style={{ marginTop: 12, background: "var(--warning-bg, #fff7ed)", border: "1px solid var(--crimson-100)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13, color: "var(--ink-700)", lineHeight: 1.6 }}>
              No-show round: each absent player takes a −25 weekly penalty and everyone who stayed gets +25. Individual round scores aren&rsquo;t entered, and the round doesn&rsquo;t count toward averages.
            </div>
          )}
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: "var(--danger)" }}>{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={loading || !selected} style={{ justifyContent: "center", padding: "14px" }}>
        {loading ? "Posting…" : "Post scores"}
      </button>
    </form>
  );
}
