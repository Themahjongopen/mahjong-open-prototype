"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useToast } from "@/components/portal/PortalShellClient";
import { useRouter } from "next/navigation";
import { Suspense } from "react";
import { MOCK_TABLES, DEMO_USER_ID } from "@/lib/data/mock";

interface Player { user_id: string; name: string; wins: number; points: number; }

const SUBMITTABLE = new Set(["completed", "full"]);
const MY_COMPLETED_TABLES = MOCK_TABLES.filter(
  (t) => t.creator_id === DEMO_USER_ID && SUBMITTABLE.has(t.status)
);

function getPlayersForTable(tableId: string): Player[] {
  const table = MOCK_TABLES.find((t) => t.id === tableId);
  if (!table) return [];
  return table.table_seats
    .filter((s) => !s.canceled_at)
    .map((s) => ({ user_id: s.user_id, name: s.profiles?.full_name ?? "Player", wins: 0, points: 0 }));
}

function Stepper({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (d: number) => void; step?: number }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-500)", marginBottom: 6 }}>{label}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button type="button" onClick={() => onChange(-step)} style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", border: "1px solid var(--hair-200)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Minus size={14} color="var(--ink-700)" />
        </button>
        <span style={{ fontSize: 18, fontWeight: 600, minWidth: 32, textAlign: "center", color: "var(--ink-900)" }}>{value}</span>
        <button type="button" onClick={() => onChange(step)} style={{ width: 28, height: 28, borderRadius: "var(--radius-sm)", border: "1px solid var(--hair-200)", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Plus size={14} color="var(--ink-700)" />
        </button>
      </div>
    </div>
  );
}

function ScoreForm() {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedTable, setSelectedTable] = useState(MY_COMPLETED_TABLES[0]?.id ?? "");
  const [players, setPlayers] = useState<Player[]>(
    MY_COMPLETED_TABLES[0] ? getPlayersForTable(MY_COMPLETED_TABLES[0].id) : []
  );
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function handleTableChange(id: string) {
    setSelectedTable(id);
    setPlayers(getPlayersForTable(id));
  }

  function updatePlayer(userId: string, field: "wins" | "points", delta: number) {
    setPlayers((prev) =>
      prev.map((p) => p.user_id === userId ? { ...p, [field]: Math.max(0, p[field] + delta) } : p)
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTable) return;
    setLoading(true);
    setTimeout(() => {
      showToast("Score submitted — pending admin approval.");
      setSubmitted(true);
      setTimeout(() => router.push("/portal"), 1500);
    }, 800);
  }

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 8 }}>Score submitted!</p>
        <p style={{ fontSize: 14, color: "var(--ink-500)" }}>Pending admin approval. Redirecting…</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 20 }}>
        Submit a score
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Select table</label>
          <select className="input-mo" value={selectedTable} onChange={(e) => handleTableChange(e.target.value)}>
            <option value="">Choose a table…</option>
            {MY_COMPLETED_TABLES.map((t) => (
              <option key={t.id} value={t.id}>
                Week {t.week_number} — {new Date(t.table_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {t.location_name}
              </option>
            ))}
          </select>
          {MY_COMPLETED_TABLES.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--ink-500)" }}>Only tables you created and that are full or completed will appear here.</p>
          )}
        </div>

        {players.length > 0 && (
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)", marginBottom: 12 }}>Enter results</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {players.map((player) => (
                <div key={player.user_id} style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: "14px 16px", boxShadow: "var(--shadow-xs)" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", marginBottom: 12 }}>{player.name}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <Stepper label="Wins" value={player.wins} onChange={(d) => updatePlayer(player.user_id, "wins", d)} />
                    <Stepper label="Points" value={player.points} onChange={(d) => updatePlayer(player.user_id, "points", d)} step={4} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={loading || players.length === 0} style={{ justifyContent: "center", padding: "14px" }}>
          {loading ? "Submitting…" : "Submit score →"}
        </button>
      </form>
    </div>
  );
}

export default function ScoresPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "var(--ink-500)" }}>Loading…</div>}>
      <ScoreForm />
    </Suspense>
  );
}
