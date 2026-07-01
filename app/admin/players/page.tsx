"use client";

import { useEffect, useMemo, useState } from "react";

const PAID_BADGE: Record<string, string> = { paid: "badge-lime", pending: "badge-butter", refunded: "badge-mute" };

type RegistrationRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  skill_level: string | null;
  paid_status: string;
  created_at: string;
  city: string | null;
  series: string | null;
};

type Filter = "all" | "paid" | "pending";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Wrap a CSV field in quotes when it contains a comma, quote, or newline; escape embedded quotes.
function csvField(value: string | null): string {
  const text = value ?? "";
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export default function AdminRegistrationsPage() {
  const [rows, setRows] = useState<RegistrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  async function loadRows() {
    setLoading(true);
    const response = await fetch("/api/admin/players", { credentials: "include" });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) {
      setRows(Array.isArray(payload.players) ? payload.players : []);
      setMessage(null);
    } else {
      setMessage(payload.error ?? "Unable to load registrations.");
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadRows();
  }, []);

  const paidCount = useMemo(() => rows.filter((r) => r.paid_status === "paid").length, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "all") return rows;
    return rows.filter((r) => r.paid_status === filter);
  }, [rows, filter]);

  function handleExport() {
    const header = ["Name", "Email", "Phone", "City", "Series", "Skill", "Payment status", "Registered date"];
    const lines = [header.join(",")];
    for (const r of filteredRows) {
      lines.push([
        csvField(r.full_name),
        csvField(r.email),
        csvField(r.phone),
        csvField(r.city),
        csvField(r.series),
        csvField(r.skill_level),
        csvField(r.paid_status),
        csvField(formatDate(r.created_at)),
      ].join(","));
    }
    const csv = lines.join("\r\n");
    const today = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `registrations-${today}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "paid", label: "Paid" },
    { key: "pending", label: "Pending" },
  ];

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 8 }}>Registrations</h1>
          <p style={{ fontSize: 15, color: "var(--ink-500)" }}>{paidCount} paid · {rows.length} total</p>
        </div>
        <button type="button" className="btn" onClick={handleExport} disabled={filteredRows.length === 0}>
          Export CSV
        </button>
      </div>

      {message ? <p style={{ fontSize: 13, color: "var(--ink-700)", marginBottom: 16 }}>{message}</p> : null}

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`badge ${filter === f.key ? "badge-lime" : "badge-mute"}`}
            style={{ cursor: "pointer", border: "1px solid var(--hair-200)", background: filter === f.key ? undefined : "#fff" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        <div className="admin-players-table">
          <div className="admin-players-table-header">
            {["Name", "Email", "Phone", "City", "Series", "Skill", "Payment", "Registered"].map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
          {loading ? (
            <div style={{ padding: 20, color: "var(--ink-500)" }}>Loading registrations…</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: 20, color: "var(--ink-500)" }}>
              {rows.length === 0 ? "No registrations yet." : "No registrations match this filter."}
            </div>
          ) : (
            filteredRows.map((r) => (
              <div key={r.id} className="admin-players-row">
                <div>
                  <span className="admin-mobile-label">Name</span>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)" }}>{r.full_name ?? "—"}</p>
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
                  <span className="admin-mobile-label">City</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.city ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Series</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{r.series ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Skill</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)", textTransform: "capitalize" }}>{r.skill_level ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Payment</span>
                  <span className={`badge ${PAID_BADGE[r.paid_status] ?? "badge-mute"}`} style={{ alignSelf: "center" }}>{r.paid_status}</span>
                </div>
                <div>
                  <span className="admin-mobile-label">Registered</span>
                  <p style={{ fontSize: 12, color: "var(--ink-500)" }}>{formatDate(r.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
