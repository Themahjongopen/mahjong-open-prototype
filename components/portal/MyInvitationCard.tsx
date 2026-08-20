"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import { useConfirm } from "@/components/ConfirmProvider";
import { formatTableTime } from "@/lib/format/time";
import { holdExpiresAt } from "@/lib/portal/holdExpiry";

// One invitation row in My Tables' "Invitations" section. Distinguished from a
// seated table by MORE than color — the text "Invited" badge and the explicit
// Accept / Decline buttons carry the distinction on their own (the player base
// skews older; don't rely on the accent alone).
//
// Accept routes through the existing join path (POST seats -> claim_seat, which
// consumes this hold). Decline routes through the existing release_hold endpoint
// (which emails the inviter). Both refresh on success.
//
// Expiry boundary, from the player's side: a timer flips the card to an in-place
// "expired" state rather than removing it, so a hold that lapses while they're
// looking never vanishes mid-tap. If they tap Accept right at the boundary, the
// join route still seats them cleanly if a seat is open (claim_seat consumes a
// pending hold regardless of TTL) or refuses cleanly (409) if the table filled —
// never a silent disappearance.
export default function MyInvitationCard({
  tableId,
  currentUserId,
  holdCreatedAt,
  inviterName,
  table,
}: {
  tableId: string;
  currentUserId: string;
  holdCreatedAt: string;
  inviterName: string | null;
  table: { week_number: number; table_date: string; table_time: string | null; location_name: string };
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const actionInFlight = useRef(false);

  const expiresAt = holdExpiresAt({ created_at: holdCreatedAt });
  const expiryLabel = expiresAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Flip to "expired" in place when the hold lapses — never unmount mid-view.
  useEffect(() => {
    const delay = expiresAt.getTime() - Date.now();
    if (delay <= 0) {
      setExpired(true);
      return;
    }
    const timer = setTimeout(() => setExpired(true), delay);
    return () => clearTimeout(timer);
  }, [expiresAt]);

  async function accept() {
    if (actionInFlight.current || expired) return;
    actionInFlight.current = true;
    try {
      const dateLabel = new Date(`${table.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      const ok = await confirm({
        title: "Take this seat?",
        message: `${dateLabel} at ${formatTableTime(table.table_time)}\n${table.location_name}\n\nLeaving within 24 hours counts as a no-show.`,
        confirmLabel: "Take a seat",
      });
      if (!ok) return;
      setBusy("accept");
      setError(null);
      const res = await fetch(`/api/tables/${tableId}/seats`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || "Couldn't take the seat.");
        return;
      }
      router.refresh(); // moves it into "Upcoming" as a real seat
    } finally {
      setBusy(null);
      actionInFlight.current = false;
    }
  }

  async function decline() {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    try {
      const ok = await confirm({
        title: "Decline this invitation?",
        message: "The seat opens back up and the person who invited you is notified.",
        confirmLabel: "Decline",
        danger: true,
      });
      if (!ok) return;
      setBusy("decline");
      setError(null);
      const res = await fetch(`/api/tables/${tableId}/invites/${currentUserId}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Couldn't decline.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(null);
      actionInFlight.current = false;
    }
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--pink-200)",
        borderLeft: "4px solid var(--pink-400)",
        borderRadius: "var(--radius-lg)",
        padding: "14px 16px",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span className="badge badge-pink" style={{ fontWeight: 700 }}>Invited</span>
        <span className="badge badge-mute">Week {table.week_number}</span>
        {inviterName ? <span style={{ fontSize: 12, color: "var(--ink-500)" }}>from {inviterName}</span> : null}
      </div>

      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", marginBottom: 4 }}>
        {new Date(`${table.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        {table.table_time ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink-500)" }}>
            <CalendarDays size={12} /> {formatTableTime(table.table_time)}
          </span>
        ) : null}
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink-500)" }}>
          <MapPin size={12} /> {table.location_name}
        </span>
      </div>

      <p style={{ fontSize: 12, color: expired ? "var(--danger)" : "var(--ink-500)", display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
        <Clock size={12} /> {expired ? "This invitation has expired" : `A seat is held for you until ${expiryLabel}`}
      </p>

      {error ? <p style={{ fontSize: 12, color: "var(--danger)", marginBottom: 8 }}>{error}</p> : null}

      {expired ? (
        // In place, not removed — clears on the next page load (server filters lapsed
        // holds). They can still join from the table page if a seat is open.
        <a href={`/portal/tables/${tableId}`} className="btn btn-ghost" style={{ fontSize: 13, padding: "8px 14px", justifyContent: "center" }}>
          View table
        </a>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn btn-primary" onClick={accept} disabled={!!busy} style={{ fontSize: 13, padding: "9px 16px", flex: 1, justifyContent: "center" }}>
            {busy === "accept" ? "Taking…" : "Accept"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={decline} disabled={!!busy} style={{ fontSize: 13, padding: "9px 16px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}>
            {busy === "decline" ? "Declining…" : "Decline"}
          </button>
        </div>
      )}
    </div>
  );
}
