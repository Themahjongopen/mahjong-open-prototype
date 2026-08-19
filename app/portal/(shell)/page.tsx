import Link from "next/link";
import { CalendarDays, MapPin, Trophy, Plus, Printer } from "lucide-react";
import { getPortalClaims } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getNextTable } from "@/lib/portal/tables";
import { getRegisterCityOptions } from "@/lib/portal/registerCity";
import { getMyStats, EMPTY_STATS } from "@/lib/portal/myStats";
import HomeStats from "@/components/portal/HomeStats";
import { formatTableTime } from "@/lib/format/time";

// Greet by name only — no time-of-day. A server component runs on the server's
// clock (Vercel = UTC), not the viewer's local time, so `new Date().getHours()`
// here would give a Central-time player "Good evening" mid-afternoon. Sidestep
// the whole timezone problem rather than plumb the client's clock through.
function greeting(name: string) {
  return `Hello, ${name}`;
}

export default async function PortalDashboard() {
  // Read-only dashboard: locally-verified claims are enough (no getUser round-trip).
  const session = await getPortalClaims();
  // Admins have no home city; withAdminCity fills in their active-city
  // selection (a no-op for regular members).
  const member = session && session.status === "active" ? await withAdminCity(session) : null;

  // These three reads are independent — run them in parallel rather than
  // sequentially. getMyStats is computed here (server-side, reusing this
  // request's auth) and passed to HomeStats, instead of the client re-fetching
  // it through /api/portal/my-stats (a second invocation + a second getUser()).
  const [next, addCity, stats] = member
    ? await Promise.all([
        getNextTable(member),
        // Regular players can register for more cities; admins can't.
        member.isAdmin ? Promise.resolve(null) : getRegisterCityOptions(member.memberships),
        getMyStats(member.id, member.series_id, member.city_id),
      ])
    : [null, null, EMPTY_STATS];

  const nextTable = next?.table ?? null;
  const firstName = (member?.full_name ?? "").trim().split(" ")[0] || "there";
  const canAddCity = !!addCity?.series && !addCity.registrationClosed && addCity.eligibleCities.length > 0;

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontSize: 22, fontFamily: "var(--font-display)", color: "var(--ink-900)", marginBottom: 20 }}>
        {greeting(firstName)}
      </p>

      {/* Next table hero card */}
      {nextTable ? (
        <Link href={`/portal/tables/${nextTable.id}`} style={{ textDecoration: "none", display: "block", marginBottom: 20 }}>
          <div
            style={{
              background: "linear-gradient(135deg, var(--pink-600) 0%, var(--pink-400) 100%)",
              borderRadius: "var(--radius-xl)",
              padding: "24px",
              color: "#fff",
              boxShadow: "var(--shadow-pink)",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(234,242,242,0.7)", marginBottom: 12 }}>
              Week {nextTable.week_number} · Your next table
            </p>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarDays size={16} color="rgba(234,242,242,0.8)" />
                <span style={{ fontSize: 15 }}>
                  {new Date(`${nextTable.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  {nextTable.table_time ? ` · ${formatTableTime(nextTable.table_time)}` : ""}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MapPin size={16} color="rgba(234,242,242,0.8)" />
                <span style={{ fontSize: 15 }}>{nextTable.location_name}</span>
              </div>
            </div>
            <p style={{ fontSize: 13, marginTop: 12, color: "rgba(234,242,242,0.7)" }}>
              Seat {next?.seat_number} · Tap for details →
            </p>
          </div>
        </Link>
      ) : null}

      {/* Stats computed server-side above; the dashboard re-renders (router.refresh)
          on an admin/multi-city switch, so these refresh without a client fetch. */}
      <HomeStats stats={stats} />

      {/* Quick actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <Link href="/portal/tables" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 14, borderRadius: "var(--radius-lg)", padding: "12px" }}>
          <CalendarDays size={16} /> Open tables
        </Link>
        <Link href="/portal/tables/create" className="btn btn-primary" style={{ justifyContent: "center", fontSize: 14, borderRadius: "var(--radius-lg)", padding: "12px" }}>
          <Plus size={16} /> Create table
        </Link>
        <Link href="/portal/standings" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 14, borderRadius: "var(--radius-lg)", padding: "12px" }}>
          <Trophy size={16} /> Standings
        </Link>
        <Link href="/portal/my-tables" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 14, borderRadius: "var(--radius-lg)", padding: "12px" }}>
          My tables
        </Link>
        {/* Static two-up official scorecard (one print = two cards). Full-width
            secondary row below the 2×2 so it doesn't reshuffle the grid or compete
            with Create table. Opens in a new tab (friendlier than a download on
            iOS); `download` is a desktop save fallback. */}
        <a href="/scorecard.pdf" target="_blank" rel="noopener noreferrer" download className="btn btn-ghost" style={{ gridColumn: "1 / -1", justifyContent: "center", fontSize: 14, borderRadius: "var(--radius-lg)", padding: "12px" }}>
          <Printer size={16} /> Print a scorecard
        </a>
      </div>

      {canAddCity ? (
        <div style={{ background: "var(--pink-50)", border: "1px solid var(--pink-100)", borderRadius: "var(--radius-lg)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pink-600)", marginBottom: 4 }}>Play in an additional city</p>
            <p style={{ fontSize: 13, color: "var(--ink-700)", margin: 0 }}>Want to play in more than one city? Register for another city this series. Use code <strong>2NDCITY</strong> at checkout to register in your second city for only $35.</p>
          </div>
          <Link href="/portal/register-city" className="btn btn-primary" style={{ fontSize: 13, padding: "10px 14px", whiteSpace: "nowrap" }}>
            Add city
          </Link>
        </div>
      ) : null}

      <div style={{ background: "var(--pink-50)", border: "1px solid var(--pink-100)", borderRadius: "var(--radius-lg)", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--pink-600)", marginBottom: 4 }}>Handbook</p>
          <p style={{ fontSize: 13, color: "var(--ink-700)", margin: 0 }}>Review the latest Mahjong Open rulebook before your next game.</p>
        </div>
        <a href="/handbook/the-mahjong-open-handbook-2026.pdf" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 13, padding: "10px 14px", whiteSpace: "nowrap" }}>
          Rulebook
        </a>
      </div>

      {/* Pinned announcement */}
    </div>
  );
}
