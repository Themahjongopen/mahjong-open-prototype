"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

// Admin "Revert to open" for /admin/tables — undoes an accidental mark-as-played
// (Dorian Jones, Gulf Coast, Aug 19: meant to cancel, pressed "mark as played",
// leaving a completed table with no scores and no UI path back). Calls
// PATCH /api/admin/tables/[id] { action: "revert_completed" }, which discards any
// submitted scores, clears no-show flags, and puts the table back to full/open.
//
// Renders ONLY for completed tables. Reverting a table that has real scores is a
// different decision from reverting an empty one, so the confirm names the table
// and says how many scores will be discarded. Once reverted, the table can be
// canceled with the normal AdminCancelTableButton (revert -> cancel).
export default function AdminRevertTableButton({
  tableId,
  status,
  locationName,
  dateLabel,
  scoreCount,
  onReverted,
}: {
  tableId: string;
  status: string;
  locationName: string;
  dateLabel: string;
  scoreCount: number;
  onReverted?: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "completed") return null;

  async function onRevert() {
    const scoreLine =
      scoreCount > 0
        ? `This table has scores for ${scoreCount} player${scoreCount === 1 ? "" : "s"} — reverting will permanently discard them and remove them from standings.`
        : `This table has no scores entered.`;
    const ok = await confirm({
      title: "Revert this table to open?",
      message: `“${locationName}” on ${dateLabel}\n\n${scoreLine}\n\nThe table goes back to open/full so it can be played again or canceled.`,
      confirmLabel: "Revert table",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revert_completed" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Could not revert the table.");
        return;
      }
      if (onReverted) onReverted();
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={onRevert}
        disabled={busy}
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "5px 12px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}
      >
        {busy ? "Reverting…" : "Revert to open"}
      </button>
      {error ? <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span> : null}
    </div>
  );
}
