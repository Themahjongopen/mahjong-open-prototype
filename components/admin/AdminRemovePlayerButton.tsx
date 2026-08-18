"use client";

import { useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";

// Inline "Remove" control next to a seated guest on /admin/tables. Frees one seat
// via PATCH /api/admin/tables/[id] (which reuses cancelSeatsAndNotify), never
// cancelling the whole table. Only rendered for non-host seats on open/full
// tables; the server re-enforces both.
export default function AdminRemovePlayerButton({
  tableId,
  seatId,
  playerName,
  onRemoved,
}: {
  tableId: string;
  seatId: string;
  playerName: string;
  onRemoved: () => void;
}) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRemove() {
    const ok = await confirm({
      title: "Remove this player?",
      message: `Remove ${playerName} from this table? If this drops it below full, the remaining players will be emailed that a seat opened up.`,
      confirmLabel: "Remove player",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_seat", seatId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Could not remove that player.");
        return;
      }
      onRemoved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column" }}>
      <button
        type="button"
        onClick={onRemove}
        disabled={busy}
        className="btn btn-ghost"
        style={{ fontSize: 11, padding: "2px 8px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}
      >
        {busy ? "Removing…" : "Remove"}
      </button>
      {error ? <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span> : null}
    </span>
  );
}
