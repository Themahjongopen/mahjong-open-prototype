"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { useToast } from "@/components/portal/PortalShellClient";
import type { LeagueTable } from "@/lib/portal/tables";
import type { TableSubmission } from "@/lib/portal/scores";

const SKILL_COLORS: Record<string, string> = {
  beginner: "badge-lime",
  intermediate: "badge-peri",
  advanced: "badge-pink",
};
const STATUS_COLORS: Record<string, string> = {
  open: "badge-lime",
  full: "badge-pink",
  completed: "badge-mute",
  canceled: "badge-mute",
};

type Action = "join" | "leave" | "cancel" | "complete" | null;

export default function TableDetailClient({
  table,
  currentUserId,
  submission,
}: {
  table: LeagueTable;
  currentUserId: string;
  submission: TableSubmission | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState<Action>(null);

  const active = table.table_seats.filter((s) => !s.canceled_at);
  const myActiveSeat = active.find((s) => s.user_id === currentUserId);
  const isCreator = table.creator_id === currentUserId;
  const seatsFilled = active.length;
  const canJoin = !myActiveSeat && seatsFilled < 4 && table.status === "open" && !isCreator;
  const canLeave = !!myActiveSeat && !isCreator && (table.status === "open" || table.status === "full");
  const canCancelTable = isCreator && (table.status === "open" || table.status === "full");
  const canMarkPlayed = isCreator && (table.status === "open" || table.status === "full");
  const canSubmitScores = isCreator && table.status === "completed" && !submission;

  const tableDateTime = new Date(`${table.table_date}T${table.table_time ?? "12:00:00"}`);
  const hoursUntil = (tableDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const withinCutoff = hoursUntil <= 24;

  async function run(action: Exclude<Action, null>, url: string, init: RequestInit, okMsg: string) {
    setLoading(action);
    try {
      const res = await fetch(url, init);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(payload.error || "Something went wrong.");
        return;
      }
      showToast(okMsg);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function handleJoin() {
    run("join", `/api/tables/${table.id}/seats`, { method: "POST" }, "Seat claimed!");
  }

  function handleLeave() {
    const msg = withinCutoff
      ? "Leaving within 24 hours of game time: if no one takes your seat, the host may mark it a no-show (−25). Leave anyway?"
      : "Leave this table? Your seat will reopen for other players.";
    if (!window.confirm(msg)) return;
    run("leave", `/api/tables/${table.id}/seats/cancel`, { method: "POST" }, "Seat cancelled.");
  }

  function handleCancelTable() {
    if (!window.confirm("Cancel this table for everyone? This can't be undone.")) return;
    run(
      "cancel",
      `/api/tables/${table.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) },
      "Table cancelled."
    );
  }

  function handleMarkPlayed() {
    if (!window.confirm("Mark this table as played? You'll then enter the round's scores.")) return;
    run(
      "complete",
      `/api/tables/${table.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) },
      "Table marked as played."
    );
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span className="badge badge-mute">Round {table.week_number}</span>
          <span className={`badge ${STATUS_COLORS[table.status] ?? "badge-mute"}`}>{table.status}</span>
          {table.skill_level && (
            <span className={`badge ${SKILL_COLORS[table.skill_level] ?? "badge-mute"}`}>{table.skill_level}</span>
          )}
          {table.round_type && (
            <span className="badge badge-peri" style={{ textTransform: "capitalize" }}>{table.round_type}</span>
          )}
          {isCreator && <span className="badge badge-butter">Your table</span>}
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-900)", marginBottom: 12 }}>
          {new Date(`${table.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {table.table_time ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink-700)" }}>
              <Clock size={15} color="var(--ink-500)" />
              {table.table_time.slice(0, 5)}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink-700)" }}>
            <MapPin size={15} color="var(--ink-500)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p>{table.location_name}</p>
              {table.location_address && <p style={{ color: "var(--ink-500)", fontSize: 13 }}>{table.location_address}</p>}
            </div>
          </div>
          {table.notes && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink-700)" }}>
              <CalendarDays size={15} color="var(--ink-500)" style={{ marginTop: 2 }} />
              {table.notes}
            </div>
          )}
        </div>
      </div>

      {/* Seats */}
      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: 20, boxShadow: "var(--shadow-xs)" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair-200)" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Players ({seatsFilled}/4)</p>
        </div>
        {[1, 2, 3, 4].map((seatNum) => {
          const seat = active.find((s) => s.seat_number === seatNum);
          const isMe = seat?.user_id === currentUserId;
          const isTableCreator = seat?.user_id === table.creator_id;
          return (
            <div
              key={seatNum}
              style={{
                padding: "12px 16px",
                borderBottom: seatNum < 4 ? "1px solid var(--hair-200)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: isMe ? "var(--pink-50)" : "#fff",
              }}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: seat ? (isMe ? "var(--pink-400)" : "var(--ink-900)") : "var(--hair-200)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  color: seat ? "#fff" : "var(--mute-400)",
                  flexShrink: 0,
                }}
              >
                {seat ? (seat.profiles?.full_name?.[0] ?? "?") : seatNum}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: seat ? 500 : 400, color: seat ? "var(--ink-900)" : "var(--ink-500)" }}>
                  {seat ? (seat.profiles?.full_name ?? "Player") : "Open spot"}
                </p>
                {isTableCreator && seat && <p style={{ fontSize: 11, color: "var(--lime-600)", fontWeight: 600 }}>Table creator</p>}
              </div>
              {isMe && <span className="badge badge-pink">You</span>}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {canJoin && (
          <button className="btn btn-primary" onClick={handleJoin} disabled={loading === "join"} style={{ justifyContent: "center", padding: "13px" }}>
            {loading === "join" ? "Joining…" : "Join this table →"}
          </button>
        )}
        {canLeave && (
          <button className="btn btn-ghost" onClick={handleLeave} disabled={loading === "leave"} style={{ justifyContent: "center", padding: "13px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}>
            {loading === "leave" ? "Cancelling…" : "Cancel my spot"}
          </button>
        )}
        {canLeave && withinCutoff && (
          <div style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", padding: "0 8px" }}>
            Within 24 hours of game time — if no one takes your seat, the host may record a no-show.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={createCalendarHref(tableDateTime, table)}
            download={`mahjong-table-${table.id}.ics`}
            className="btn btn-ghost"
            style={{ justifyContent: "center", padding: "13px" }}
          >
            Add to calendar
          </a>
          <a
            href={createGoogleCalendarLink(tableDateTime, table)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ justifyContent: "center", padding: "13px" }}
          >
            Google Calendar
          </a>
        </div>

        {canMarkPlayed && (
          <button className="btn btn-primary" onClick={handleMarkPlayed} disabled={loading === "complete"} style={{ justifyContent: "center", padding: "13px" }}>
            {loading === "complete" ? "Updating…" : "Mark as played"}
          </button>
        )}

        {canSubmitScores && (
          <a href={`/portal/scores?table_id=${table.id}`} className="btn btn-primary" style={{ justifyContent: "center", padding: "13px", display: "flex" }}>
            Enter round scores →
          </a>
        )}

        {submission && (
          <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair-200)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Round scores</p>
              <span className="badge badge-lime">Posted</span>
            </div>
            {submission.players.map((p, i) => (
              <div key={p.user_id} style={{ padding: "10px 16px", borderBottom: i < submission.players.length - 1 ? "1px solid var(--hair-200)" : "none", display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span style={{ color: "var(--ink-800)" }}>{p.full_name ?? "Player"}</span>
                <span style={{ color: p.is_no_show ? "var(--danger)" : "var(--ink-900)", fontWeight: 600 }}>
                  {p.is_no_show ? "No-show" : p.is_no_show_bonus ? "+25 (stayed)" : p.round_score}
                </span>
              </div>
            ))}
          </div>
        )}

        {canCancelTable && (
          <button className="btn btn-ghost" onClick={handleCancelTable} disabled={loading === "cancel"} style={{ justifyContent: "center", padding: "13px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}>
            {loading === "cancel" ? "Cancelling…" : "Cancel this table"}
          </button>
        )}
      </div>
    </>
  );
}

function formatDateForCalendar(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0];
}

function createCalendarHref(date: Date, table: LeagueTable) {
  const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//The Mahjong Open//EN",
    "BEGIN:VEVENT",
    `UID:${table.id}@themahjongopen.com`,
    `DTSTAMP:${formatDateForCalendar(new Date())}Z`,
    `DTSTART:${formatDateForCalendar(date)}Z`,
    `DTEND:${formatDateForCalendar(endDate)}Z`,
    `SUMMARY:The Mahjong Open table at ${table.location_name}`,
    `DESCRIPTION:Skill level: ${table.skill_level ?? "Open"}\\nLocation: ${table.location_name}${table.location_address ? `\\n${table.location_address}` : ""}`,
    `LOCATION:${table.location_address ?? table.location_name}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function createGoogleCalendarLink(date: Date, table: LeagueTable) {
  const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const format = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0];
  const details = `Skill level: ${table.skill_level ?? "Open"} - ${table.location_name}${table.location_address ? `, ${table.location_address}` : ""}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`The Mahjong Open table at ${table.location_name}`)}&dates=${format(date)}/${format(endDate)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(table.location_address ?? table.location_name)}&sf=true&output=xml`;
}
