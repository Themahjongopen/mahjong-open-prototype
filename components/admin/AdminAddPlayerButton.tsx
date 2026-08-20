"use client";

import { useEffect, useRef, useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";

type Candidate = { profile_id: string; full_name: string | null; skill_level: string | null };

// Inline "Add player" control on /admin/tables. Opens a searchable picker of the
// table's eligible cohort (paid, this city+series, directory-agnostic, minus those
// already seated), confirms the choice, and seats them via
// PATCH /api/admin/tables/[id] { action: "add_seat" } — which routes through
// claim_seat (capacity-safe, advisory-locked). Only rendered on open/full tables;
// the server re-enforces status, eligibility, and capacity. Modeled on
// AdminRemovePlayerButton, with the join-confirm's synchronous useRef reentrancy
// guard so a doubled click can't seat twice.
export default function AdminAddPlayerButton({
  tableId,
  tableLabel,
  onAdded,
}: {
  tableId: string;
  tableLabel: string;
  onAdded: () => void;
}) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Synchronous guard: flips before the confirm await, so a replayed tap arriving
  // while the confirm modal is open is dropped rather than seating a second time.
  const addInFlight = useRef(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingList(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/admin/tables/${tableId}/eligible`, { credentials: "include" });
        const payload = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setError(payload.error || "Couldn't load players.");
          setCandidates([]);
        } else {
          setCandidates(payload.players ?? []);
        }
      } catch {
        if (active) setError("Couldn't load players.");
      } finally {
        if (active) setLoadingList(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, tableId]);

  const q = search.trim().toLowerCase();
  const filtered = q ? candidates.filter((c) => (c.full_name ?? "").toLowerCase().includes(q)) : candidates;

  async function handlePick(c: Candidate) {
    if (addInFlight.current) return;
    addInFlight.current = true;
    try {
      const ok = await confirm({
        title: "Add this player?",
        message: `Add ${c.full_name ?? "this player"} to ${tableLabel}? They'll be emailed that they've been added, and the 24-hour no-show rule will apply to them.`,
        confirmLabel: "Add player",
      });
      if (!ok) return;
      setBusy(true);
      setError(null);
      const res = await fetch(`/api/admin/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_seat", userId: c.profile_id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(payload.error || "Couldn't add that player.");
        return;
      }
      // Success (incl. the idempotent "already seated" case) — close and refresh.
      setOpen(false);
      setSearch("");
      onAdded();
    } finally {
      setBusy(false);
      addInFlight.current = false;
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost"
        style={{ fontSize: 11, padding: "2px 8px", color: "var(--pink-700)", borderColor: "var(--pink-100)" }}
      >
        Add player
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add a player to this table"
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "var(--overlay-scrim, rgba(20,47,52,0.4))" }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          setOpen(false);
          setSearch("");
        }
      }}
    >
      <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 380, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--hair-200)" }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-900)", margin: 0 }}>Add a player</p>
          <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>{tableLabel}</p>
        </div>
        <div style={{ padding: "10px 16px 8px" }}>
          <input
            type="search"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            aria-label="Search players"
            className="input-mo"
            style={{ width: "100%", fontSize: 14 }}
          />
        </div>
        <div style={{ flex: 1, overflowY: "auto", minHeight: 80 }}>
          {loadingList ? (
            <p style={{ padding: 16, fontSize: 13, color: "var(--ink-500)" }}>Loading…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: 16, fontSize: 13, color: "var(--ink-500)" }}>
              {candidates.length === 0 ? "No eligible players to add." : "No players match."}
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.profile_id}
                type="button"
                onClick={() => handlePick(c)}
                disabled={busy}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left", padding: "10px 16px", background: "#fff", border: "none", borderBottom: "1px solid var(--hair-100)", cursor: busy ? "default" : "pointer", opacity: busy ? 0.5 : 1 }}
              >
                <span style={{ fontSize: 14, color: "var(--ink-800)" }}>{c.full_name ?? "Player"}</span>
                {c.skill_level ? <span style={{ fontSize: 11, color: "var(--ink-400)", textTransform: "capitalize" }}>{c.skill_level}</span> : null}
              </button>
            ))
          )}
        </div>
        {error ? <p style={{ padding: "8px 16px", fontSize: 12, color: "var(--danger)", margin: 0 }}>{error}</p> : null}
        <div style={{ padding: "10px 16px", borderTop: "1px solid var(--hair-200)", textAlign: "right" }}>
          <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); setSearch(""); }} disabled={busy} style={{ fontSize: 13, padding: "6px 14px" }}>
            {busy ? "Adding…" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
