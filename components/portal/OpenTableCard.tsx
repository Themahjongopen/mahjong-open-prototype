"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Users } from "lucide-react";
// activeSeats + the LeagueTable type come from the pure ./seats module (not
// ./tables) so this client component doesn't pull server-only code into the bundle.
import { activeSeats, type LeagueTable } from "@/lib/portal/seats";
import { useToast } from "@/components/portal/PortalShellClient";
import { formatTableTime } from "@/lib/format/time";

const SKILL_COLORS: Record<string, string> = {
  beginner: "badge-lime",
  intermediate: "badge-peri",
  advanced: "badge-pink",
};

// Table-status → badge color. Only surfaces in the "All" view, where non-open
// tables can appear; the default "Open" view only ever shows open tables so the
// badge is suppressed for those. Duplicated locally per the codebase convention
// (the same small map lives in my-tables/page.tsx, TableDetailClient, and admin).
const STATUS_COLORS: Record<string, string> = {
  open: "badge-lime", full: "badge-peri", completed: "badge-mute", canceled: "badge-mute",
};

// One open-table row on the Open Tables list. The whole card navigates to the
// detail page; a Join button (when eligible) seats the viewer in place. The card
// can't be an <a> because it contains a <button> (invalid nested interactives),
// so navigation is an onClick and Join calls stopPropagation to avoid double-firing.
export default function OpenTableCard({ table, currentUserId }: { table: LeagueTable; currentUserId: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);

  const active = activeSeats(table.table_seats);
  const filled = active.length;
  const seatsLeft = 4 - filled;
  const isSeated = active.some((s) => s.user_id === currentUserId);
  const isCreator = table.creator_id === currentUserId;
  const canJoin = !isSeated && !isCreator && seatsLeft > 0 && table.status === "open";

  async function handleJoin(e: React.MouseEvent) {
    e.stopPropagation(); // don't also trigger the card's navigate
    setJoining(true);
    try {
      const res = await fetch(`/api/tables/${table.id}/seats`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(payload.error || "Something went wrong.");
        return;
      }
      showToast("Seat claimed!");
      router.refresh();
    } finally {
      setJoining(false);
    }
  }

  return (
    <div
      onClick={() => router.push(`/portal/tables/${table.id}`)}
      style={{
        cursor: "pointer",
        background: "#fff",
        border: isSeated ? "2px solid var(--pink-300)" : "1px solid var(--hair-200)",
        borderRadius: "var(--radius-lg)",
        padding: "16px 18px",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", marginBottom: 2 }}>
            {new Date(`${table.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {table.table_time ? (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink-500)" }}>
                <Clock size={12} /> {formatTableTime(table.table_time)}
              </span>
            ) : null}
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "var(--ink-500)" }}>
              <MapPin size={12} />
              {table.location_name}
              {table.location_address ? `, ${table.location_address}` : ""}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {/* Round type — mirrors the detail page's badge so a player can see
              Social/Focused/Lightning before tapping Join straight from the list. */}
          {table.round_type && (
            <span className="badge badge-peri" style={{ textTransform: "capitalize" }}>{table.round_type}</span>
          )}
          {/* Status is only meaningful (and only shown) when it's not "open" —
              i.e. a non-open table surfaced by the "All" view. */}
          {table.status !== "open" && (
            <span className={`badge ${STATUS_COLORS[table.status] ?? "badge-mute"}`} style={{ textTransform: "capitalize" }}>{table.status}</span>
          )}
          {isSeated && <span className="badge badge-pink">Joined</span>}
        </div>
      </div>

      {active.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, fontSize: 13, color: "var(--ink-700)" }}>
          {active.map((s) => (
            <span key={s.user_id} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              {s.profiles?.full_name?.split(" ")[0] ?? "Player"}
              {s.profiles?.skill_level && (
                <span className={`badge ${SKILL_COLORS[s.profiles.skill_level] ?? "badge-mute"}`} style={{ fontSize: 10 }}>{s.profiles.skill_level}</span>
              )}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
          <Users size={13} color="var(--ink-500)" />
          <div style={{ display: "flex", gap: 4 }}>
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{ width: 22, height: 22, borderRadius: "50%", background: n <= filled ? "var(--pink-400)" : "var(--hair-200)", border: "2px solid #fff" }}
              />
            ))}
          </div>
          <span style={{ color: seatsLeft === 0 ? "var(--danger)" : "var(--ink-500)" }}>
            {seatsLeft === 0 ? "Full" : `${seatsLeft} spot${seatsLeft !== 1 ? "s" : ""} left`}
          </span>
        </div>
        {canJoin && (
          <button type="button" onClick={handleJoin} disabled={joining} className="btn btn-primary" style={{ fontSize: 13, padding: "8px 16px" }}>
            {joining ? "Joining…" : "Join"}
          </button>
        )}
      </div>
    </div>
  );
}
