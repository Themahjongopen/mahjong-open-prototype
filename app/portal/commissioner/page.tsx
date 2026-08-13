"use client";

import { useEffect, useMemo, useState } from "react";

const PAID_BADGE: Record<string, string> = { paid: "badge-lime", pending: "badge-butter" };
// Same skill → badge-color map used on OpenTableCard / TableDetailClient. NOTE:
// this is now a 3rd copy of the same 4-line object — worth extracting to a
// shared constant someday (flagged, not blocking).
const SKILL_COLORS: Record<string, string> = {
  beginner: "badge-lime",
  intermediate: "badge-peri",
  advanced: "badge-pink",
};

type Row = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  paid_status: string;
  created_at: string;
  profiles: { hometown: string | null; skill_level: string | null } | null;
};
type Filter = "all" | "paid" | "pending";
type Level = "all" | "beginner" | "intermediate" | "advanced";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CommissionerPlayersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [levelFilter, setLevelFilter] = useState<Level>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/commissioner/players", { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) setRows(payload.players ?? []);
      setLoading(false);
    })();
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.paid_status !== filter) return false;
      if (levelFilter !== "all" && r.profiles?.skill_level !== levelFilter) return false;
      if (q && !`${r.full_name ?? ""} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, filter, levelFilter, search]);

  const paidCount = rows.filter((r) => r.paid_status === "paid").length;
  const pendingCount = rows.filter((r) => r.paid_status === "pending").length;

  return (
    <div>
      <p className="body-lg" style={{ marginBottom: 16, color: "var(--ink-700)" }}>
        {paidCount} paid · {pendingCount} pending
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {(["all", "paid", "pending"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`badge ${filter === f ? "badge-lime" : "badge-mute"}`}
            style={{ cursor: "pointer", border: "1px solid var(--hair-200)", background: filter === f ? undefined : "#fff", textTransform: "capitalize" }}
          >
            {f}
          </button>
        ))}
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as Level)}
          aria-label="Filter by skill level"
          className="input-mo"
          style={{ fontSize: 13, padding: "6px 10px", maxWidth: 190 }}
        >
          <option value="all">All levels</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search name, email, or phone…"
        aria-label="Search players"
        className="input-mo"
        style={{ maxWidth: 360, marginBottom: 16 }}
      />

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        <div className="commissioner-players-table">
          <div className="admin-players-table-header">
            {["Name", "Hometown", "Email", "Phone", "Level", "Payment", "Registered"].map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 20, color: "var(--ink-500)" }}>Loading…</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: 20, color: "var(--ink-500)" }}>
              {rows.length === 0 ? "No players yet." : "No players match this filter."}
            </div>
          ) : (
            filteredRows.map((r) => (
              <div key={r.id} className="admin-players-row">
                <div>
                  <span className="admin-mobile-label">Name</span>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)" }}>{r.full_name ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Hometown</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.profiles?.hometown ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Email</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)", wordBreak: "break-word" }}>{r.email}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Phone</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.phone ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Level</span>
                  {r.profiles?.skill_level ? (
                    <span className={`badge ${SKILL_COLORS[r.profiles.skill_level] ?? "badge-mute"}`} style={{ textTransform: "capitalize" }}>{r.profiles.skill_level}</span>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--ink-500)" }}>—</span>
                  )}
                </div>
                <div>
                  <span className="admin-mobile-label">Payment</span>
                  <span className={`badge ${PAID_BADGE[r.paid_status] ?? "badge-mute"}`}>{r.paid_status}</span>
                </div>
                <div>
                  <span className="admin-mobile-label">Registered</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{formatDate(r.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
