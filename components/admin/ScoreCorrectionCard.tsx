"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";
import type { AdminScoreSubmission } from "@/lib/admin/scores";

const STATUS_COLORS: Record<string, string> = {
  submitted: "badge-lime",
  edited: "badge-peri",
  voided: "badge-mute",
};

export default function ScoreCorrectionCard({ submission }: { submission: AdminScoreSubmission }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(submission.players.map((p) => [p.id, String(p.round_score)]))
  );
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState<"save" | "void" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isVoided = submission.status === "voided";
  const dateLabel = submission.table_date
    ? new Date(`${submission.table_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  async function save() {
    setLoading("save");
    setError(null);
    const res = await fetch(`/api/admin/scores/${submission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ players: submission.players.map((p) => ({ id: p.id, round_score: Number.parseInt(scores[p.id] || "0", 10) || 0 })) }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Could not save.");
      setLoading(null);
      return;
    }
    setEditing(false);
    setLoading(null);
    router.refresh();
  }

  async function voidRound() {
    if (!(await confirm({ title: "Void this round?", message: "It will stop counting toward standings.", confirmLabel: "Void round", danger: true }))) return;
    setLoading("void");
    setError(null);
    const res = await fetch(`/api/admin/scores/${submission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "void" }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Could not void.");
      setLoading(null);
      return;
    }
    setLoading(null);
    router.refresh();
  }

  return (
    <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", opacity: isVoided ? 0.7 : 1 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--hair-200)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", margin: 0 }}>
            Round {submission.week_number ?? "?"} · {submission.location_name ?? "Table"}
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>
            {[dateLabel, submission.city_name, submission.series_name].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={`badge ${STATUS_COLORS[submission.status] ?? "badge-mute"}`}>{submission.status}</span>
      </div>

      <div style={{ padding: "6px 18px 14px" }}>
        {submission.players.map((p) => (
          <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hair-200)" }}>
            <div>
              <span style={{ fontSize: 14, color: "var(--ink-800)" }}>{p.full_name ?? "Player"}</span>
              {p.is_no_show ? <span style={{ fontSize: 12, color: "var(--danger)", marginLeft: 8 }}>no-show</span> : null}
              {p.is_no_show_bonus ? <span style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: 8 }}>+25 stayed</span> : null}
            </div>
            {editing && !isVoided ? (
              <input
                className="input-mo"
                type="number"
                min={0}
                value={scores[p.id]}
                onChange={(e) => setScores((s) => ({ ...s, [p.id]: e.target.value }))}
                style={{ width: 90 }}
              />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{p.round_score}</span>
            )}
          </div>
        ))}

        {error ? <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 10 }}>{error}</p> : null}

        {!isVoided && (
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {editing ? (
              <>
                <button className="btn btn-primary" onClick={save} disabled={loading === "save"} style={{ fontSize: 13, padding: "6px 14px" }}>
                  {loading === "save" ? "Saving…" : "Save scores"}
                </button>
                <button className="btn btn-ghost" onClick={() => { setEditing(false); setScores(Object.fromEntries(submission.players.map((p) => [p.id, String(p.round_score)]))); }} style={{ fontSize: 13, padding: "6px 14px" }}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn btn-ghost" onClick={() => setEditing(true)} style={{ fontSize: 13, padding: "6px 14px" }}>
                Edit scores
              </button>
            )}
            <button className="btn btn-ghost" onClick={voidRound} disabled={loading === "void"} style={{ fontSize: 13, padding: "6px 14px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}>
              {loading === "void" ? "Voiding…" : "Void round"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
