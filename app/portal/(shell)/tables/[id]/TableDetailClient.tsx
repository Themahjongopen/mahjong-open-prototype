"use client";

import { useState } from "react";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { useToast } from "@/components/portal/PortalShellClient";

interface Seat {
  id: string;
  user_id: string;
  seat_number: number;
  canceled_at: string | null;
  profiles: { full_name: string | null } | null;
}

interface TableDetailClientProps {
  table: {
    id: string;
    week_number: number;
    table_date: string;
    table_time: string;
    location_name: string;
    location_address: string | null;
    skill_level: string | null;
    notes: string | null;
    status: string;
    creator_id: string;
    table_seats: Seat[];
  };
  currentUserId: string;
  scoreSubmission: { id: string; status: string } | null;
}

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

export default function TableDetailClient({ table: initialTable, currentUserId, scoreSubmission }: TableDetailClientProps) {
  const { showToast } = useToast();
  const [seats, setSeats] = useState(initialTable.table_seats);
  const [loading, setLoading] = useState<"join" | "cancel" | null>(null);

  const activeSeats = seats.filter((s) => !s.canceled_at);
  const myActiveSeat = activeSeats.find((s) => s.user_id === currentUserId);
  const isCreator = initialTable.creator_id === currentUserId;
  const seatsFilled = activeSeats.length;
  const canJoin = !myActiveSeat && seatsFilled < 4 && initialTable.status === "open" && !isCreator;

  const tableDateTime = new Date(`${initialTable.table_date}T${initialTable.table_time}`);
  const hoursUntil = (tableDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
  const canCancel = !!myActiveSeat && hoursUntil > 24 && !isCreator;

  function handleJoin() {
    setLoading("join");
    setTimeout(() => {
      const nextSeat = seatsFilled + 1;
      setSeats((prev) => [
        ...prev,
        {
          id: `seat-demo-new`,
          user_id: currentUserId,
          seat_number: nextSeat,
          canceled_at: null,
          profiles: { full_name: "Jordan Chen" },
        },
      ]);
      showToast("Seat claimed!");
      setLoading(null);
    }, 600);
  }

  function handleCancel() {
    setLoading("cancel");
    setTimeout(() => {
      setSeats((prev) =>
        prev.map((s) => s.user_id === currentUserId ? { ...s, canceled_at: new Date().toISOString() } : s)
      );
      showToast("Seat cancelled.");
      setLoading(null);
    }, 600);
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span className="badge badge-mute">Round {initialTable.week_number}</span>
          <span className={`badge ${STATUS_COLORS[initialTable.status] ?? "badge-mute"}`}>{initialTable.status}</span>
          {initialTable.skill_level && (
            <span className={`badge ${SKILL_COLORS[initialTable.skill_level] ?? "badge-mute"}`}>{initialTable.skill_level}</span>
          )}
          {isCreator && <span className="badge badge-butter">Your table</span>}
        </div>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink-900)", marginBottom: 12 }}>
          {new Date(initialTable.table_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "var(--ink-700)" }}>
            <Clock size={15} color="var(--ink-500)" />
            {initialTable.table_time.slice(0, 5)}
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink-700)" }}>
            <MapPin size={15} color="var(--ink-500)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <p>{initialTable.location_name}</p>
              {initialTable.location_address && <p style={{ color: "var(--ink-500)", fontSize: 13 }}>{initialTable.location_address}</p>}
            </div>
          </div>
          {initialTable.notes && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: "var(--ink-700)" }}>
              <CalendarDays size={15} color="var(--ink-500)" style={{ marginTop: 2 }} />
              {initialTable.notes}
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
          const seat = activeSeats.find((s) => s.seat_number === seatNum);
          const isMe = seat?.user_id === currentUserId;
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
                {seatNum === 1 && seat && <p style={{ fontSize: 11, color: "var(--lime-600)", fontWeight: 600 }}>Table creator</p>}
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
        {canCancel && (
          <button className="btn btn-ghost" onClick={handleCancel} disabled={loading === "cancel"} style={{ justifyContent: "center", padding: "13px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}>
            {loading === "cancel" ? "Cancelling…" : "Cancel my spot"}
          </button>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href={createCalendarHref(tableDateTime, initialTable)}
            download={`mahjong-table-${initialTable.id}.ics`}
            className="btn btn-ghost"
            style={{ justifyContent: "center", padding: "13px" }}
          >
            Add to calendar
          </a>
          <a
            href={createGoogleCalendarLink(tableDateTime, initialTable)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost"
            style={{ justifyContent: "center", padding: "13px" }}
          >
            Google Calendar
          </a>
        </div>
        {myActiveSeat && !canCancel && !isCreator && (
          <div style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", padding: "8px" }}>
            Cancellation window has closed (within 24 hours of game time).
          </div>
        )}
        {isCreator && initialTable.status === "completed" && !scoreSubmission && (
          <a href={`/portal/scores?table_id=${initialTable.id}`} className="btn btn-primary" style={{ justifyContent: "center", padding: "13px", display: "flex" }}>
            Submit score →
          </a>
        )}
        {scoreSubmission && (
          <div style={{
            background: scoreSubmission.status === "approved" ? "var(--success-bg)" : "var(--warning-bg)",
            border: `1px solid ${scoreSubmission.status === "approved" ? "var(--lime-200)" : "var(--crimson-100)"}`,
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            fontSize: 13,
            color: scoreSubmission.status === "approved" ? "var(--lime-700)" : "var(--ink-800)",
            textAlign: "center",
          }}>
            Score {scoreSubmission.status === "approved" ? "approved ✓" : `submitted — ${scoreSubmission.status}`}
          </div>
        )}
      </div>
    </>
  );
}

function formatDateForCalendar(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0];
}

function createCalendarHref(date: Date, table: TableDetailClientProps["table"]) {
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

function createGoogleCalendarLink(date: Date, table: TableDetailClientProps["table"]) {
  const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const format = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0];
  const details = `Skill level: ${table.skill_level ?? "Open"} - ${table.location_name}${table.location_address ? `, ${table.location_address}` : ""}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`The Mahjong Open table at ${table.location_name}`)}&dates=${format(date)}/${format(endDate)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(table.location_address ?? table.location_name)}&sf=true&output=xml`;
}
