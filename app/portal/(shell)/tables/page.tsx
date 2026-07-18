import Link from "next/link";
import { MapPin, Clock, Users, Plus } from "lucide-react";
import { getPortalUser } from "@/lib/portal/session";
import { getOpenTables, activeSeats, type LeagueTable } from "@/lib/portal/tables";

const SKILL_COLORS: Record<string, string> = {
  beginner: "badge-lime",
  intermediate: "badge-peri",
  advanced: "badge-pink",
};

export default async function TablesPage() {
  const session = await getPortalUser();
  const member = session && session.status === "active" ? session : null;
  const openTables = member ? await getOpenTables(member) : [];

  const byWeek = openTables.reduce<Record<number, LeagueTable[]>>((acc, t) => {
    (acc[t.week_number] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>Open Tables</h2>
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
            {weekTables.map((table) => {
              const filled = activeSeats(table.table_seats).length;
              const seatsLeft = 4 - filled;
              const isSeated = activeSeats(table.table_seats).some((s) => s.user_id === member?.id);

              return (
                <Link key={table.id} href={`/portal/tables/${table.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      background: "#fff",
                      border: isSeated ? "2px solid var(--pink-300)" : "1px solid var(--hair-200)",
                      borderRadius: "var(--radius-lg)",
                      padding: "16px 18px",
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", marginBottom: 2 }}>
                          {new Date(`${table.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                        </p>
                        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                          {table.table_time ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink-500)" }}>
                              <Clock size={12} /> {table.table_time.slice(0, 5)}
                            </span>
                          ) : null}
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink-500)" }}>
                            <MapPin size={12} /> {table.location_name}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                        {table.skill_level && (
                          <span className={`badge ${SKILL_COLORS[table.skill_level] ?? "badge-mute"}`}>{table.skill_level}</span>
                        )}
                        {isSeated && <span className="badge badge-pink">Joined</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                      <Users size={13} color="var(--ink-500)" />
                      <div style={{ display: "flex", gap: 4 }}>
                        {[1, 2, 3, 4].map((n) => (
                          <div
                            key={n}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: "50%",
                              background: n <= filled ? "var(--pink-400)" : "var(--hair-200)",
                              border: "2px solid #fff",
                            }}
                          />
                        ))}
                      </div>
                      <span style={{ color: seatsLeft === 0 ? "var(--danger)" : "var(--ink-500)" }}>
                        {seatsLeft === 0 ? "Full" : `${seatsLeft} spot${seatsLeft !== 1 ? "s" : ""} left`}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
