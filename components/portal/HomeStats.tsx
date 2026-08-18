"use client";

import { useEffect, useState } from "react";
import type { MyStats } from "@/app/api/portal/my-stats/route";

// The logged-in player's season stats for the home screen: a Games-played tile
// plus a card per award system (Ace / Champion / Flight Winner), each with its
// own score + rank — full parity with the profile page's "Current season"
// section (same values, same decimal places), fetched from the service-role-only
// /api/portal/my-stats route. Until it loads (and for a player with no standing
// yet) scores show 0 and ranks show "—".
//
// activeCityId is the city the page is currently showing (an admin's active
// city, or a regular member's own city). It's in the effect deps so switching
// cities via the app-bar switcher re-fetches this player's stats for the new
// city instead of leaving the tiles stale.
const cardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--hair-200)",
  borderRadius: "var(--radius-lg)",
  padding: "14px 16px",
  boxShadow: "var(--shadow-xs)",
};
const valueStyle: React.CSSProperties = { fontFamily: "var(--font-display)", fontSize: 24, color: "var(--pink-700)", lineHeight: 1 };
const labelStyle: React.CSSProperties = { fontSize: 11, color: "var(--ink-500)", marginTop: 4 };
const awardLabelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
  color: "var(--ink-500)", marginBottom: 10,
};

export default function HomeStats({ activeCityId = null }: { activeCityId?: string | null }) {
  const [stats, setStats] = useState<MyStats | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/portal/my-stats", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.stats) setStats(json.stats);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [activeCityId]);

  const rounds = stats?.rounds ?? 0;
  // Score formatting matches the profile page exactly, award-for-award: Ace is a
  // plain integer, Champion 1dp, Flight Winner 2dp (commonly "—" rank under the
  // 5-round minimum). Ranks show "#N" or "—" when unranked.
  const awards = [
    { label: "Ace Award", score: String(stats?.ace.score ?? 0), rank: stats?.ace.rank ? `#${stats.ace.rank}` : "—" },
    { label: "Champion Award", score: (stats?.champion.score ?? 0).toFixed(1), rank: stats?.champion.rank ? `#${stats.champion.rank}` : "—" },
    { label: "Flight Winner", score: (stats?.flightWinner.score ?? 0).toFixed(2), rank: stats?.flightWinner.rank ? `#${stats.flightWinner.rank}` : "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <p style={valueStyle}>{rounds}</p>
        <p style={labelStyle}>Games played</p>
      </div>

      {awards.map((a) => (
        <div key={a.label} style={cardStyle}>
          <p style={awardLabelStyle}>{a.label}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ textAlign: "center" }}>
              <p style={valueStyle}>{a.score}</p>
              <p style={labelStyle}>Score</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={valueStyle}>{a.rank}</p>
              <p style={labelStyle}>Rank</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
