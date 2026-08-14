"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Avatar from "@/components/portal/Avatar";

// Same skill → badge-color map used across the portal (OpenTableCard,
// TableDetailClient, Directory, standings). Duplicated again here; a shared
// constant is overdue but out of scope for this feature.
const SKILL_COLORS: Record<string, string> = {
  beginner: "badge-lime",
  intermediate: "badge-peri",
  advanced: "badge-pink",
};

type Candidate = {
  profile_id: string;
  full_name: string | null;
  avatar_url: string | null;
  skill_level: string | null;
  already_invited: boolean;
};

type InviteResult = { sent: number; skipped: number; failed: number };

// "Invite players" modal for a table. Opened from TableDetailClient by a seated
// player. Fetches eligible candidates for THIS table (GET), lets the player pick
// up to the number of open seats, and sends invites (POST). Does not seat anyone
// — invites are notifications; recipients still tap "Join this table".
//
// Follows AdminCitySwitcher's proven list pattern: capped-height scroll region,
// a pinned autofocused search filtering the already-fetched list client-side,
// and a "No players match" empty state. NOT a native <select multiple> (unusable
// on mobile, and a city can have ~70+ players).
export default function InvitePlayersModal({
  tableId,
  openSeats: initialOpenSeats,
  onClose,
  onInvited,
}: {
  tableId: string;
  openSeats: number;
  onClose: () => void;
  onInvited: (result: InviteResult) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  // Authoritative cap comes from GET; seed with the client's count so the header
  // is right before the fetch resolves.
  const [openSeats, setOpenSeats] = useState(initialOpenSeats);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tables/${tableId}/invites`, { credentials: "include" });
        const payload = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(payload.error || "Couldn't load players.");
        } else {
          setCandidates(payload.candidates ?? []);
          setOpenSeats(payload.openSeats ?? initialOpenSeats);
        }
      } catch {
        if (!cancelled) setLoadError("Couldn't load players.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tableId, initialOpenSeats]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? candidates.filter((c) => (c.full_name ?? "").toLowerCase().includes(q)) : candidates),
    [candidates, q]
  );

  const atCap = selected.size >= openSeats;

  function toggle(profileId: string, alreadyInvited: boolean) {
    if (alreadyInvited) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) {
        next.delete(profileId);
      } else if (next.size < openSeats) {
        next.add(profileId);
      }
      return next;
    });
  }

  async function send() {
    if (selected.size === 0 || sending) return;
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/tables/${tableId}/invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: [...selected] }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(payload.error || "Couldn't send the invites.");
        return;
      }
      onInvited({ sent: payload.sent ?? 0, skipped: payload.skipped ?? 0, failed: payload.failed ?? 0 });
      onClose();
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invite players"
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div style={{ position: "absolute", inset: 0, background: "rgba(20,30,33,0.45)" }} onClick={onClose} />
      <div
        style={{
          position: "relative",
          background: "#fff",
          width: "100%",
          maxWidth: 480,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          borderTopLeftRadius: "var(--radius-lg)",
          borderTopRightRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--hair-200)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", margin: 0 }}>Invite players</p>
            <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-500)", padding: 4, display: "flex" }}>
              <X size={20} />
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-500)", margin: "4px 0 0" }}>
            They&rsquo;ll get an email invitation. Seats are first come, first served — inviting isn&rsquo;t saving a seat.
          </p>
          {/* Pinned search */}
          <div style={{ marginTop: 12 }}>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search players…"
              aria-label="Search players"
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", fontSize: 14, border: "1px solid var(--hair-200)", borderRadius: 8, outline: "none" }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {loading ? (
            <p style={{ fontSize: 14, color: "var(--ink-500)", padding: "20px 16px", margin: 0 }}>Loading players…</p>
          ) : loadError ? (
            <p style={{ fontSize: 14, color: "var(--danger)", padding: "20px 16px", margin: 0 }}>{loadError}</p>
          ) : filtered.length === 0 ? (
            <p style={{ fontSize: 14, color: "var(--ink-500)", padding: "20px 16px", margin: 0 }}>
              {candidates.length === 0 ? "No other players are available to invite." : "No players match."}
            </p>
          ) : (
            filtered.map((c) => {
              const checked = selected.has(c.profile_id);
              const disabled = c.already_invited || (!checked && atCap);
              return (
                <button
                  key={c.profile_id}
                  type="button"
                  onClick={() => toggle(c.profile_id, c.already_invited)}
                  disabled={disabled}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: checked ? "var(--pink-50)" : "none",
                    border: "none",
                    borderBottom: "1px solid var(--hair-200)",
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled && !c.already_invited ? 0.5 : 1,
                    textAlign: "left",
                  }}
                >
                  <Avatar src={c.avatar_url} size={36} alt={c.full_name ?? "Player"} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-900)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.full_name ?? "Player"}
                      {c.skill_level ? (
                        <span className={`badge ${SKILL_COLORS[c.skill_level] ?? "badge-mute"}`} style={{ fontSize: 10, marginLeft: 6 }}>
                          {c.skill_level}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {c.already_invited ? (
                    <span className="badge badge-mute" style={{ fontSize: 11, flexShrink: 0 }}>Invited</span>
                  ) : (
                    <span
                      aria-hidden
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 5,
                        flexShrink: 0,
                        border: checked ? "none" : "1.5px solid var(--hair-300)",
                        background: checked ? "var(--pink-500)" : "#fff",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        lineHeight: 1,
                      }}
                    >
                      {checked ? "✓" : ""}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--hair-200)", display: "flex", flexDirection: "column", gap: 10 }}>
          {sendError ? <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{sendError}</p> : null}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13, color: "var(--ink-500)" }}>
              {selected.size} of {openSeats} selected
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending} style={{ padding: "10px 16px" }}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={selected.size === 0 || sending} style={{ padding: "10px 16px" }}>
                {sending ? "Sending…" : selected.size > 0 ? `Invite ${selected.size}` : "Invite"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
