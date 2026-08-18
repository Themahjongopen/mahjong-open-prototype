"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ScoreableTable } from "@/lib/portal/scores";

type Entry = { round_score: string; is_no_show: boolean };

function initEntries(table: ScoreableTable | undefined): Record<string, Entry> {
  const out: Record<string, Entry> = {};
  // A late-cancelled seat is forced to a no-show and can't be edited — seed its
  // entry as a no-show so it's included in the payload (and trips the no-show round).
  for (const s of table?.seats ?? []) out[s.user_id] = { round_score: "0", is_no_show: s.is_late_cancellation };
  return out;
}

export default function ScoreEntryForm({ tables, initialTableId }: { tables: ScoreableTable[]; initialTableId: string }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(initialTableId || tables[0]?.id || "");
  const selected = tables.find((t) => t.id === selectedId);
  const [entries, setEntries] = useState<Record<string, Entry>>(() => initEntries(tables.find((t) => t.id === (initialTableId || tables[0]?.id))));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "entry" = editable score fields; "review" = read-only summary + confirm.
  const [stage, setStage] = useState<"entry" | "review">("entry");

  const anyNoShow = Object.values(entries).some((e) => e.is_no_show);

  function changeTable(id: string) {
    setSelectedId(id);
    setEntries(initEntries(tables.find((t) => t.id === id)));
    setStage("entry");
    setError(null);
  }

  // The form's submit: from entry it advances to review (no POST); from review
  // it performs the real post. This is what blocks a premature/accidental submit.
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (stage === "entry") {
      setStage("review");
      return;
    }
    handleConfirmPost();
  }

  async function handleConfirmPost() {
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
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Table</label>
        <select className="input-mo" value={selectedId} onChange={(e) => changeTable(e.target.value)}>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              Week {t.week_number} — {new Date(`${t.table_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.location_name}
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
          {stage === "entry" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {selected.seats.map((s) => {
              const entry = entries[s.user_id] ?? { round_score: "0", is_no_show: s.is_late_cancellation };

              // Late cancellation: locked no-show. Checkbox is checked + disabled
              // (host can't enter a real score), with a badge explaining why.
              if (s.is_late_cancellation) {
                return (
                  <div key={s.user_id} style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: "14px 16px", boxShadow: "var(--shadow-xs)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{s.full_name ?? "Player"}</p>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--ink-400)" }}>
                        <input type="checkbox" checked disabled style={{ width: 16, height: 16, accentColor: "var(--pink-500)" }} />
                        No-show
                      </label>
                    </div>
                    <span style={{ display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 700, color: "var(--danger)", background: "var(--warning-bg, #fff7ed)", border: "1px solid var(--crimson-100)", borderRadius: 999, padding: "3px 10px" }}>
                      Canceled within 24 hours — recorded as a no-show
                    </span>
                  </div>
                );
              }

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
                        onFocus={(e) => e.target.select()}
                        style={{ maxWidth: 140 }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {selected.seats.map((s) => {
              const entry = entries[s.user_id] ?? { round_score: "0", is_no_show: s.is_late_cancellation };
              return (
                <div key={s.user_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-md)", fontSize: 14 }}>
                  <span style={{ color: "var(--ink-800)", fontWeight: 500 }}>{s.full_name ?? "Player"}</span>
                  <span style={{ color: entry.is_no_show ? "var(--danger)" : "var(--ink-900)", fontWeight: 600 }}>
                    {entry.is_no_show ? "No-show" : (Number.parseInt(entry.round_score || "0", 10) || 0)}
                  </span>
                </div>
              );
            })}
          </div>
          )}

          {anyNoShow && (
            <div style={{ marginTop: 12, background: "var(--warning-bg, #fff7ed)", border: "1px solid var(--crimson-100)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13, color: "var(--ink-700)", lineHeight: 1.6 }}>
              No-show round: each absent player takes a −25 weekly penalty and everyone who stayed gets +25. Individual round scores aren&rsquo;t entered, and the round doesn&rsquo;t count toward averages.
            </div>
          )}
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: "var(--danger)" }}>{error}</p>}

      {stage === "review" ? (
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-ghost" type="button" onClick={() => setStage("entry")} disabled={loading} style={{ justifyContent: "center", padding: "14px" }}>
            ← Edit
          </button>
          <button className="btn btn-primary" type="submit" disabled={loading || !selected} style={{ justifyContent: "center", padding: "14px", flex: 1 }}>
            {loading ? "Posting…" : "Confirm & post scores"}
          </button>
        </div>
      ) : (
        <button className="btn btn-primary" type="submit" disabled={loading || !selected} style={{ justifyContent: "center", padding: "14px" }}>
          Review scores →
        </button>
      )}
    </form>
  );
}
