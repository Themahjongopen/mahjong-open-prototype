"use client";

import { useEffect, useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { csvField } from "@/lib/format/csv";
import { formatCreditedTo } from "@/lib/registration/creditLabel";

const PAID_BADGE: Record<string, string> = { paid: "badge-lime", pending: "badge-butter" };
// Same skill → badge-color map used on OpenTableCard / TableDetailClient. NOTE:
// this is now a 3rd copy of the same 4-line object — worth extracting to a
// shared constant someday (flagged, not blocking).
const SKILL_COLORS: Record<string, string> = {
  beginner: "badge-lime",
  intermediate: "badge-peri",
  advanced: "badge-pink",
};

type Attribution = { profile_id: string; full_name: string | null };
type Row = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  paid_status: string;
  created_at: string;
  profiles: { hometown: string | null; skill_level: string | null } | null;
  attributions: Attribution[];
};
type Filter = "all" | "paid" | "pending";
type Level = "all" | "beginner" | "intermediate" | "advanced";
// Credit filter: everyone (default) · only players credited to the viewer · only
// players with no commissioner credit at all.
type Credit = "all" | "mine" | "unattributed";

// The label shown in the "Credited to" column / exports for one player — same
// wording everywhere via the shared helper.
function creditLabel(row: Row): string {
  return formatCreditedTo(row.attributions.map((a) => a.full_name), row.paid_status);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Export columns match the on-screen table's own columns.
const EXPORT_HEADERS = ["Name", "Hometown", "Email", "Phone", "Level", "Payment status", "Registered date", "Credited to"];

// <city-name>-players-<YYYY-MM-DD>.<ext>, city slugified for a clean filename.
function exportFilename(cityName: string | null, ext: string) {
  const slug = (cityName ?? "city").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "city";
  return `${slug}-players-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export default function CommissionerPlayersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cityName, setCityName] = useState<string | null>(null);
  const [viewerProfileId, setViewerProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [levelFilter, setLevelFilter] = useState<Level>("all");
  const [creditFilter, setCreditFilter] = useState<Credit>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/commissioner/players", { credentials: "include" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        setRows(payload.players ?? []);
        setCityName(payload.cityName ?? null);
        setViewerProfileId(payload.viewerProfileId ?? null);
      }
      setLoading(false);
    })();
  }, []);

  // Is this player credited to the commissioner viewing the page?
  const creditedToMe = (r: Row) => !!viewerProfileId && r.attributions.some((a) => a.profile_id === viewerProfileId);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.paid_status !== filter) return false;
      if (levelFilter !== "all" && r.profiles?.skill_level !== levelFilter) return false;
      if (creditFilter === "mine" && !creditedToMe(r)) return false;
      if (creditFilter === "unattributed" && r.attributions.length > 0) return false;
      if (q && !`${r.full_name ?? ""} ${r.email} ${r.phone ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // creditedToMe closes over viewerProfileId, so that's the real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, levelFilter, creditFilter, search, viewerProfileId]);

  const paidCount = rows.filter((r) => r.paid_status === "paid").length;
  const pendingCount = rows.filter((r) => r.paid_status === "pending").length;
  // "N of M credited to you" — M is the whole roster (the list stays whole-city;
  // this only counts, it does not narrow the default view).
  const creditedToMeCount = rows.filter(creditedToMe).length;

  // One matrix (matching EXPORT_HEADERS) drives both CSV and PDF, so they never
  // drift. Built from filteredRows — exports exactly what's on screen.
  const exportMatrix = () =>
    filteredRows.map((r) => [
      r.full_name ?? "",
      r.profiles?.hometown ?? "",
      r.email,
      r.phone ?? "",
      r.profiles?.skill_level ?? "",
      r.paid_status,
      formatDate(r.created_at),
      creditLabel(r),
    ]);

  function handleExportCsv() {
    const lines = [EXPORT_HEADERS.join(",")];
    for (const row of exportMatrix()) lines.push(row.map((c) => csvField(c)).join(","));
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = exportFilename(cityName, "csv");
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function handleExportPdf() {
    // Landscape — seven columns with wide email/hometown fields read better wide.
    const doc = new jsPDF({ orientation: "landscape" });
    const title = cityName ? `${cityName} players` : "Players";
    const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    doc.setFontSize(14);
    doc.text(title, 14, 16);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(today, 14, 22);
    autoTable(doc, {
      head: [EXPORT_HEADERS],
      body: exportMatrix(),
      startY: 27,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [236, 70, 110] }, // --pink-500
    });
    doc.save(exportFilename(cityName, "pdf"));
  }

  return (
    <div>
      <p className="body-lg" style={{ marginBottom: 4, color: "var(--ink-700)" }}>
        {paidCount} paid · {pendingCount} pending
      </p>
      {/* Attribution summary — a quiet second line under the paid/pending count, so
          it adds context without crowding the filter row below. */}
      <p style={{ fontSize: 14, color: "var(--ink-500)", marginBottom: 16 }}>
        {creditedToMeCount} of {rows.length} credited to you
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
        <select
          value={creditFilter}
          onChange={(e) => setCreditFilter(e.target.value as Credit)}
          aria-label="Filter by attribution"
          className="input-mo"
          style={{ fontSize: 13, padding: "6px 10px", maxWidth: 200 }}
        >
          <option value="all">All players</option>
          <option value="mine">Credited to you</option>
          <option value="unattributed">Unattributed</option>
        </select>
        <button type="button" className="btn" onClick={handleExportCsv} disabled={filteredRows.length === 0} style={{ fontSize: 13 }}>
          Export CSV
        </button>
        <button type="button" className="btn" onClick={handleExportPdf} disabled={filteredRows.length === 0} style={{ fontSize: 13 }}>
          Download PDF
        </button>
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
            {["Name", "Hometown", "Email", "Phone", "Level", "Payment", "Registered", "Credited to"].map((h) => (
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
                <div>
                  <span className="admin-mobile-label">Credited to</span>
                  {r.attributions.length > 0 ? (
                    <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{creditLabel(r)}</p>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--ink-500)" }}>{creditLabel(r)}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
