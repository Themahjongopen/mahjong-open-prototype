"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";

type City = { id: string; name: string; state: string | null };
type Series = { id: string; name: string; starts_at: string; ends_at: string; is_active: boolean };
type Candidate = { profile_id: string; full_name: string | null; skill_level: string | null };
type Slot = { user_id: string; round_score: string; is_no_show: boolean };

const ROUND_TYPES = [
  { value: "casual", label: "Casual" },
  { value: "mindful", label: "Mindful" },
  { value: "lightning", label: "Lightning" },
];
const EMPTY_SLOT: Slot = { user_id: "", round_score: "0", is_no_show: false };

// Admin "Record a past round": one submission that creates a completed, scored
// table for a round that already happened. Reuses the atomic record_past_round RPC
// via POST /api/admin/tables/record-round. No emails, no held seats. Host is the
// first player slot; the server derives the week from the date and re-validates the
// cohort. The synchronous useRef guard (flipped before the confirm await) means a
// doubled click can't create two tables.
export default function AdminRecordRoundButton({ onRecorded }: { onRecorded: () => void }) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);

  const [cities, setCities] = useState<City[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [cohort, setCohort] = useState<Candidate[]>([]);
  const [loadingCohort, setLoadingCohort] = useState(false);

  const [cityId, setCityId] = useState("");
  const [seriesId, setSeriesId] = useState("");
  const [tableDate, setTableDate] = useState("");
  const [tableTime, setTableTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [areaField, setAreaField] = useState("");
  const [roundType, setRoundType] = useState("casual");
  // Slot 0 is the host; slots 1–3 are the other players.
  const [slots, setSlots] = useState<Slot[]>([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submitInFlight = useRef(false);

  // Load the city + league lists once the modal opens.
  useEffect(() => {
    if (!open) return;
    let active = true;
    (async () => {
      try {
        const [cRes, sRes] = await Promise.all([
          fetch("/api/admin/cities", { credentials: "include" }),
          fetch("/api/admin/series", { credentials: "include" }),
        ]);
        const cJson = await cRes.json().catch(() => ({}));
        const sJson = await sRes.json().catch(() => ({}));
        if (!active) return;
        setCities(Array.isArray(cJson.cities) ? cJson.cities : []);
        setSeriesList(Array.isArray(sJson.series) ? sJson.series : []);
      } catch {
        if (active) setError("Couldn't load cities and leagues.");
      }
    })();
    return () => { active = false; };
  }, [open]);

  // Load the paid cohort whenever the city + league are both chosen. Changing
  // either clears the player slots (a player from the old cohort is invalid).
  useEffect(() => {
    if (!cityId || !seriesId) { setCohort([]); return; }
    let active = true;
    setLoadingCohort(true);
    setSlots([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
    (async () => {
      try {
        const res = await fetch(`/api/admin/cohort-players?city_id=${cityId}&series_id=${seriesId}`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (!active) return;
        setCohort(Array.isArray(json.players) ? json.players : []);
      } catch {
        if (active) setCohort([]);
      } finally {
        if (active) setLoadingCohort(false);
      }
    })();
    return () => { active = false; };
  }, [cityId, seriesId]);

  const selectedSeries = seriesList.find((s) => s.id === seriesId) ?? null;
  const todayStr = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date()), []);
  // The picker floor is the league start; the ceiling is whichever of today / league
  // end comes first (a future round is always an error here). The server re-checks.
  const dateMax = selectedSeries ? (selectedSeries.ends_at < todayStr ? selectedSeries.ends_at : todayStr) : todayStr;
  const dateMin = selectedSeries?.starts_at;

  const nameOf = (id: string) => cohort.find((c) => c.profile_id === id)?.full_name ?? "—";
  const anyNoShow = slots.some((s) => s.is_no_show);
  const allChosen = slots.every((s) => s.user_id) && new Set(slots.map((s) => s.user_id)).size === 4;
  const canSubmit = !!(cityId && seriesId && tableDate && tableTime && locationName.trim() && roundType && allChosen) && !busy;

  function setSlot(i: number, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function reset() {
    setCityId(""); setSeriesId(""); setTableDate(""); setTableTime("");
    setLocationName(""); setLocationAddress(""); setAreaField(""); setRoundType("casual");
    setSlots([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
    setError(null); setCohort([]);
  }

  async function submit() {
    if (submitInFlight.current) return;
    submitInFlight.current = true;
    try {
      if (!canSubmit) return;
      const players = slots.map((s) => nameOf(s.user_id)).join(", ");
      const ok = await confirm({
        title: "Record this past round?",
        message: `Record a completed round at ${locationName.trim()} on ${tableDate} with ${players}? This writes final scores for a game that already happened — no emails are sent. An admin can revert or correct it afterward.`,
        confirmLabel: "Record round",
        danger: true,
      });
      if (!ok) return;
      setBusy(true);
      setError(null);
      const res = await fetch("/api/admin/tables/record-round", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          city_id: cityId,
          series_id: seriesId,
          table_date: tableDate,
          table_time: tableTime,
          location_name: locationName.trim(),
          location_address: locationAddress.trim() || null,
          area: areaField.trim() || null,
          round_type: roundType,
          host_id: slots[0].user_id,
          players: slots.map((s) => ({ user_id: s.user_id, round_score: Number.parseInt(s.round_score || "0", 10) || 0, is_no_show: s.is_no_show })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.ok) {
        setError(payload.error || "That round could not be recorded.");
        return;
      }
      setOpen(false);
      reset();
      onRecorded();
    } finally {
      setBusy(false);
      submitInFlight.current = false;
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary" style={{ fontSize: 13, padding: "8px 14px", whiteSpace: "nowrap" }}>
        Record a past round
      </button>
    );
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ink-700)", display: "block", marginBottom: 4 };
  const fieldWrap: React.CSSProperties = { marginBottom: 12 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Record a past round"
      style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 16, overflowY: "auto", background: "var(--overlay-scrim, rgba(20,47,52,0.4))" }}
      onClick={(e) => { if (e.target === e.currentTarget && !busy) { setOpen(false); } }}
    >
      <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 420, margin: "24px 0" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--hair-200)" }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-900)", margin: 0 }}>Record a past round</p>
          <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>Creates a completed, scored table. No emails are sent.</p>
        </div>

        <div style={{ padding: 16 }}>
          <div style={fieldWrap}>
            <label style={labelStyle}>City</label>
            <select className="input-mo" style={{ width: "100%" }} value={cityId} onChange={(e) => setCityId(e.target.value)}>
              <option value="">Select a city</option>
              {cities.map((c) => <option key={c.id} value={c.id}>{c.name}{c.state ? `, ${c.state}` : ""}</option>)}
            </select>
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle}>League</label>
            <select className="input-mo" style={{ width: "100%" }} value={seriesId} onChange={(e) => setSeriesId(e.target.value)}>
              <option value="">Select a league</option>
              {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ ...fieldWrap, flex: 1 }}>
              <label style={labelStyle}>Date</label>
              <input className="input-mo" style={{ width: "100%" }} type="date" min={dateMin} max={dateMax} value={tableDate} onChange={(e) => setTableDate(e.target.value)} />
            </div>
            <div style={{ ...fieldWrap, flex: 1 }}>
              <label style={labelStyle}>Time</label>
              <input className="input-mo" style={{ width: "100%" }} type="time" value={tableTime} onChange={(e) => setTableTime(e.target.value)} />
            </div>
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>Venue</label>
            <input className="input-mo" style={{ width: "100%" }} value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="Where it was played" />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ ...fieldWrap, flex: 1 }}>
              <label style={labelStyle}>Address (optional)</label>
              <input className="input-mo" style={{ width: "100%" }} value={locationAddress} onChange={(e) => setLocationAddress(e.target.value)} />
            </div>
            <div style={{ ...fieldWrap, flex: 1 }}>
              <label style={labelStyle}>Area (optional)</label>
              <input className="input-mo" style={{ width: "100%" }} value={areaField} onChange={(e) => setAreaField(e.target.value)} />
            </div>
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle}>Round type</label>
            <select className="input-mo" style={{ width: "100%" }} value={roundType} onChange={(e) => setRoundType(e.target.value)}>
              {ROUND_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <div style={{ borderTop: "1px solid var(--hair-200)", margin: "6px 0 12px" }} />
          <p style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-700)", margin: "0 0 8px" }}>
            Players {anyNoShow ? "· no-show round (scores ignored)" : "· scores"}
          </p>
          {!cityId || !seriesId ? (
            <p style={{ fontSize: 13, color: "var(--ink-500)" }}>Choose a city and league first.</p>
          ) : loadingCohort ? (
            <p style={{ fontSize: 13, color: "var(--ink-500)" }}>Loading players…</p>
          ) : cohort.length < 4 ? (
            <p style={{ fontSize: 13, color: "var(--danger)" }}>This cohort has fewer than four paid players.</p>
          ) : (
            slots.map((slot, i) => {
              // Options: the whole cohort minus players picked in the OTHER slots.
              const takenElsewhere = new Set(slots.filter((_, idx) => idx !== i).map((s) => s.user_id).filter(Boolean));
              const options = cohort.filter((c) => !takenElsewhere.has(c.profile_id));
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <label style={labelStyle}>{i === 0 ? "Host" : `Player ${i + 1}`}</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <select className="input-mo" style={{ flex: 1, minWidth: 0 }} value={slot.user_id} onChange={(e) => setSlot(i, { user_id: e.target.value })}>
                      <option value="">Select a player</option>
                      {options.map((c) => <option key={c.profile_id} value={c.profile_id}>{c.full_name ?? "Player"}</option>)}
                    </select>
                    <input
                      className="input-mo"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={slot.round_score}
                      disabled={anyNoShow || slot.is_no_show}
                      onChange={(e) => setSlot(i, { round_score: e.target.value })}
                      aria-label={`Score for ${i === 0 ? "host" : `player ${i + 1}`}`}
                      style={{ width: 72, flexShrink: 0, opacity: anyNoShow ? 0.5 : 1 }}
                    />
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ink-600)", flexShrink: 0 }}>
                      <input type="checkbox" checked={slot.is_no_show} onChange={(e) => setSlot(i, { is_no_show: e.target.checked })} style={{ width: 15, height: 15, accentColor: "var(--pink-500)" }} />
                      No-show
                    </label>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {error ? <p style={{ padding: "0 16px 8px", fontSize: 13, color: "var(--danger)", margin: 0 }}>{error}</p> : null}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--hair-200)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={() => { setOpen(false); }} disabled={busy} style={{ fontSize: 13, padding: "8px 14px" }}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={!canSubmit} style={{ fontSize: 13, padding: "8px 14px" }}>
            {busy ? "Recording…" : "Record round"}
          </button>
        </div>
      </div>
    </div>
  );
}
