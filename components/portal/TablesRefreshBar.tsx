"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

// "Updated X ago" for the Open Tables list. The Phase-1 audit found the portal
// has no polling and no realtime, so this list only reflects the moment it was
// last loaded — a player sitting on it never sees a newly-created table appear.
// This bar makes that staleness legible (a visible relative timestamp) and gives
// an obvious, labelled way to pull fresh data. Half the affected players are 60+
// on phones, so the control is a big labelled button, not an icon alone.

// Relative label from a millisecond delta. Coarse on purpose — a player only
// needs "is this current or old", not second precision. Clamps negatives (client
// clock slightly behind the server render clock) to "just now".
function relativeLabel(deltaMs: number): string {
  const s = Math.floor(deltaMs / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}

export default function TablesRefreshBar({ loadedAt }: { loadedAt: number }) {
  const router = useRouter();
  // router.refresh() returns void without awaiting the server refetch, so a
  // transition is what holds isPending true until the fresh data commits — same
  // pattern PlayerCitySwitcher / AdminCitySwitcher use.
  const [isPending, startTransition] = useTransition();

  // `now` ticks the label forward without any network work. It starts equal to
  // loadedAt so the server render and the first client render agree ("just now",
  // no hydration mismatch); the effect then switches it to the real clock. The
  // effect re-runs whenever loadedAt changes (a fresh load after refresh), which
  // resets the label back to "just now".
  const [now, setNow] = useState(loadedAt);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [loadedAt]);

  const label = isPending ? "Refreshing…" : `Updated ${relativeLabel(now - loadedAt)}`;

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 16,
      }}
    >
      <span
        aria-live="polite"
        style={{ fontSize: 13, color: "var(--ink-500)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        aria-label="Refresh tables"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--pink-50)",
          border: "1px solid var(--pink-100)",
          borderRadius: "999px",
          padding: "8px 16px",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--pink-700)",
          cursor: isPending ? "default" : "pointer",
          opacity: isPending ? 0.6 : 1,
          flexShrink: 0,
        }}
      >
        <RotateCw size={15} className={isPending ? "spin" : undefined} />
        Refresh
      </button>
    </div>
  );
}
