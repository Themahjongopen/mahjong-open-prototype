import Link from "next/link";
import { Plus } from "lucide-react";
import { getPortalUser } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getOpenTables, getCityName, type LeagueTable } from "@/lib/portal/tables";
import OpenTableCard from "@/components/portal/OpenTableCard";

export default async function TablesPage() {
  const session = await getPortalUser();
  // Admins have no home city; getOpenTables reads their active-city selection.
  const member = session && session.status === "active" ? await withAdminCity(session) : null;
  const [openTables, cityName] = member
    ? await Promise.all([getOpenTables(member), getCityName(member.city_id)])
    : [[] as LeagueTable[], null];

  const byWeek = openTables.reduce<Record<number, LeagueTable[]>>((acc, t) => {
    (acc[t.week_number] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          {cityName ? <p className="eyebrow" style={{ marginBottom: 4 }}>{cityName}</p> : null}
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>Open Tables</h2>
        </div>
        <Link href="/portal/tables/create" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Create
        </Link>
      </div>

      {openTables.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-500)" }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>No open tables right now.</p>
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
