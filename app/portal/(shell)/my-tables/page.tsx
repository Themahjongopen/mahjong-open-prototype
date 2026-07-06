import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import { getMyTables } from "@/lib/data";
import { getDemoUser } from "@/lib/data/auth";

const STATUS_COLORS: Record<string, string> = {
  open: "badge-lime", full: "badge-peri", completed: "badge-mute", canceled: "badge-mute",
};

export default async function MyTablesPage() {
  const user = getDemoUser();
  const allSeats = await getMyTables(user.id);
  const today = new Date().toISOString().slice(0, 10);

  const upcoming = allSeats.filter((s) => s.scramble_tables.table_date >= today);
  const past = allSeats.filter((s) => s.scramble_tables.table_date < today);

  function TableRow({ seat }: { seat: (typeof allSeats)[0] }) {
    const table = seat.scramble_tables;
    return (
      <Link href={`/portal/tables/${table.id}`} style={{ textDecoration: "none" }}>
        <div style={{
          background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)",
          padding: "14px 16px", boxShadow: "var(--shadow-xs)",
          display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <span className="badge badge-mute">Week {table.week_number}</span>
              <span className={`badge ${STATUS_COLORS[table.status] ?? "badge-mute"}`}>{table.status}</span>
              {table.creator_id === user.id && <span className="badge badge-butter">Creator</span>}
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", marginBottom: 4 }}>
              {new Date(table.table_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink-500)" }}>
                <CalendarDays size={12} /> {table.table_time.slice(0, 5)}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink-500)" }}>
                <MapPin size={12} /> {table.location_name}
              </span>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Seat {seat.seat_number}</span>
        </div>
      </Link>
    );
  }

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 20 }}>
        My Tables
      </h2>

      {allSeats.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-500)" }}>
          <p style={{ marginBottom: 16 }}>You haven&rsquo;t joined any tables yet.</p>
          <Link href="/portal/tables" className="btn btn-primary" style={{ fontSize: 14, display: "inline-flex" }}>
            Browse open tables →
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--lime-600)", marginBottom: 12 }}>
            Upcoming
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcoming.map((s, i) => <TableRow key={i} seat={s} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-500)", marginBottom: 12 }}>
            Past
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {past.map((s, i) => <TableRow key={i} seat={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}
