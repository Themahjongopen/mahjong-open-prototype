"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, Check } from "lucide-react";

type City = { id: string; name: string };

// Multi-city player's "viewing city" switcher shown in the portal app bar. Sets
// the player_active_city cookie via /api/portal/active-city, then refreshes so
// the server components (dashboard, tables, standings, directory, stats) re-read
// for the new city. The app bar only renders this when the player holds more
// than one city (a single-city player never sees it).
export default function PlayerCitySwitcher({
  cities,
  activeCityId,
  activeCityName,
}: {
  cities: City[];
  activeCityId: string | null;
  activeCityName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // The switcher must never look idle/clickable while the page still shows the
  // OLD city. Two overlapping phases keep it disabled the whole way:
  //   busy       — the POST that sets the cookie (isPending isn't true yet here)
  //   isPending  — router.refresh()'s server refetch. router.refresh() returns
  //                void and does NOT await the refetch, so a transition is what
  //                holds "pending" true until the new data actually commits.
  // Keying the disabled state off the POST alone (the original bug) left the pill
  // clickable while stale ~75% of the time at a normal click-then-glance speed.
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pending = busy || isPending;

  if (cities.length === 0) return null;

  async function pick(cityId: string) {
    setOpen(false);
    if (cityId === activeCityId) return; // no-op: just close, never enter pending
    setBusy(true);
    try {
      await fetch("/api/portal/active-city", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId }),
      });
    } finally {
      // Hand the pending state off from the POST (busy) to the refetch (isPending)
      // in one batched update, so there's no frame where the pill looks idle.
      setBusy(false);
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        aria-label="Switch viewing city"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "var(--pink-50)",
          border: "1px solid var(--pink-100)",
          borderRadius: "999px",
          padding: "6px 12px",
          fontSize: 13,
          fontWeight: 600,
          color: "var(--pink-700)",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.6 : 1,
          maxWidth: 200,
        }}
      >
        <MapPin size={14} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activeCityName ?? "Select city"}
        </span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open ? (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => setOpen(false)} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "#fff",
              border: "1px solid var(--hair-200)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              minWidth: 200,
              zIndex: 200,
              overflow: "hidden",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-500)", padding: "10px 14px 6px", margin: 0 }}>
              Viewing city
            </p>
            {cities.map((c) => {
              const isActive = c.id === activeCityId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "10px 14px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 14,
                    color: "var(--ink-800)",
                    textAlign: "left",
                  }}
                >
                  {c.name}
                  {isActive ? <Check size={15} color="var(--pink-600)" /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
