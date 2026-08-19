"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { useToast } from "@/components/portal/PortalShellClient";
import { useConfirm } from "@/components/ConfirmProvider";
import Avatar from "@/components/portal/Avatar";
import InvitePlayersModal from "@/components/portal/InvitePlayersModal";
import AreaCombobox from "@/components/portal/AreaCombobox";
import { scoringSeats, type LeagueTable, type SeatRow } from "@/lib/portal/seats";
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

type Action = "join" | "leave" | "cancel" | "complete" | "edit" | "delete" | "handoff" | null;

// Edit form state — the fields a host/admin may change (round/week is not among
// them). Pre-filled from the table's current values.
type EditForm = {
  table_date: string;
  table_time: string;
  location_name: string;
  location_address: string;
  area: string;
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
  const joinInFlight = useRef(false);
  const markPlayedInFlight = useRef(false);
  const [editing, setEditing] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [pickingHost, setPickingHost] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    table_date: table.table_date,
    table_time: (table.table_time ?? "").slice(0, 5), // <input type=time> wants HH:MM
    location_name: table.location_name,
    location_address: table.location_address ?? "",
    area: table.area ?? "",
    round_type: table.round_type ?? "",
    notes: table.notes ?? "",
  });
  const [editError, setEditError] = useState("");
  // Host self-correction of the posted scores (parallels the admin Score
  // Corrections card, but host-only and time-boxed).
  const [scoreEditing, setScoreEditing] = useState(false);
  const [scoreValues, setScoreValues] = useState<Record<string, string>>(
    submission ? Object.fromEntries(submission.players.map((p) => [p.id, String(p.round_score)])) : {}
  );
  const [scoreSaving, setScoreSaving] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  async function saveScores() {
    if (!submission) return;
    setScoreSaving(true);
    setScoreError(null);
    try {
      const res = await fetch(`/api/scores/${submission.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: submission.players.map((p) => ({ id: p.id, round_score: Number.parseInt(scoreValues[p.id] || "0", 10) || 0 })) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setScoreError(payload.error || "Could not save scores.");
        return;
      }
      setScoreEditing(false);
      router.refresh();
    } finally {
      setScoreSaving(false);
    }
  }

  const active = table.table_seats.filter((s) => !s.canceled_at);
  const { lateCancellations } = scoringSeats(table);
  const lateCancelSeatNumbers = new Set(lateCancellations.map((s) => s.seat_number));
  const myActiveSeat = active.find((s) => s.user_id === currentUserId);
  const isCreator = table.creator_id === currentUserId;
  // Host may self-correct scores only within 24h of submitting, and never on a
  // voided submission. Past the window the card just stays read-only (no error).
  const canEditScores =
    isCreator && !!submission && submission.status !== "voided" &&
    Date.now() - new Date(submission.created_at).getTime() <= 24 * 60 * 60 * 1000;
  const seatsFilled = active.length;
  // Seats that count toward the 4 needed to play: real people seated + any seat
  // whose most recent occupant cancelled within 24h and was never re-claimed
  // (forced no-show at score time). Join eligibility and the Players header keep
  // using the real active count so an open seat can still be backfilled.
  const scoringFilled = active.length + lateCancellations.length;
  const canJoin = !myActiveSeat && seatsFilled < 4 && table.status === "open" && !isCreator;
  const canLeave = !!myActiveSeat && !isCreator && (table.status === "open" || table.status === "full");
  const canCancelTable = isCreator && (table.status === "open" || table.status === "full");
  // Admin is an alternate to the host for mark-played and score entry — the API
  // (POST /api/scores and the PATCH "complete" action) already authorizes
  // session.isAdmin, so these buttons must not stay creator-only.
  const isHostOrAdmin = isCreator || isAdmin;
  const canMarkPlayed = isHostOrAdmin && scoringFilled >= 4 && (table.status === "open" || table.status === "full");
  const canSubmitScores = isHostOrAdmin && table.status === "completed" && !submission;
  // Editing is a creator/admin action, only on an open/upcoming table. The 24h
  // block below is enforced server-side; this is just the matching client hint.
  const canManageEdit = isHostOrAdmin && (table.status === "open" || table.status === "full");
  const canDeleteTable = isHostOrAdmin && table.status === "canceled";
  // Invite is open to ANY player actively seated here (creator or joined), only
  // while the table is open with a real open seat. Deliberately NOT gated on the
  // 24h cutoff (unlike edit) — needing a fourth the night before is exactly when
  // a host reaches for it. Non-seated admins don't see it (myActiveSeat is null).
  const openSeats = 4 - seatsFilled;
  const canInvite = !!myActiveSeat && table.status === "open" && openSeats > 0;
  // Hand off hosting: the creator OR an admin (admin = rescue a silent host) may
  // reassign the host to any OTHER active-seated player, while the table is still
  // open/upcoming. No 24h cutoff (that's the point). Hidden if there's no other
  // seated player to hand to.
  const handoffCandidates = active.filter((s) => s.user_id !== table.creator_id);
  const canHandoff = (isCreator || isAdmin) && (table.status === "open" || table.status === "full") && handoffCandidates.length > 0;

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

  // Confirm before joining (Part A) + a synchronous reentrancy guard (Part B):
  // the ref flips before the confirm await, so a replayed tap arriving while the
  // modal is open is dropped rather than queuing a second join. `loading` alone
  // can't stop a replay that lands before React re-renders.
  async function handleJoin() {
    if (joinInFlight.current) return;
    joinInFlight.current = true;
    try {
      const dateLabel = new Date(`${table.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      const ok = await confirm({
        title: "Join this table?",
        message: `${dateLabel} at ${formatTableTime(table.table_time)}\n${table.location_name}\n\nLeaving within 24 hours counts as a no-show.`,
        confirmLabel: "Take a seat",
      });
      if (!ok) return;
      await run("join", `/api/tables/${table.id}/seats`, { method: "POST" }, "Seat claimed!");
    } finally {
      joinInFlight.current = false;
    }
  }

  async function handleLeave() {
    const ok = await confirm(
      withinCutoff
        ? {
            title: "Leave within 24 hours?",
            message: "This is within 24 hours of the table, so it counts as a no-show (−25 points) unless another player takes your spot before the table plays. Let your table know so someone can fill in.",
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

  // Confirm names the specific table (a wrong-row tap on a busy My Tables list is
  // exactly how the Dorian incident happened) and warns that it isn't easily
  // undone. Same synchronous reentrancy guard as handleJoin: the ref flips before
  // the confirm await, so a tap replayed while the modal is open — the Kate
  // failure mode — is dropped rather than queuing a second "complete" call.
  async function handleMarkPlayed() {
    if (markPlayedInFlight.current) return;
    markPlayedInFlight.current = true;
    try {
      const dateLabel = new Date(`${table.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      const ok = await confirm({
        title: "Mark as played?",
        message: `${dateLabel} at ${formatTableTime(table.table_time)}\n${table.location_name}\n\nThis marks the round played so you can enter scores. It isn't easily undone — a commissioner has to revert it.`,
        confirmLabel: "Mark as played",
      });
      if (!ok) return;
      await run(
        "complete",
        `/api/tables/${table.id}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete" }) },
        "Table marked as played."
      );
    } finally {
      markPlayedInFlight.current = false;
    }
  }

  // Surface partial invite results honestly — "Invited 2 players. 1 was already
  // invited." — rather than a flat success when some were skipped/failed. A failed
  // send left NO row (the server rolls it back), so we name the person the host
  // couldn't reach — "Couldn't reach Marcus — try again" — instead of a bare count.
  function handleInvited(result: { sent: number; skipped: number; failed: number; failedNames?: string[] }) {
    const parts: string[] = [];
    if (result.sent > 0) parts.push(`Invited ${result.sent} player${result.sent === 1 ? "" : "s"}.`);
    if (result.skipped > 0) parts.push(`${result.skipped} ${result.skipped === 1 ? "was" : "were"} already invited.`);
    if (result.failed > 0) {
      const names = (result.failedNames ?? []).filter(Boolean);
      parts.push(names.length ? `Couldn't reach ${names.join(", ")} — try again.` : `${result.failed} couldn't be emailed — try again.`);
    }
    showToast(parts.join(" ") || "No invites were sent.");
    router.refresh();
  }

  // Hand the host role to another seated player. run() ends with router.refresh(),
  // which is what flips this page into the outgoing host's new non-creator state:
  // "Cancel my spot" appears, "Mark as played" disappears — no manual reload.
  async function handleHandoff(seat: SeatRow) {
    const name = seat.profiles?.full_name ?? "this player";
    const ok = await confirm({
      title: "Hand off hosting?",
      message: `${name} will take over as host of this table. You'll no longer be able to mark it as played or enter scores, and you won't be able to take hosting back yourself.`,
      confirmLabel: `Hand off to ${name}`,
      danger: true,
    });
    if (!ok) return;
    setPickingHost(false);
    run(
      "handoff",
      `/api/tables/${table.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "handoff", newHostId: seat.user_id }) },
      "Hosting handed off."
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
            Week {table.week_number} — the week isn&rsquo;t editable here. Seated players will be emailed about the change.
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
        {field("Part of town", false,
          <AreaCombobox cityId={table.city_id} value={editForm.area} onChange={(v) => setEditForm((f) => ({ ...f, area: v }))} placeholderFallback="e.g. North, Midtown, East" />
        )}
        {field("Round type", true,
          <select className="input-mo" value={editForm.round_type} onChange={(e) => setEditForm((f) => ({ ...f, round_type: e.target.value }))}>
            <option value="">Select type</option>
            <option value="casual">Casual</option>
            <option value="mindful">Mindful</option>
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
          <span className="badge badge-mute">Week {table.week_number}</span>
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
              {table.area && <p style={{ color: "var(--ink-500)", fontSize: 13 }}>Part of town: {table.area}</p>}
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
                <p style={{ fontSize: 14, fontWeight: seat ? 500 : 400, color: seat ? "var(--ink-900)" : "var(--ink-500)" }}>
                  {seat ? (seat.profiles?.full_name ?? "Player") : isLateCancel ? "Seat open — a late cancellation. Join to take it." : "Open spot"}
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
            Within 24 hours of game time — it counts as a no-show (−25) unless another player takes your spot first. Let your table know so someone can fill in.
          </div>
        )}

        {canInvite && (
          <button className="btn btn-ghost" onClick={() => setInviting(true)} style={{ justifyContent: "center", padding: "13px" }}>
            Invite players
          </button>
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
              <div key={p.user_id} style={{ padding: "10px 16px", borderBottom: i < submission.players.length - 1 ? "1px solid var(--hair-200)" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
                <span style={{ color: "var(--ink-800)" }}>
                  {p.full_name ?? "Player"}
                  {p.is_no_show ? <span style={{ fontSize: 12, color: "var(--danger)", marginLeft: 8 }}>no-show</span> : null}
                  {p.is_no_show_bonus ? <span style={{ fontSize: 12, color: "var(--ink-500)", marginLeft: 8 }}>+25 stayed</span> : null}
                </span>
                {scoreEditing ? (
                  <input
                    className="input-mo"
                    type="number"
                    min={0}
                    value={scoreValues[p.id] ?? ""}
                    onChange={(e) => setScoreValues((s) => ({ ...s, [p.id]: e.target.value }))}
                    style={{ width: 90 }}
                    aria-label={`Score for ${p.full_name ?? "player"}`}
                  />
                ) : (
                  <span style={{ color: p.is_no_show ? "var(--danger)" : "var(--ink-900)", fontWeight: 600 }}>
                    {p.is_no_show ? "No-show" : p.is_no_show_bonus ? "+25 (stayed)" : p.round_score}
                  </span>
                )}
              </div>
            ))}
            {scoreError ? <p style={{ fontSize: 13, color: "var(--danger)", padding: "10px 16px 0" }}>{scoreError}</p> : null}
            {canEditScores && (
              <div style={{ display: "flex", gap: 8, padding: "12px 16px", flexWrap: "wrap" }}>
                {scoreEditing ? (
                  <>
                    <button className="btn btn-primary" onClick={saveScores} disabled={scoreSaving} style={{ fontSize: 13, padding: "6px 14px" }}>
                      {scoreSaving ? "Saving…" : "Save scores"}
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setScoreEditing(false); setScoreError(null); setScoreValues(Object.fromEntries(submission.players.map((p) => [p.id, String(p.round_score)]))); }} style={{ fontSize: 13, padding: "6px 14px" }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn btn-ghost" onClick={() => { setScoreValues(Object.fromEntries(submission.players.map((p) => [p.id, String(p.round_score)]))); setScoreError(null); setScoreEditing(true); }} style={{ fontSize: 13, padding: "6px 14px" }}>
                    Edit scores
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {canHandoff && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!pickingHost ? (
              <button className="btn btn-ghost" onClick={() => setPickingHost(true)} style={{ justifyContent: "center", padding: "13px" }}>
                Hand off hosting
              </button>
            ) : (
              <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--hair-200)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)", margin: 0 }}>Hand off hosting to…</p>
                  <button type="button" onClick={() => setPickingHost(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-500)", fontSize: 13 }}>
                    Cancel
                  </button>
                </div>
                {handoffCandidates.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleHandoff(s)}
                    disabled={loading === "handoff"}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: "none", border: "none", borderBottom: i < handoffCandidates.length - 1 ? "1px solid var(--hair-200)" : "none", cursor: "pointer", textAlign: "left" }}
                  >
                    <Avatar src={s.profiles?.avatar_url} size={32} alt={s.profiles?.full_name ?? "Player"} />
                    <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)" }}>{s.profiles?.full_name ?? "Player"}</span>
                  </button>
                ))}
              </div>
            )}
            {isCreator && (
              <div style={{ fontSize: 12, color: "var(--ink-500)", textAlign: "center", padding: "0 8px" }}>
                After handing off, you&rsquo;ll be able to cancel your own spot without cancelling the table.
              </div>
            )}
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

      {inviting && (
        <InvitePlayersModal
          tableId={table.id}
          openSeats={openSeats}
          onClose={() => setInviting(false)}
          onInvited={handleInvited}
        />
      )}
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
