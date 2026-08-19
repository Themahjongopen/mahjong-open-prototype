import type { MyStats } from "@/lib/portal/myStats";

// The logged-in player's season stats for the home screen: a Games-played tile
// plus a card per award system (Ace / Champion / Flight Winner), each with its
// own score + rank — full parity with the profile page's "Current season"
// section (same values, same decimal places). Now purely presentational: the
// dashboard Server Component computes the stats (reusing the request's auth) and
// passes them in, so there's no second client fetch / second getUser(). On an
// admin/multi-city switch the dashboard re-renders (router.refresh) with fresh
// stats, so no client effect is needed.
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

export default function HomeStats({ stats }: { stats: MyStats }) {
  // Score formatting matches the profile page exactly, award-for-award: Ace is a
  // plain integer, Champion 1dp, Flight Winner 2dp (commonly "—" rank under the
  // 5-round minimum). Ranks show "#N" or "—" when unranked.
  const awards = [
    { label: "Ace Award", score: String(stats.ace.score), rank: stats.ace.rank ? `#${stats.ace.rank}` : "—" },
    { label: "Champion Award", score: stats.champion.score.toFixed(1), rank: stats.champion.rank ? `#${stats.champion.rank}` : "—" },
    { label: "Flight Winner", score: stats.flightWinner.score.toFixed(2), rank: stats.flightWinner.rank ? `#${stats.flightWinner.rank}` : "—" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
      <div style={{ ...cardStyle, textAlign: "center" }}>
        <p style={valueStyle}>{stats.rounds}</p>
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
