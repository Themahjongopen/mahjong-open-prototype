"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Clock, Users } from "lucide-react";
// activeSeats + the LeagueTable type come from the pure ./seats module (not
// ./tables) so this client component doesn't pull server-only code into the bundle.
import { activeSeats, activeHolds, type LeagueTable } from "@/lib/portal/seats";
import { useToast } from "@/components/portal/PortalShellClient";
import { useConfirm } from "@/components/ConfirmProvider";
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
  const confirm = useConfirm();
  const [joining, setJoining] = useState(false);
  // Synchronous reentrancy guard: flips before the confirm await, so a replayed
  // tap arriving while the confirm modal is open is dropped rather than queuing a
  // second modal or a second join. `joining` (disabled) alone can't stop a replay
  // that lands before React re-renders. (Kate Gundling: a queued tap replaying
  // after a hung render seated her at a table she never chose.)
  const inFlight = useRef(false);

  const active = activeSeats(table.table_seats);
  const activeCount = active.length;
  const seatedIds = new Set(active.map((s) => s.user_id));
  // Live holds count toward capacity (a held seat isn't publicly joinable), but a
  // hold for someone already seated is never double-counted.
  const liveHolds = activeHolds(table.holds ?? []).filter((h) => !seatedIds.has(h.invited_profile_id));
  const heldCount = liveHolds.length;
  const filled = activeCount + heldCount;
  // Public open-seat count, used for the DISPLAY ("N seated · M held · K open") —
  // the viewer's own hold still shows as held here, which is truthful.
  const seatsLeft = Math.max(0, 4 - filled);
  const isSeated = active.some((s) => s.user_id === currentUserId);
  const isCreator = table.creator_id === currentUserId;
  // The viewer can take the seat that is held FOR THEM, so their own hold must not
  // count against them in the join gate — mirrors claim_seat and TableDetailClient
  // (see CLAUDE.md "Capacity math"). Without this, a held-full table was unjoinable
  // for the exact person it was held for.
  const viewerHasHold = liveHolds.some((h) => h.invited_profile_id === currentUserId);
  const openForViewer = seatsLeft + (viewerHasHold ? 1 : 0);
  const canJoin = !isSeated && !isCreator && openForViewer > 0 && table.status === "open";

  async function handleJoin(e: React.MouseEvent) {
    e.stopPropagation(); // don't also trigger the card's navigate
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      // Confirm BEFORE any network request — restating the specific table so an
      // accidental/replayed tap on an unfamiliar date is caught, and reminding an
      // intentional joiner of the 24h no-show commitment (matches the leave modal).
      const dateLabel = new Date(`${table.table_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
      const ok = await confirm({
        title: "Join this table?",
        message: `${dateLabel} at ${formatTableTime(table.table_time)}\n${table.location_name}\n\nLeaving within 24 hours counts as a no-show.`,
        confirmLabel: "Take a seat",
      });
      if (!ok) return;
      setJoining(true);
      const res = await fetch(`/api/tables/${table.id}/seats`, { method: "POST" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(payload.error || "Something went wrong.");
        return;
      }
      showToast("Seat claimed!");
      router.refresh();
    } finally {
      inFlight.current = false;
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
            {/* Area near the location so the Area filter's effect is legible on the
                card. Pre-area tables have no area and simply show nothing here. */}
            {table.area ? (
              <span className="badge badge-lime" style={{ fontSize: 11 }}>{table.area}</span>
            ) : null}
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
            <span key={s.user_id} style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%" }}>
              <span title={s.profiles?.full_name ?? undefined} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                {s.profiles?.full_name ?? "Player"}
              </span>
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
            {[1, 2, 3, 4].map((n) => {
              const seated = n <= activeCount;
              const held = !seated && n <= activeCount + heldCount;
              // Seated = solid; held = outline (reserved, not taken); open = grey.
              return (
                <div
                  key={n}
                  style={{ width: 22, height: 22, borderRadius: "50%", background: seated ? "var(--pink-400)" : held ? "#fff" : "var(--hair-200)", border: held ? "2px solid var(--pink-300)" : "2px solid #fff" }}
                />
              );
            })}
          </div>
          <span style={{ color: seatsLeft === 0 ? "var(--danger)" : "var(--ink-500)" }}>
            {heldCount > 0
              ? `${activeCount} seated · ${heldCount} held${seatsLeft > 0 ? ` · ${seatsLeft} open` : ""}`
              : seatsLeft === 0
                ? "Full"
                : `${seatsLeft} spot${seatsLeft !== 1 ? "s" : ""} left`}
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
