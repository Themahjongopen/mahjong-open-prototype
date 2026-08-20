"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/portal/PortalShellClient";
import { useConfirm } from "@/components/ConfirmProvider";

// Shown to an actively-seated NON-host player once the table's start time has
// passed: records the host as a no-show when the host is the one who didn't show
// (the table can't play three-handed). One action, no score entry. The server
// re-checks seating, the not-the-host rule, the start-time gate, and dedupes.
export default function HostNoShowButton({
  tableId,
  hostName,
  tableLabel,
  onDone,
}: {
  tableId: string;
  hostName: string;
  tableLabel: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  // Synchronous guard, flipped before the confirm await — a replayed tap while the
  // dialog is open is dropped, so a doubled click can't record two no-shows.
  const inFlight = useRef(false);

  async function mark() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const ok = await confirm({
        title: "Are you sure you want to mark this host as a no-show?",
        message: `This records ${hostName} as a no-show for ${tableLabel}. The host takes a −20 penalty for the week and no scores are entered. This can't be undone from here — an admin can correct it if needed.`,
        confirmLabel: "Mark as no-show",
        danger: true,
      });
      if (!ok) return;
      setBusy(true);
      const res = await fetch(`/api/tables/${tableId}/host-no-show`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(payload.error || "Couldn't record that.");
        return;
      }
      showToast("Host recorded as a no-show.");
      onDone();
      router.refresh();
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  return (
    <button
      type="button"
      onClick={mark}
      disabled={busy}
      className="btn btn-ghost"
      style={{ justifyContent: "center", padding: "13px", color: "var(--danger)", borderColor: "rgba(200,16,46,0.3)" }}
    >
      {busy ? "Recording…" : "Mark host as a no-show"}
    </button>
  );
}
