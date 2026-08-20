"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

// Inline week selector for /admin/tables — the only UI to correct a mislabeled
// week_number (the create route now derives it from the date, and the edit route
// never touched it, so a wrong week previously required direct DB access). Picking
// the date-derived week just applies; picking any other value triggers a confirm
// (the server returns 409 needsConfirm, and we re-send with confirm:true). Standings
// recompute on read, so a correction shows up immediately even on a scored table.
export default function AdminSetWeekButton({
  tableId,
  weekNumber,
  onUpdated,
}: {
  tableId: string;
  weekNumber: number;
  onUpdated?: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(week: number, confirmed = false) {
    if (week === weekNumber && !confirmed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set_week", week, ...(confirmed ? { confirm: true } : {}) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.status === 409 && payload?.needsConfirm) {
        const ok = await confirm({
          title: "Set a week that doesn't match the date?",
          message: `${payload.error} Set it anyway?`,
          confirmLabel: `Set Week ${week}`,
          danger: true,
        });
        if (ok) return change(week, true);
        return; // reverted — no DB change; the select re-renders to the current value
      }
      if (!res.ok) {
        setError(payload?.error || "Couldn't set the week.");
        return;
      }
      if (onUpdated) onUpdated();
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 2, alignItems: "flex-start" }}>
      <select
        aria-label="Set week"
        value={weekNumber}
        disabled={busy}
        onChange={(e) => change(Number(e.target.value))}
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink-500)",
          border: "1px solid var(--hair-300)",
          borderRadius: 6,
          padding: "2px 4px",
          background: "#fff",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
          <option key={w} value={w}>
            W{w}
          </option>
        ))}
      </select>
      {error ? <span style={{ fontSize: 10, color: "var(--danger)" }}>{error}</span> : null}
    </div>
  );
}
