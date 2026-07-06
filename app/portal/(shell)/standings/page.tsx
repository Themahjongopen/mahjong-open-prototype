import { getStandings, getMembership, getWeeklyTopScores, getAdminConsoleData } from "@/lib/data";
import { getDemoUser } from "@/lib/data/auth";

export default async function StandingsPage() {
  const user = getDemoUser();
  const [standingRows, membership, weeklyTopScores, adminConsole] = await Promise.all([
    getStandings(),
    getMembership(user.id),
    getWeeklyTopScores(),
    getAdminConsoleData(),
  ]);
  const cityName = membership?.cities?.name ?? "Hattiesburg";
  const seasonName = membership?.seasons?.name ?? "The Mahjong Open — 2026 — Series One";

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <p className="eyebrow" style={{ marginBottom: 4 }}>{cityName}</p>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>{seasonName} Standings</h2>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "6px 10px", borderRadius: "999px", background: "var(--pink-50)", color: "var(--pink-700)", fontSize: 12, fontWeight: 700 }}>
          {adminConsole.topFinisher.badge}: {adminConsole.topFinisher.player}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 60px 64px", padding: "10px 16px", borderBottom: "1px solid var(--hair-200)", gap: 8 }}>
          { ["#", "Player", "Avg", "Games"].map((h) => (
            <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</p>
          ))}
        </div>

        {standingRows
          .slice()
          .sort((a, b) => (b.total_points / b.tables_played) - (a.total_points / a.tables_played))
          .map((row, i) => {
            const isMe = row.user_id === user.id;
            const name = row.profiles?.full_name ?? "Player";
            const avg = row.tables_played ? row.total_points / row.tables_played : 0;
            return (
            <div
              key={row.user_id}
              style={{
                display: "grid",
                gridTemplateColumns: "36px 1fr 60px 64px",
                padding: "12px 16px",
                borderBottom: i < standingRows.length - 1 ? "1px solid var(--hair-200)" : "none",
                alignItems: "center",
                gap: 8,
                background: isMe ? "var(--pink-50)" : "#fff",
              }}
            >
              <p style={{ fontSize: 15, fontFamily: "var(--font-display)", color: row.rank === 1 ? "var(--crimson-500)" : "var(--ink-700)" }}>
                {row.rank}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: isMe ? "var(--pink-400)" : "var(--paper-100)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: isMe ? "#fff" : "var(--ink-700)",
                  flexShrink: 0,
                }}>
                  {name[0]}
                </div>
                <p style={{ fontSize: 14, fontWeight: isMe ? 600 : 400, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {isMe ? "You" : name.split(" ")[0]}
                </p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{avg.toFixed(1)}</p>
              <p style={{ fontSize: 13, color: "var(--ink-500)" }}>{row.tables_played}</p>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 16, textAlign: "center" }}>
        Updated in real time by average score · {cityName} · {seasonName}
      </p>

      <section style={{ marginTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 4 }}>Weekly leaderboard</p>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: 0 }}>Top 2 scores this series</h3>
          </div>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {weeklyTopScores.map((weekData) => (
            <div key={weekData.week} style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: "16px", boxShadow: "var(--shadow-xs)" }}>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--lime-600)", marginBottom: 10 }}>Round {weekData.week}</p>
              {weekData.top.map((item, index) => (
                <div key={item.player} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: index > 0 ? "1px solid var(--hair-200)" : "none" }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", margin: 0 }}>{item.player}</p>
                    <p style={{ fontSize: 12, color: "var(--ink-500)", margin: 0 }}>{item.location} · {new Date(item.tableDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "var(--pink-700)", margin: 0 }}>{item.points}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
