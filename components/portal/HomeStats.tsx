"use client";

import { useEffect, useState } from "react";
import type { MyStats } from "@/app/api/portal/my-stats/route";

// Live Rank / Points / Games-played tiles for the logged-in player, fetched
// from the service-role-only /api/portal/my-stats route. Until it loads (and
// for a player with no standing yet) rank shows "—" and the others show 0.
export default function HomeStats() {
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
  }, []);

  const tiles = [
    { label: "Rank", value: stats && stats.rank != null ? `#${stats.rank}` : "—" },
    { label: "Points", value: stats ? stats.score : 0 },
    { label: "Games played", value: stats ? stats.rounds : 0 },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
      {tiles.map((stat) => (
        <div
          key={stat.label}
          style={{
            background: "#fff",
            border: "1px solid var(--hair-200)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 12px",
            textAlign: "center",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <p style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--pink-700)", lineHeight: 1 }}>{stat.value}</p>
          <p style={{ fontSize: 11, color: "var(--ink-500)", marginTop: 4 }}>{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
