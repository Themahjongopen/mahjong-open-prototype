import { getPortalUser } from "@/lib/portal/session";
import { getStandings, byCumulative, byAverage, type StandingRow } from "@/lib/portal/standings";

const COLS = "36px 1fr 72px 64px";

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
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: isMe ? "var(--pink-400)" : "var(--paper-100)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: isMe ? "#fff" : "var(--ink-700)", flexShrink: 0 }}>
          {name[0]}
        </div>
        <p style={{ fontSize: 14, fontWeight: isMe ? 600 : 400, color: "var(--ink-900)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {isMe ? "You" : firstName(name)}
        </p>
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
  const session = await getPortalUser();
  const member = session && session.status === "active" ? session : null;
  const { cityName, rows } = member ? await getStandings(member) : { cityName: null, rows: [] };
  const meId = member?.id ?? null;

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        {cityName ? <p className="eyebrow" style={{ marginBottom: 4 }}>{cityName}</p> : null}
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>Standings</h2>
        <p style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 8 }}>Two leaderboards, updated live after each round is scored.</p>
      </div>

      <Table
        title="Top Leader Score"
        subtitle="Cumulative — your best 7 weekly totals, minus any no-show penalties."
        valueHeader="Total"
        rows={byCumulative(rows)}
        meId={meId}
        rankOf={(r) => String(r.cumulative_rank ?? "—")}
        valueOf={(r) => String(r.cumulative_score)}
      />

      <Table
        title="Top Average Score"
        subtitle="Average points per round played. Ranks start after 5 rounds."
        valueHeader="Avg"
        rows={byAverage(rows)}
        meId={meId}
        rankOf={(r) => (r.average_rank != null ? String(r.average_rank) : "—")}
        valueOf={(r) => (r.average_rank != null ? r.average_score.toFixed(1) : "0")}
      />
    </div>
  );
}
