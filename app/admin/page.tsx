"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Users, DollarSign, Sparkles, ArrowUpRight } from "lucide-react";
import { getAdminConsoleData } from "@/lib/data";
import { getDemoUser } from "@/lib/data/auth";

const SHORTCUTS = [
  { label: "Manage cities", href: "/admin/cities" },
  { label: "Manage series", href: "/admin/series" },
  { label: "View players", href: "/admin/players" },
  { label: "All tables", href: "/admin/tables" },
];

type AdminConsoleData = Awaited<ReturnType<typeof getAdminConsoleData>>;

export default function AdminDashboard() {
  const user = getDemoUser();
  const [consoleData, setConsoleData] = useState<AdminConsoleData | null>(null);
  const [viewAsPlayer, setViewAsPlayer] = useState(false);

  useEffect(() => {
    let active = true;
    getAdminConsoleData().then((data) => {
      if (active) setConsoleData(data);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!consoleData) {
    return <div style={{ color: "var(--ink-600)" }}>Loading admin console…</div>;
  }

  const metricCards = [
    { label: "Registrations this series", value: consoleData.metrics.registrationsThisSeries },
    { label: "Registrations all-time", value: consoleData.metrics.registrationsAllTime },
    { label: "Active players", value: consoleData.metrics.activePlayers },
    { label: "Revenue this month", value: `$${consoleData.metrics.revenueThisMonth.toLocaleString()}` },
    { label: "Revenue this series", value: `$${consoleData.metrics.revenueThisSeries.toLocaleString()}` },
    { label: "Active cities", value: consoleData.metrics.activeCities },
    { label: "Table fill rate", value: `${Math.round(consoleData.metrics.tableFillRate * 100)}%` },
  ];

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ background: "var(--ink-900)", color: "#fff", borderRadius: "var(--radius-lg)", padding: "24px 24px 28px", marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(234,242,242,0.55)", marginBottom: 6 }}>Admin Console</p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 400, color: "#fff", marginBottom: 6 }}>Operations overview</h1>
            <p style={{ fontSize: 14, color: "rgba(234,242,242,0.72)", margin: 0 }}>Sample dashboard numbers for the preview-only admin experience.</p>
          </div>
          <button
            type="button"
            onClick={() => setViewAsPlayer((prev) => !prev)}
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.16)", color: "#fff", borderRadius: "999px", padding: "10px 14px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Eye size={16} /> {viewAsPlayer ? "Back to console" : "View as player"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {consoleData.scopes.map((scope) => (
            <div key={scope.label} style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "999px", padding: "8px 12px", fontSize: 12, color: "rgba(234,242,242,0.8)" }}>
              <strong style={{ color: "#fff" }}>{scope.label}:</strong> {scope.value}
            </div>
          ))}
        </div>
      </div>

      {viewAsPlayer ? (
        <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-sm)" }}>
          <p className="eyebrow" style={{ marginBottom: 8 }}>Player preview</p>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 8 }}>Portal view for {user.full_name}</h2>
          <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 16 }}>
            This is a preview-only player view so admins can check the home experience without leaving the console.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/portal" className="btn btn-primary" style={{ justifyContent: "center" }}>Open portal home</Link>
            <a href="/rulebook" className="btn btn-ghost" style={{ justifyContent: "center" }}>Open rulebook</a>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 24 }}>
          <div className="admin-dashboard-metrics">
            {metricCards.map((metric) => (
              <div key={metric.label} style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 16, boxShadow: "var(--shadow-xs)" }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-500)", marginBottom: 8 }}>{metric.label}</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-900)", margin: 0 }}>{metric.value}</p>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>Role scoping</p>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink-900)", margin: 0 }}>Admin access</h2>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--pink-600)", fontSize: 13, fontWeight: 600 }}>
                <Users size={16} /> {consoleData.roles.length} roles
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {consoleData.roles.map((item) => (
                <div key={item.role} style={{ border: "1px solid var(--hair-200)", borderRadius: "var(--radius-md)", padding: "12px 14px", background: "var(--paper-50)" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", marginBottom: 2 }}>{item.role}</p>
                  <p style={{ fontSize: 13, color: "var(--ink-600)", margin: 0 }}>{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-dashboard-layout">
            <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>Preview insights</p>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink-900)", margin: 0 }}>What’s next</h2>
                </div>
                <Sparkles size={18} color="var(--pink-600)" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--hair-200)", paddingBottom: 10 }}>
                  <span style={{ fontSize: 14, color: "var(--ink-700)" }}>Top finisher badge</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pink-600)" }}>{consoleData.topFinisher.badge}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--hair-200)", paddingBottom: 10 }}>
                  <span style={{ fontSize: 14, color: "var(--ink-700)" }}>Current sample winner</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-900)" }}>{consoleData.topFinisher.player}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 14, color: "var(--ink-700)" }}>Future work</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-500)" }}>Refunds + payouts</span>
                </div>
              </div>
            </div>

            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--ink-900)", marginBottom: 16 }}>Quick links</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {SHORTCUTS.map((s) => (
                  <Link key={s.href} href={s.href} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-md)", textDecoration: "none", fontSize: 14, color: "var(--ink-800)", fontWeight: 500, boxShadow: "var(--shadow-xs)" }}>
                    {s.label} <ArrowUpRight size={15} color="var(--ink-500)" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
