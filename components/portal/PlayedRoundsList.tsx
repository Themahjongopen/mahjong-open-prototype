"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTableTime } from "@/lib/format/time";
import type { PlayedRound, PlayedPlayerResult } from "@/lib/portal/playedRounds";

// The "Played" view: completed rounds for one week of the player's city, so anyone
// can verify their own scores and see how the leaderboard is built. Week selection
// navigates (the server scopes the query to a single week — we never load every
// completed round in the city up front); the name search filters the loaded week's
// rounds client-side, the same pattern as the admin Tables player search. The two
// combine with AND.
export default function PlayedRoundsList({
  rounds,
  weeks,
  selectedWeek,
}: {
  rounds: PlayedRound[];
  weeks: number[];
  selectedWeek: number | null;
}) {
  const router = useRouter();
  const [nameQuery, setNameQuery] = useState("");

  const filtered = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (!q) return rounds;
    return rounds.filter((r) => r.players.some((p) => (p.full_name ?? "").toLowerCase().includes(q)));
  }, [rounds, nameQuery]);

  // Top hosts for the selected week, from all loaded rounds (independent of the
  // player search). Ranked by rounds hosted; the top 3, but if the 3rd place is
  // tied, everyone tied at that count is shown rather than truncating to three.
  // When that tie-extended list would exceed 5, the week has no standout hosts
  // (e.g. most people hosted once) — the band recognizes no one, so it's hidden
  // entirely (empty list → not rendered).
  const topHosts = useMemo(() => {
    const byHost = new Map<string, { hostId: string; name: string; count: number }>();
    for (const r of rounds) {
      const cur = byHost.get(r.hostId);
      if (cur) cur.count++;
      else byHost.set(r.hostId, { hostId: r.hostId, name: r.hostName ?? "—", count: 1 });
    }
    const sorted = Array.from(byHost.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const top = sorted.length <= 3 ? sorted : sorted.filter((h) => h.count >= sorted[2].count);
    return top.length > 5 ? [] : top;
  }, [rounds]);

  // A city with no completed rounds at all — nothing to select or search.
  if (weeks.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-500)" }}>
        <p style={{ fontSize: 16 }}>No completed rounds yet.</p>
        <p style={{ fontSize: 14, marginTop: 8 }}>Once tables in your city are played and scored, they&rsquo;ll show up here.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p style={legendStyle}>Week</p>
          <select
            value={selectedWeek === null ? "" : String(selectedWeek)}
            onChange={(e) => router.push(`/portal/tables?view=played&week=${e.target.value}`)}
            style={selectStyle}
          >
            {weeks.map((w) => (
              <option key={w} value={w}>Week {w}</option>
            ))}
          </select>
        </div>
        <div>
          <p style={legendStyle}>Player</p>
          <input
            type="search"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Search by player name"
            aria-label="Search by player name"
            style={selectStyle}
          />
        </div>
      </div>

      {topHosts.length > 0 && (
        <div style={{ background: "var(--lime-50, #f4f8ee)", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: "12px 14px", marginBottom: 16 }}>
          <p style={{ ...legendStyle, color: "var(--lime-700)", marginBottom: 10 }}>Top hosts this week</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topHosts.map((h) => (
              <div key={h.hostId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 14, color: "var(--ink-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-700)", flexShrink: 0 }}>
                  {h.count} round{h.count === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
          {nameQuery.trim()
            ? `${filtered.length} of ${rounds.length} rounds shown`
            : `${rounds.length} round${rounds.length === 1 ? "" : "s"}`}
        </span>
        {nameQuery.trim() && (
          <button
            type="button"
            onClick={() => setNameQuery("")}
            style={{ fontSize: 13, fontWeight: 600, color: "var(--pink-600)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--ink-500)" }}>
          <p style={{ fontSize: 15 }}>{nameQuery.trim() ? "No rounds match that player." : "No completed rounds this week."}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map((r) => (
            <PlayedRoundCard key={r.id} round={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlayedRoundCard({ round }: { round: PlayedRound }) {
  const dateLabel = new Date(`${round.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-xs)", padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", margin: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{round.location_name}</p>
          <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0 0" }}>
            {dateLabel}{round.table_time ? ` · ${formatTableTime(round.table_time)}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <span className="badge badge-mute">Week {round.week_number}</span>
          {round.round_type && <span className="badge badge-peri" style={{ textTransform: "capitalize" }}>{round.round_type}</span>}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--hair-200)", paddingTop: 10 }}>
        {round.players.map((p) => (
          <div key={p.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ flex: "1 1 auto", minWidth: 0, fontSize: 14, color: "var(--ink-800)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.full_name ?? "—"}
              {p.isHost && (
                <span className="badge badge-lime" style={{ marginLeft: 8, fontSize: 10, verticalAlign: "middle" }}>Host</span>
              )}
            </span>
            <ResultLabel result={p.result} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultLabel({ result }: { result: PlayedPlayerResult }) {
  const base: React.CSSProperties = { fontSize: 14, fontWeight: 700, flexShrink: 0 };
  switch (result.kind) {
    case "score":
      return <span style={{ ...base, color: "var(--ink-900)" }}>{result.value}</span>;
    case "penalty":
      // The absent player at a no-show round — flat −20 weekly penalty (Aug 2026).
      return <span style={{ ...base, color: "var(--danger)" }}>&minus;20</span>;
    case "noscore":
      // Present at a no-show round: no game was played, so there's no round score.
      return <span style={{ ...base, fontWeight: 500, color: "var(--ink-500)", fontStyle: "italic" }}>no score</span>;
    case "pending":
      return <span style={{ ...base, fontWeight: 500, color: "var(--ink-500)" }}>not scored yet</span>;
  }
}

const legendStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
  color: "var(--ink-500)", marginBottom: 8,
};
const selectStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", fontSize: 14, color: "var(--ink-800)",
  border: "1px solid var(--hair-300)", borderRadius: "var(--radius-md)", background: "#fff",
};
