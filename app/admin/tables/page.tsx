"use client";

import { useEffect, useMemo, useState } from "react";
import { formatTableTime } from "@/lib/format/time";
import AdminCancelTableButton from "@/components/admin/AdminCancelTableButton";
import AdminRemovePlayerButton from "@/components/admin/AdminRemovePlayerButton";
import AdminRevertTableButton from "@/components/admin/AdminRevertTableButton";
import AdminSetWeekButton from "@/components/admin/AdminSetWeekButton";
import AdminAddPlayerButton from "@/components/admin/AdminAddPlayerButton";

const STATUS_BADGE: Record<string, string> = { open: "badge-lime", full: "badge-peri", completed: "badge-mute", canceled: "badge-mute" };

// Fixed status options — no need to derive from the data. Keys match STATUS_BADGE.
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "full", label: "Full" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
];

type TableRow = {
  id: string;
  week_number: number;
  table_date: string;
  table_time: string | null;
  location_name: string;
  status: string;
  city_id: string | null;
  city_name: string | null;
  series_id: string | null;
  series_name: string | null;
  creator_name: string | null;
  active_seats: number;
  held_seats: number;
  score_count: number;
  players: { seat_id: string; user_id: string; full_name: string | null; is_host: boolean }[];
};

export default function AdminTablesPage() {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Each filter holds an id / status / week ("all" = no filter).
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [seriesFilter, setSeriesFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [weekFilter, setWeekFilter] = useState<string>("all");
  const [playerSearch, setPlayerSearch] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/tables", { credentials: "include" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Tables could not be loaded.");
      setLoading(false);
      return;
    }
    setRows(Array.isArray(payload.tables) ? payload.tables : []);
    setError(null);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  // Distinct (city_id, label) pairs present in the loaded rows, sorted alphabetically.
  const cityOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) if (r.city_id) byId.set(r.city_id, r.city_name ?? r.city_id);
    return Array.from(byId, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // Distinct (series_id, label) pairs present in the loaded rows, sorted alphabetically.
  const seriesOptions = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) if (r.series_id) byId.set(r.series_id, r.series_name ?? r.series_id);
    return Array.from(byId, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [rows]);

  // Distinct week numbers present, sorted numerically.
  const weekOptions = useMemo(() => {
    const weeks = new Set<number>();
    for (const r of rows) if (typeof r.week_number === "number") weeks.add(r.week_number);
    return Array.from(weeks).sort((a, b) => a - b);
  }, [rows]);

  // All filters combine with AND: a row must match every active one to show.
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (cityFilter !== "all" && r.city_id !== cityFilter) return false;
      if (seriesFilter !== "all" && r.series_id !== seriesFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (weekFilter !== "all" && String(r.week_number) !== weekFilter) return false;
      // players (Part A) includes the host's own seat, so this one clause finds a
      // table whether the searched player is hosting it or a guest at it.
      if (playerSearch.trim()) {
        const q = playerSearch.trim().toLowerCase();
        if (!r.players.some((p) => (p.full_name ?? "").toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [rows, cityFilter, seriesFilter, statusFilter, weekFilter, playerSearch]);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 8 }}>All Tables</h1>
      <p style={{ fontSize: 15, color: "var(--ink-500)", marginBottom: 20 }}>
        {filteredRows.length} table{filteredRows.length !== 1 ? "s" : ""}
        {loading && rows.length > 0 ? <span style={{ marginLeft: 8, fontSize: 12, color: "var(--mute-400)" }}>Refreshing…</span> : null}
      </p>

      {/* Week / status / city / series filters */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <select aria-label="Filter by week" className="input-mo" style={{ maxWidth: 200 }} value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)}>
          <option value="all">All weeks</option>
          {weekOptions.map((w) => (
            <option key={w} value={String(w)}>Week {w}</option>
          ))}
        </select>
        <select aria-label="Filter by status" className="input-mo" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select aria-label="Filter by city" className="input-mo" style={{ maxWidth: 260 }} value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
          <option value="all">All cities</option>
          {cityOptions.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select aria-label="Filter by league" className="input-mo" style={{ maxWidth: 260 }} value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}>
          <option value="all">All leagues</option>
          {seriesOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
        <input
          type="search"
          className="input-mo"
          style={{ maxWidth: 240 }}
          placeholder="Search by player name"
          aria-label="Search by player name"
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
        />
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        <div className="admin-tables-table">
          <div className="admin-tables-table-header">
            {["Wk", "Table", "City · League", "Host", "Status", "Seats", "Actions"].map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
          {error ? (
            <div style={{ padding: 20, color: "var(--danger)", fontSize: 14 }}>{error}</div>
          ) : loading && rows.length === 0 ? (
            <div style={{ padding: 20, color: "var(--ink-500)", fontSize: 14 }}>Loading tables…</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ padding: 20, color: "var(--ink-500)", fontSize: 14 }}>
              {rows.length === 0 ? "No tables have been created yet." : "No tables match this filter."}
            </div>
          ) : (
            filteredRows.map((t) => (
              <div key={t.id} className="admin-tables-row">
                <div><span className="admin-mobile-label">Week</span><AdminSetWeekButton tableId={t.id} weekNumber={t.week_number} onUpdated={() => void load()} /></div>
                <div>
                  <span className="admin-mobile-label">Table</span>
                  {/* The table name opens the portal table detail page — where
                      Mark-as-played, score submission, and host handoff live (the
                      admin row itself only offers Cancel/Remove/Revert). Opens in a
                      new tab so the admin keeps their filter/search/scroll state.
                      Admins can view any table cross-city (getTableDetail bypasses
                      series scope for isAdmin). */}
                  <p style={{ fontSize: 14, margin: 0 }}>
                    <a
                      href={`/portal/tables/${t.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--pink-600)", fontWeight: 600, textDecoration: "none" }}
                    >
                      {t.location_name}
                    </a>
                  </p>
                  <p style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    {new Date(`${t.table_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {t.table_time ? ` · ${formatTableTime(t.table_time)}` : ""}
                  </p>
                </div>
                <div>
                  <span className="admin-mobile-label">City · League</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{[t.city_name, t.series_name].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Host</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{t.creator_name ?? "—"}</p>
                  {/* Other actively-seated players (host excluded — shown above).
                      Each guest gets an inline Remove control on open/full tables. */}
                  {t.players.filter((p) => !p.is_host).map((p) => (
                    <div key={p.seat_id} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 12, color: "var(--ink-500)" }}>
                      <span>{p.full_name ?? "—"}</span>
                      {(t.status === "open" || t.status === "full") && (
                        <AdminRemovePlayerButton
                          tableId={t.id}
                          seatId={p.seat_id}
                          playerName={p.full_name ?? "this player"}
                          onRemoved={() => void load()}
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <span className="admin-mobile-label">Status</span>
                  <span className={`badge ${STATUS_BADGE[t.status] ?? "badge-mute"}`}>{t.status}</span>
                </div>
                <div>
                  <span className="admin-mobile-label">Seats</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>
                    {t.active_seats}/4
                    {t.held_seats > 0 ? <span style={{ color: "var(--ink-500)" }}> · {t.held_seats} held</span> : null}
                  </p>
                </div>
                <div>
                  <span className="admin-mobile-label">Actions</span>
                  {/* Revert and Cancel are mutually exclusive by status: a completed
                      table can only be reverted (to unlock cancel), everything else
                      offers Cancel (which itself shows "—" on non-cancellable rows). */}
                  {t.status === "completed" ? (
                    <AdminRevertTableButton
                      tableId={t.id}
                      status={t.status}
                      locationName={t.location_name}
                      dateLabel={new Date(`${t.table_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      scoreCount={t.score_count}
                      onReverted={() => void load()}
                    />
                  ) : (
                    <AdminCancelTableButton
                      tableId={t.id}
                      status={t.status}
                      locationName={t.location_name}
                      dateLabel={new Date(`${t.table_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      onCanceled={() => void load()}
                    />
                  )}
                  {/* Seat a player from the console — only while the table can take
                      one (open/full); the server re-enforces status + capacity. */}
                  {(t.status === "open" || t.status === "full") && (
                    <AdminAddPlayerButton
                      tableId={t.id}
                      tableLabel={`${t.location_name} · ${new Date(`${t.table_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}${t.table_time ? ` · ${formatTableTime(t.table_time)}` : ""}`}
                      onAdded={() => void load()}
                    />
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
