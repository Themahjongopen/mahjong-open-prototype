import { getAdminTables } from "@/lib/admin/tables";

const STATUS_BADGE: Record<string, string> = { open: "badge-lime", full: "badge-peri", completed: "badge-mute", canceled: "badge-mute" };

export default async function AdminTablesPage() {
  const rows = await getAdminTables();

  return (
    <div style={{ maxWidth: 1100 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 8 }}>All Tables</h1>
      <p style={{ fontSize: 15, color: "var(--ink-500)", marginBottom: 32 }}>{rows.length} table{rows.length !== 1 ? "s" : ""}</p>

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        <div className="admin-tables-table">
          <div className="admin-tables-table-header">
            {["Wk", "Table", "City · Series", "Host", "Status", "Seats"].map((h) => (
              <p key={h}>{h}</p>
            ))}
          </div>
          {rows.length === 0 ? (
            <div style={{ padding: 20, color: "var(--ink-500)", fontSize: 14 }}>No tables have been created yet.</div>
          ) : (
            rows.map((t) => (
              <div key={t.id} className="admin-tables-row">
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-500)" }}>W{t.week_number}</p>
                <div>
                  <span className="admin-mobile-label">Table</span>
                  <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)" }}>{t.location_name}</p>
                  <p style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    {new Date(`${t.table_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {t.table_time ? ` · ${t.table_time.slice(0, 5)}` : ""}
                  </p>
                </div>
                <div>
                  <span className="admin-mobile-label">City · Series</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{[t.city_name, t.series_name].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Host</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{t.creator_name ?? "—"}</p>
                </div>
                <div>
                  <span className="admin-mobile-label">Status</span>
                  <span className={`badge ${STATUS_BADGE[t.status] ?? "badge-mute"}`}>{t.status}</span>
                </div>
                <div>
                  <span className="admin-mobile-label">Seats</span>
                  <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{t.active_seats}/4</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
