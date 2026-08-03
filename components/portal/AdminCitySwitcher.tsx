"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, ChevronDown, Check } from "lucide-react";

type City = { id: string; name: string };

// Admin-only "acting in" city switcher shown in the portal app bar. Sets the
// admin_active_city cookie via /api/portal/admin-city, then refreshes so the
// server components (tables, standings, directory, stats) re-read for the new
// city. Visible only when the shell passes cities (i.e. the viewer is an admin).
export default function AdminCitySwitcher({
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
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  if (cities.length === 0) return null;

  // Reset the search when the menu closes so stale text doesn't carry over.
  function close() {
    setOpen(false);
    setQuery("");
  }

  const q = query.trim().toLowerCase();
  const filtered = q ? cities.filter((c) => c.name.toLowerCase().includes(q)) : cities;

  async function pick(cityId: string) {
    close();
    if (cityId === activeCityId) return;
    setBusy(true);
    try {
      await fetch("/api/portal/admin-city", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cityId }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        disabled={busy}
        aria-label="Switch active city"
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
          cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
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
          <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={close} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              background: "#fff",
              border: "1px solid var(--hair-200)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              minWidth: 220,
              zIndex: 200,
              overflow: "hidden",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-500)", padding: "10px 14px 6px", margin: 0 }}>
              Acting in city
            </p>
            {/* Search filters the (now up to 21+) cities client-side; the list
                below scrolls while this input stays pinned. */}
            <div style={{ padding: "0 10px 8px" }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cities…"
                aria-label="Search cities"
                autoFocus
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "7px 10px",
                  fontSize: 13,
                  border: "1px solid var(--hair-200)",
                  borderRadius: "8px",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              {filtered.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-500)", padding: "8px 14px 12px", margin: 0 }}>No cities match.</p>
              ) : (
                filtered.map((c) => {
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
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
