import Link from "next/link";
import { CalendarDays, MapPin, Trophy, Plus } from "lucide-react";
import { getPortalUser } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getNextTable } from "@/lib/portal/tables";
import { getRegisterCityOptions } from "@/lib/portal/registerCity";
import HomeStats from "@/components/portal/HomeStats";
import { formatTableTime } from "@/lib/format/time";

function greeting(name: string) {
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name}`;
}

export default async function PortalDashboard() {
  const session = await getPortalUser();
  // Admins have no home city; withAdminCity fills in their active-city
  // selection (a no-op for regular members).
  const member = session && session.status === "active" ? await withAdminCity(session) : null;
  const next = member ? await getNextTable(member) : null;
  const nextTable = next?.table ?? null;
  const firstName = (member?.full_name ?? "").trim().split(" ")[0] || "there";

  // Regular players can register for more cities in the active series; only
  // surface the prompt when at least one city is still eligible.
  const addCity = session?.status === "active" && !session.isAdmin ? await getRegisterCityOptions(session.memberships) : null;
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
              Round {nextTable.week_number} · Your next table
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

      {/* Stats — activeCityId drives a re-fetch when an admin switches cities */}
      <HomeStats activeCityId={member?.city_id ?? null} />

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
