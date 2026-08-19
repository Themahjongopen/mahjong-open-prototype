import { getPortalClaims } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getStandings, getCityStandings, byAceAward, byChampionAward, byFlightWinner, type StandingRow } from "@/lib/portal/standings";
import Avatar from "@/components/portal/Avatar";

const COLS = "36px 1fr 72px 64px";

// Same skill → badge-color map as OpenTableCard / the commissioner roster, with
// short labels (the stored values are the full words).
const SKILL_COLORS: Record<string, string> = {
  beginner: "badge-lime",
  intermediate: "badge-peri",
  advanced: "badge-pink",
};
const SKILL_ABBR: Record<string, string> = {
  beginner: "Beg",
  intermediate: "Int",
  advanced: "Adv",
};

function firstName(name: string | null) {
  return (name ?? "Player").split(" ")[0];
}

function Row({
  row,
  isMe,
  rank,
  value,
  last,
}: {
  row: StandingRow;
  isMe: boolean;
  rank: string;
  value: string;
  last: boolean;
}) {
  const name = row.full_name ?? "Player";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: COLS,
        padding: "12px 16px",
        borderBottom: last ? "none" : "1px solid var(--hair-200)",
        alignItems: "center",
        gap: 8,
        background: isMe ? "var(--pink-50)" : "#fff",
      }}
    >
      <p style={{ fontSize: 15, fontFamily: "var(--font-display)", color: rank === "1" ? "var(--crimson-500)" : "var(--ink-700)" }}>{rank}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <Avatar src={row.avatar_url} size={28} alt={name} />
        <p style={{ fontSize: 14, fontWeight: isMe ? 600 : 400, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isMe ? "You" : firstName(name)}
        </p>
        {row.skill_level ? (
          <span className={`badge ${SKILL_COLORS[row.skill_level] ?? "badge-mute"}`} style={{ fontSize: 10, flexShrink: 0 }}>
            {SKILL_ABBR[row.skill_level] ?? row.skill_level}
          </span>
        ) : null}
      </div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{value}</p>
      <p style={{ fontSize: 13, color: "var(--ink-500)" }}>{row.rounds_played}</p>
    </div>
  );
}

function Table({
  title,
  subtitle,
  valueHeader,
  rows,
  meId,
  rankOf,
  valueOf,
}: {
  title: string;
  subtitle: string;
  valueHeader: string;
  rows: StandingRow[];
  meId: string | null;
  rankOf: (r: StandingRow) => string;
  valueOf: (r: StandingRow) => string;
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: 0 }}>{title}</h3>
        <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>{subtitle}</p>
      </div>
      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 16px", borderBottom: "1px solid var(--hair-200)", gap: 8 }}>
          {["#", "Player", valueHeader, "Rounds"].map((h) => (
            <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-500)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</p>
          ))}
        </div>
        {rows.length === 0 ? (
          <p style={{ padding: 20, color: "var(--ink-500)", fontSize: 14 }}>No members yet.</p>
        ) : (
          rows.map((row, i) => (
            <Row key={row.user_id} row={row} isMe={row.user_id === meId} rank={rankOf(row)} value={valueOf(row)} last={i === rows.length - 1} />
          ))
        )}
      </div>
    </section>
  );
}

export default async function StandingsPage() {
  // Read-only leaderboards: locally-verified claims are enough (no getUser round-trip).
  const session = await getPortalClaims();
  // Admins have no home city; getStandings reads their active-city selection.
  const member = session && session.status === "active" ? await withAdminCity(session) : null;
  const { cityName, rows } = member ? await getStandings(member) : { cityName: null, rows: [] };
  const cityStandings = member ? await getCityStandings(member.series_id ?? null) : [];
  const meId = member?.id ?? null;

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        {cityName ? <p className="eyebrow" style={{ marginBottom: 4 }}>{cityName}</p> : null}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>Standings</h2>
        <p style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 8 }}>Three leaderboards, updated live after each round is scored.</p>
      </div>

      <Table
        title="Ace Award"
        subtitle="Your single highest round score this series."
        valueHeader="Score"
        rows={byAceAward(rows)}
        meId={meId}
        rankOf={(r) => String(r.ace_award_rank ?? "—")}
        valueOf={(r) => String(r.ace_award_score)}
      />

      <Table
        title="Champion Award"
        subtitle="Your single highest round each week, summed across all 8 weeks."
        valueHeader="Score"
        rows={byChampionAward(rows)}
        meId={meId}
        rankOf={(r) => String(r.champion_award_rank ?? "—")}
        valueOf={(r) => r.champion_award_score.toFixed(1)}
      />

      <Table
        title="Flight Winner"
        subtitle="Total points ÷ total rounds across your best 7 of 8 weeks. Requires 5 rounds played to qualify."
        valueHeader="Avg"
        rows={byFlightWinner(rows)}
        meId={meId}
        rankOf={(r) => String(r.flight_winner_rank ?? "—")}
        valueOf={(r) => r.flight_winner_score.toFixed(2)}
      />

      {cityStandings.length > 0 ? (
        <section style={{ marginBottom: 28 }}>
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: 0 }}>City Leaderboard</h3>
            <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 2 }}>
              Top 3 individual round scores in each city, added together. The leading city is crowned The Mahjong Open Leader.
            </p>
          </div>
          <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
            {cityStandings.map((c, i) => (
              <div
                key={c.city_id}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "14px 16px",
                  borderBottom: i === cityStandings.length - 1 ? "none" : "1px solid var(--hair-200)",
                  background: c.city_rank === 1 ? "var(--crimson-50)" : "#fff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <p style={{ fontSize: 15, fontFamily: "var(--font-display)", color: c.city_rank === 1 ? "var(--crimson-500)" : "var(--ink-700)", margin: 0 }}>
                    {c.city_rank ?? "—"}
                  </p>
                  <p style={{ fontSize: 14, color: "var(--ink-900)", margin: 0 }}>{c.city_name}</p>
                  {c.city_rank === 1 ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--crimson-600)", background: "var(--crimson-100)", border: "1px solid var(--crimson-400)", borderRadius: 999, padding: "3px 8px", whiteSpace: "nowrap" }}>
                      The Mahjong Open Leader
                    </span>
                  ) : null}
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)" }}>{c.city_score}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
