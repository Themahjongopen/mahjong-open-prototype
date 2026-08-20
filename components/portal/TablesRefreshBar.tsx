"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { useOpenTablesRealtime } from "./useOpenTablesRealtime";

// Header bar for Open Tables: a connection-state indicator + "Updated X ago" +
// a manual Refresh button.
//
// Live updates (Supabase Realtime) refetch the page automatically, but a phone
// that sleeps or loses signal can silently stop receiving events. The indicator
// tells the truth about that: it shows "Live" ONLY while the channel is healthy,
// and otherwise falls back to a visible "Updated X ago" and points at Refresh.
// The manual button never goes away — it is the fallback when the live path
// fails. Half the affected players are 60+ on phones, so state is conveyed with a
// word, not a coloured dot alone.

function relativeLabel(deltaMs: number): string {
  const s = Math.floor(deltaMs / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s} seconds ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  return `${h} hour${h === 1 ? "" : "s"} ago`;
}

function Dot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0, display: "inline-block" }}
    />
  );
}

export default function TablesRefreshBar({
  loadedAt,
  cityId,
  tableIds,
  nextHoldExpiry = null,
}: {
  loadedAt: number;
  cityId: string | null;
  tableIds: string[];
  // Epoch ms of the soonest live-hold expiry across the shown tables, or null.
  // A lapsing hold writes nothing (expiry is read-derived), so no Realtime event
  // fires — this schedules a refetch at that instant so the reopened seat shows
  // without a manual refresh. Complements, doesn't replace, the manual fallback.
  nextHoldExpiry?: number | null;
}) {
  const router = useRouter();

  useEffect(() => {
    if (nextHoldExpiry == null) return;
    const delay = nextHoldExpiry - Date.now();
    if (delay <= 0) {
      router.refresh();
      return;
    }
    const timer = setTimeout(() => router.refresh(), delay + 500); // small cushion past the boundary
    return () => clearTimeout(timer);
  }, [nextHoldExpiry, router]);
  // router.refresh() returns void without awaiting the server refetch, so a
  // transition holds isPending true until the fresh data commits.
  const [isPending, startTransition] = useTransition();

  // `now` ticks the "X ago" label forward without any network work. Starts equal
  // to loadedAt so server and first client render agree (no hydration mismatch),
  // then the effect switches to the real clock; it re-runs whenever loadedAt
  // changes (a fresh load — manual or a live refetch), resetting to "just now".
  const [now, setNow] = useState(loadedAt);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [loadedAt]);

  const status = useOpenTablesRealtime(cityId, tableIds);
  const ago = relativeLabel(now - loadedAt);

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  // Left-hand status line. Priority: a manual refresh in flight > live > the
  // connecting/offline fallbacks (both of which keep the honest timestamp).
  let statusLine: React.ReactNode;
  if (isPending) {
    statusLine = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Dot color="var(--ink-400)" />
        <span style={{ color: "var(--ink-700)" }}>Refreshing…</span>
      </span>
    );
  } else if (status === "live") {
    statusLine = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <Dot color="var(--lime-600)" />
        <span style={{ color: "var(--ink-800)", fontWeight: 600 }}>Live</span>
        <span style={{ color: "var(--ink-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          · updated {ago}
        </span>
      </span>
    );
  } else if (status === "connecting") {
    statusLine = (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
        <Dot color="var(--ink-400)" />
        <span style={{ color: "var(--ink-700)" }}>Connecting… · updated {ago}</span>
      </span>
    );
  } else {
    // offline — the important case: be visible and honest, and point at Refresh.
    statusLine = (
      <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
          <Dot color="var(--crimson-500)" />
          <span style={{ color: "var(--ink-800)", fontWeight: 600 }}>Updated {ago}</span>
        </span>
        <span style={{ fontSize: 12, color: "var(--ink-500)" }}>Live updates unavailable — tap Refresh</span>
      </span>
    );
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
      <span aria-live="polite" style={{ fontSize: 13, minWidth: 0 }}>
        {statusLine}
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
