import Link from "next/link";
import { Plus } from "lucide-react";
import { getPortalUser } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getOpenTables, getAllTables, getCityName, type LeagueTable } from "@/lib/portal/tables";
import OpenTableCard from "@/components/portal/OpenTableCard";

export default async function TablesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showAll = view === "all";
  const session = await getPortalUser();
  // Admins have no home city; the table reads reflect their active-city selection.
  const member = session && session.status === "active" ? await withAdminCity(session) : null;
  const [tables, cityName] = member
    ? await Promise.all([showAll ? getAllTables(member) : getOpenTables(member), getCityName(member.city_id)])
    : [[] as LeagueTable[], null];

  const byWeek = tables.reduce<Record<number, LeagueTable[]>>((acc, t) => {
    (acc[t.week_number] ??= []).push(t);
    return acc;
  }, {});

  // Open/All view toggle. Server-side URL param (no client state) so the page
  // stays a server component. Default (no param) is "Open" — byte-identical to
  // the pre-toggle behavior.
  const TOGGLE_BASE: React.CSSProperties = {
    flex: 1, textAlign: "center", padding: "7px 12px", fontSize: 13, fontWeight: 600,
    borderRadius: "999px", textDecoration: "none", transition: "background 120ms, color 120ms",
  };
  const activeStyle: React.CSSProperties = { ...TOGGLE_BASE, background: "var(--pink-500)", color: "#fff" };
  const inactiveStyle: React.CSSProperties = { ...TOGGLE_BASE, background: "transparent", color: "var(--ink-700)" };

  return (
    <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          {cityName ? <p className="eyebrow" style={{ marginBottom: 4 }}>{cityName}</p> : null}
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>Tables</h2>
        </div>
        <Link href="/portal/tables/create" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Create
        </Link>
      </div>

      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--hair-200)", borderRadius: "999px", marginBottom: 24 }}>
        <Link href="/portal/tables" style={showAll ? inactiveStyle : activeStyle}>Open</Link>
        <Link href="/portal/tables?view=all" style={showAll ? activeStyle : inactiveStyle}>All</Link>
      </div>

      {tables.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-500)" }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>{showAll ? "No tables at all right now." : "No open tables right now."}</p>
          <Link href="/portal/tables/create" className="btn btn-primary" style={{ fontSize: 14, display: "inline-flex" }}>
            Create the first one →
          </Link>
        </div>
      )}

      {Object.entries(byWeek).map(([week, weekTables]) => (
        <div key={week} style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--lime-600)", marginBottom: 12 }}>
            Round {week}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {weekTables.map((table) => (
              <OpenTableCard key={table.id} table={table} currentUserId={member?.id ?? null} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
