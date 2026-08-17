"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

// Admin cancel action for /admin/tables. Calls the SAME endpoint as the portal
// host-cancel (PATCH /api/tables/[id], action: "cancel"), which already allows
// admins and does NOT gate on the city's is_active — so it works for a
// deactivated city without reactivating it first. Cancelling emails every seated
// player (handled server-side). Only cancellable statuses get a button; the rest
// render a dash so the grid keeps one cell per row (column alignment).
const CANCELLABLE = new Set(["open", "full"]);

export default function AdminCancelTableButton({
  tableId,
  status,
  locationName,
  dateLabel,
}: {
  tableId: string;
  status: string;
  locationName: string;
  dateLabel: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!CANCELLABLE.has(status)) {
    return <span style={{ fontSize: 13, color: "var(--ink-400)" }}>—</span>;
  }

  async function onCancel() {
    const ok = await confirm({
      title: "Cancel this table?",
      message: `Cancel “${locationName}” on ${dateLabel}? Every seated player will be emailed, and this can’t be undone.`,
      confirmLabel: "Cancel table",
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(payload.error || "Could not cancel the table.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="btn btn-ghost"
        style={{ fontSize: 12, padding: "5px 12px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}
      >
        {busy ? "Canceling…" : "Cancel"}
      </button>
      {error ? <span style={{ fontSize: 11, color: "var(--danger)" }}>{error}</span> : null}
    </div>
  );
}
