"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { useToast } from "@/components/portal/PortalShellClient";
import { useConfirm } from "@/components/ConfirmProvider";
import Avatar from "@/components/portal/Avatar";
import { scoringSeats, type LeagueTable } from "@/lib/portal/seats";
import type { TableSubmission } from "@/lib/portal/scores";
import { formatTableTime } from "@/lib/format/time";
import { zonedTimeToUtc } from "@/lib/format/zonedTime";

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

type Action = "join" | "leave" | "cancel" | "complete" | "edit" | "delete" | null;

// Edit form state — the fields a host/admin may change (round/week is not among
// them). Pre-filled from the table's current values.
type EditForm = {
  table_date: string;
  table_time: string;
  location_name: string;
  location_address: string;
  round_type: string;
  notes: string;
};

export default function TableDetailClient({
  table,
  currentUserId,
  isAdmin = false,
  submission,
}: {
  table: LeagueTable;
  currentUserId: string;
  isAdmin?: boolean;
  submission: TableSubmission | null;
}) {
  const { showToast } = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const [loading, setLoading] = useState<Action>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    table_date: table.table_date,
    table_time: (table.table_time ?? "").slice(0, 5), // <input type=time> wants HH:MM
    location_name: table.location_name,
    location_address: table.location_address ?? "",
    round_type: table.round_type ?? "",
    notes: table.notes ?? "",
  });
  const [editError, setEditError] = useState("");

  const active = table.table_seats.filter((s) => !s.canceled_at);
  const { lateCancellations } = scoringSeats(table);
  const lateCancelSeatNumbers = new Set(lateCancellations.map((s) => s.seat_number));
  const myActiveSeat = active.find((s) => s.user_id === currentUserId);
  const isCreator = table.creator_id === currentUserId;
  const seatsFilled = active.length;
  // Seats that count toward the 4 needed to play: real people seated + any seat
  // whose most recent occupant cancelled within 24h and was never re-claimed
  // (forced no-show at score time). Join eligibility and the Players header keep
  // using the real active count so an open seat can still be backfilled.
  const scoringFilled = active.length + lateCancellations.length;
  const canJoin = !myActiveSeat && seatsFilled < 4 && table.status === "open" && !isCreator;
  const canLeave = !!myActiveSeat && !isCreator && (table.status === "open" || table.status === "full");
  const canCancelTable = isCreator && (table.status === "open" || table.status === "full");
  const canMarkPlayed = isCreator && scoringFilled >= 4 && (table.status === "open" || table.status === "full");
  const canSubmitScores = isCreator && table.status === "completed" && !submission;
  // Editing is a creator/admin action, only on an open/upcoming table. The 24h
  // block below is enforced server-side; this is just the matching client hint.
  const isHostOrAdmin = isCreator || isAdmin;
  const canManageEdit = isHostOrAdmin && (table.status === "open" || table.status === "full");
  const canDeleteTable = isHostOrAdmin && table.status === "canceled";

  // Resolve the venue-local start time to a real UTC instant so the 24h warning
  // (and the calendar links below) are correct regardless of the viewer's phone
  // timezone. Falls back to Central if the city has no timezone set.
  const tableDateTime = zonedTimeToUtc(table.table_date, table.table_time ?? "12:00:00", table.timezone ?? "America/Chicago");
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

  async function handleLeave() {
    const ok = await confirm(
      withinCutoff
        ? {
            title: "Leave within 24 hours?",
            message: "If no one takes your seat before game time, the host may mark it a no-show (−25).",
            confirmLabel: "Leave anyway",
            danger: true,
          }
        : {
            title: "Leave this table?",
            message: "Your seat will reopen for other players.",
            confirmLabel: "Leave table",
          }
    );
    if (!ok) return;
    run("leave", `/api/tables/${table.id}/seats/cancel`, { method: "POST" }, "Seat cancelled.");
  }

  async function handleCancelTable() {
    const ok = await confirm({
      title: "Cancel this table?",
      message: "This cancels the table for everyone and can't be undone.",
      confirmLabel: "Cancel table",
      danger: true,
    });
    if (!ok) return;
    run(
      "cancel",
      `/api/tables/${table.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) },
      "Table cancelled."
    );
  }

  // Deliberately NOT built on run(): run() ends with router.refresh(), which would
  // re-fetch a table that no longer exists. Delete navigates away instead.
  async function handleDeleteTable() {
    const ok = await confirm({
      title: "Delete this table?",
      message: "This permanently removes the table and can't be undone.",
      confirmLabel: "Delete table",
      danger: true,
    });
    if (!ok) return;
    setLoading("delete");
    try {
      const res = await fetch(`/api/tables/${table.id}`, { method: "DELETE" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(payload.error || "Something went wrong.");
        return;
      }
      showToast("Table deleted.");
      router.push("/portal/my-tables");
    } finally {
      setLoading(null);
    }
  }

  async function handleMarkPlayed() {
    const ok = await confirm({
      title: "Mark as played?",
      message: "You'll then enter the round's scores for each player.",
      confirmLabel: "Mark as played",
    });
    if (!ok) return;
    run(
      "complete",
      `/api/tables/${table.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) },
      "Table marked as played."
    );
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    if (!editForm.table_date || !editForm.table_time || !editForm.location_name || !editForm.round_type) {
      setEditError("Please fill in the date, time, location, and round type.");
      return;
    }
    setLoading("edit");
    try {
      const res = await fetch(`/api/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit", ...editForm }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(payload.error || "The table couldn't be updated.");
        return;
      }
      showToast("Table updated.");
      setEditing(false);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  // Reused field wrapper matching CreateTableForm's layout/styling.
  function field(label: string, required: boolean, children: React.ReactNode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
          {label} {required && <span style={{ color: "var(--pink-500)" }}>*</span>}
        </label>
        {children}
      </div>
    );
  }

  if (editing) {
    return (
      <form onSubmit={handleEditSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>Edit table</p>
          <p style={{ fontSize: 13, color: "var(--ink-500)", marginTop: 4 }}>
            Round {table.week_number} — the round isn&rsquo;t editable here. Seated players will be emailed about the change.
          </p>
        </div>
        {field("Date", true,
          // TODO: same native <input type="date"> gap CreateTableForm.tsx had
          // before d076769 — no min/max here at all today. Good next candidate
          // for the same round-grouped <select> treatment; not done yet because
          // it wasn't part of the original report.
          <input className="input-mo" type="date" value={editForm.table_date} onChange={(e) => setEditForm((f) => ({ ...f, table_date: e.target.value }))} />
        )}
        {field("Time", true,
          <input className="input-mo" type="time" value={editForm.table_time} onChange={(e) => setEditForm((f) => ({ ...f, table_time: e.target.value }))} />
        )}
        {field("Location name", true,
          <input className="input-mo" type="text" placeholder="e.g. Jane's place, Rosewood Café" value={editForm.location_name} onChange={(e) => setEditForm((f) => ({ ...f, location_name: e.target.value }))} />
        )}
        {field("Address or directions", false,
          <input className="input-mo" type="text" placeholder="Optional" value={editForm.location_address} onChange={(e) => setEditForm((f) => ({ ...f, location_address: e.target.value }))} />
        )}
        {field("Round type", true,
          <select className="input-mo" value={editForm.round_type} onChange={(e) => setEditForm((f) => ({ ...f, round_type: e.target.value }))}>
            <option value="">Select type</option>
            <option value="social">Social</option>
            <option value="focused">Focused</option>
            <option value="lightning">Lightning</option>
          </select>
        )}
        {field("Notes", false,
          <textarea className="input-mo" rows={3} placeholder="Anything players should know" value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} style={{ resize: "vertical" }} />
        )}

        {editError && <p style={{ fontSize: 13, color: "var(--danger)" }}>{editError}</p>}

        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={() => { setEditing(false); setEditError(""); }} disabled={loading === "edit"} style={{ flex: 1, justifyContent: "center", padding: "13px" }}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={loading === "edit"} style={{ flex: 1, justifyContent: "center", padding: "13px" }}>
            {loading === "edit" ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <span className="badge badge-mute">Round {table.week_number}</span>
          <span className={`badge ${STATUS_COLORS[table.status] ?? "badge-mute"}`}>{table.status}</span>
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
              {formatTableTime(table.table_time)}
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
          const isLateCancel = !seat && lateCancelSeatNumbers.has(seatNum);
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
              {seat ? (
                <Avatar src={seat.profiles?.avatar_url} size={32} alt={seat.profiles?.full_name ?? "Player"} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--hair-200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "var(--mute-400)", flexShrink: 0 }}>
                  {seatNum}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: seat ? 500 : 400, color: seat ? "var(--ink-900)" : isLateCancel ? "var(--danger)" : "var(--ink-500)" }}>
                  {seat ? (seat.profiles?.full_name ?? "Player") : isLateCancel ? "Canceled (late) — counts as a no-show" : "Open spot"}
                  {seat?.profiles?.skill_level && (
                    <span className={`badge ${SKILL_COLORS[seat.profiles.skill_level] ?? "badge-mute"}`} style={{ fontSize: 10, marginLeft: 6 }}>
                      {seat.profiles.skill_level}
                    </span>
                  )}
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
            href={`/api/tables/${table.id}/calendar.ics`}
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
        <div style={{ fontSize: 12, color: "var(--ink-500)", textAlign: "center", padding: "0 8px" }}>
          &ldquo;Add to calendar&rdquo; may not work in Chrome on iPhone — if it doesn&rsquo;t, please use Safari, or tap &ldquo;Google Calendar&rdquo; instead.
        </div>

        {isCreator && scoringFilled < 4 && (table.status === "open" || table.status === "full") && (
          <div style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", padding: "0 8px" }}>
            Waiting for {4 - scoringFilled} more player{4 - scoringFilled === 1 ? "" : "s"} before this round can be marked as played.
          </div>
        )}

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

        {canManageEdit && !withinCutoff && (
          <button className="btn btn-ghost" onClick={() => setEditing(true)} style={{ justifyContent: "center", padding: "13px" }}>
            Edit table details
          </button>
        )}
        {canManageEdit && withinCutoff && (
          <div style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", padding: "0 8px" }}>
            This table can no longer be edited — it&rsquo;s within 24 hours of its start time.
          </div>
        )}

        {canCancelTable && (
          <button className="btn btn-ghost" onClick={handleCancelTable} disabled={loading === "cancel"} style={{ justifyContent: "center", padding: "13px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}>
            {loading === "cancel" ? "Cancelling…" : "Cancel this table"}
          </button>
        )}
        {canDeleteTable && (
          <button className="btn btn-ghost" onClick={handleDeleteTable} disabled={loading === "delete"} style={{ justifyContent: "center", padding: "13px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}>
            {loading === "delete" ? "Deleting…" : "Delete this table"}
          </button>
        )}
      </div>
    </>
  );
}

function formatDateForCalendar(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0];
}


function createGoogleCalendarLink(date: Date, table: LeagueTable) {
  const endDate = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  const details = `${table.location_name}${table.location_address ? `, ${table.location_address}` : ""}`;
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`The Mahjong Open table at ${table.location_name}`)}&dates=${formatDateForCalendar(date)}Z/${formatDateForCalendar(endDate)}Z&details=${encodeURIComponent(details)}&location=${encodeURIComponent(table.location_address ?? table.location_name)}&sf=true&output=xml`;
}
