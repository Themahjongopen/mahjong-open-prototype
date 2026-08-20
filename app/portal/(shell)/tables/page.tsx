import Link from "next/link";
import { Plus } from "lucide-react";
import { getPortalClaims } from "@/lib/portal/session";
import { withAdminCity } from "@/lib/portal/adminCity";
import { getOpenTables, getAllTables, getCityName, type LeagueTable } from "@/lib/portal/tables";
import { HOLD_TTL_MS } from "@/lib/portal/holdExpiry";
import TablesFilterList from "@/components/portal/TablesFilterList";
import TablesRefreshBar from "@/components/portal/TablesRefreshBar";

export default async function TablesPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showAll = view === "all";
  // Read-only table list: locally-verified claims are enough (no getUser round-trip).
  const session = await getPortalClaims();
  // Admins have no home city; the table reads reflect their active-city selection.
  const member = session && session.status === "active" ? await withAdminCity(session) : null;
  const [tables, cityName] = member
    ? await Promise.all([showAll ? getAllTables(member) : getOpenTables(member), getCityName(member.city_id)])
    : [[] as LeagueTable[], null];

  // Timestamp of this server render, handed to the client refresh bar for its
  // "Updated X ago" label. The page is dynamic (reads cookies), so it re-renders
  // per request — including on router.refresh() — giving a fresh value each time.
  // Epoch ms is timezone-independent, so the client's delta is correct regardless
  // of the server/viewer clock offset.
  const loadedAt = Date.now();

  // Soonest live-hold expiry across the shown tables — the refresh bar schedules a
  // refetch at that instant, since a lapsing hold emits no Realtime event.
  const holdExpiries = tables
    .flatMap((t) => (t.holds ?? []).filter((h) => h.status === "pending").map((h) => new Date(h.created_at).getTime() + HOLD_TTL_MS))
    .filter((ms) => ms > loadedAt);
  const nextHoldExpiry = holdExpiries.length ? Math.min(...holdExpiries) : null;

  // Open/All view toggle. Server-side URL param (no client state) so the page
  // stays a server component. Default (no param) is "Open" — byte-identical to
  // the pre-toggle behavior.
  const TOGGLE_BASE: React.CSSProperties = {
    flex: 1, textAlign: "center", padding: "7px 12px", fontSize: 13, fontWeight: 600,
    borderRadius: "999px", textDecoration: "none", transition: "background 120ms, color 120ms",
  };
  const activeStyle: React.CSSProperties = { ...TOGGLE_BASE, background: "var(--pink-500)", color: "#fff" };
  const inactiveStyle: React.CSSProperties = { ...TOGGLE_BASE, background: "transparent", color: "var(--ink-700)" };

  return (
    <div style={{ padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          {cityName ? <p className="eyebrow" style={{ marginBottom: 4 }}>{cityName}</p> : null}
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)" }}>Tables</h2>
        </div>
        <Link href="/portal/tables/create" className="btn btn-primary" style={{ fontSize: 13, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Create
        </Link>
      </div>

      <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--hair-200)", borderRadius: "999px", marginBottom: 16 }}>
        <Link href="/portal/tables" style={showAll ? inactiveStyle : activeStyle}>Open</Link>
        <Link href="/portal/tables?view=all" style={showAll ? activeStyle : inactiveStyle}>All</Link>
      </div>

      {/* Manual refresh + "Updated X ago". Renders in both the list and the
          empty-state cases (a player waiting for the first table of the night is
          exactly who needs it), so it sits above the zero-tables branch. */}
      <TablesRefreshBar loadedAt={loadedAt} cityId={member?.city_id ?? null} tableIds={tables.map((t) => t.id)} nextHoldExpiry={nextHoldExpiry} />

      {tables.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--ink-500)" }}>
          <p style={{ fontSize: 16, marginBottom: 16 }}>{showAll ? "No tables at all right now." : "No open tables right now."}</p>
          <Link href="/portal/tables/create" className="btn btn-primary" style={{ fontSize: 14, display: "inline-flex" }}>
            Create the first one →
          </Link>
        </div>
      )}

      {/* Client-side round / day / time-of-day filtering of the fetched list.
          Rendered only when there are tables — the empty state above owns the
          zero-tables case, so filter controls never show with nothing to filter. */}
      {tables.length > 0 && (
        <TablesFilterList tables={tables} currentUserId={member?.id ?? null} />
      )}
    </div>
  );
}
