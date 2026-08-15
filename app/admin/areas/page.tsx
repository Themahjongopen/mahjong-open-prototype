"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";

interface City {
  id: string;
  name: string;
  state: string | null;
  is_active: boolean;
}
interface AreaRow {
  area: string;
  count: number;
}

// Per-city area cleanup: free text produces genuinely distinct entries that a
// commissioner later decides should be one ("North Shelby" + "Germantown" → one
// name). Select 1+ areas, type a target, merge. A single selection is a rename.
export default function AdminAreasPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [cityId, setCityId] = useState<string>("");
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function loadCities() {
    const res = await fetch("/api/admin/cities");
    if (!res.ok) {
      setError("Cities could not be loaded.");
      return;
    }
    const payload = await res.json();
    setCities(payload.cities ?? []);
  }

  async function loadAreas(id: string) {
    setSelected(new Set());
    setTarget("");
    if (!id) {
      setAreas([]);
      return;
    }
    const res = await fetch(`/api/admin/areas?city_id=${encodeURIComponent(id)}`);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error || "Areas could not be loaded.");
      setAreas([]);
      return;
    }
    const payload = await res.json();
    setAreas(payload.areas ?? []);
    setError(null);
  }

  useEffect(() => {
    void loadCities();
  }, []);

  function toggle(area: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(area) ? next.delete(area) : next.add(area);
      // Convenience: default the target to the first still-selected area.
      const first = [...next][0];
      setTarget((t) => (t && prev.has(t) === false ? t : first ?? ""));
      return next;
    });
  }

  async function handleMerge() {
    const from = [...selected];
    if (from.length === 0 || !target.trim()) return;

    const verb = from.length === 1 && from[0] === target.trim() ? "rename" : from.length === 1 ? "rename" : "merge";
    const confirmed = await confirm({
      title: verb === "rename" ? "Rename area?" : "Merge areas?",
      message:
        verb === "rename"
          ? `Rename "${from[0]}" to "${target.trim()}" for every table in this city?`
          : `Merge ${from.map((f) => `"${f}"`).join(", ")} into "${target.trim()}"? This updates every affected table.`,
      confirmLabel: verb === "rename" ? "Rename" : "Merge",
    });
    if (!confirmed) return;

    setLoading(true);
    setFeedback(null);
    setError(null);
    const res = await fetch("/api/admin/areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city_id: cityId, from, to: target.trim() }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "The merge could not be completed.");
      setLoading(false);
      return;
    }
    setFeedback(`Updated ${payload.updated} table${payload.updated === 1 ? "" : "s"} → "${payload.to}".`);
    await loadAreas(cityId);
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 8 }}>Areas</h1>
      <p style={{ fontSize: 14, color: "var(--ink-500)", marginBottom: 28 }}>
        Merge or rename the free-text areas players type when creating tables. Select one or more areas and give them a single name.
      </p>

      {feedback ? <div style={{ background: "#f2f7f1", border: "1px solid #dcebdc", padding: "12px 14px", borderRadius: 10, marginBottom: 20, color: "var(--ink-800)" }}>{feedback}</div> : null}
      {error ? <div style={{ background: "#fff5f7", border: "1px solid #f4cbd6", padding: "12px 14px", borderRadius: 10, marginBottom: 20, color: "var(--pink-700)" }}>{error}</div> : null}

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink-800)", marginBottom: 6 }}>City</label>
        <select className="input-mo" value={cityId} onChange={(e) => { setCityId(e.target.value); void loadAreas(e.target.value); }} style={{ maxWidth: 360 }}>
          <option value="">Select a city…</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.state ? `, ${c.state}` : ""}{c.is_active ? "" : " (inactive)"}</option>
          ))}
        </select>
      </div>

      {cityId && (
        <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
          {areas.length === 0 ? (
            <p style={{ color: "var(--ink-500)", fontSize: 14, margin: 0 }}>No areas in use for this city yet.</p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 20 }}>
                {areas.map((a) => (
                  <label key={a.area} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", borderRadius: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={selected.has(a.area)} onChange={() => toggle(a.area)} />
                    <span style={{ fontSize: 15, color: "var(--ink-900)", flex: 1 }}>{a.area}</span>
                    <span className="badge badge-mute">{a.count} table{a.count === 1 ? "" : "s"}</span>
                  </label>
                ))}
              </div>

              <div style={{ borderTop: "1px solid var(--hair-200)", paddingTop: 16, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, color: "var(--ink-700)" }}>
                  {selected.size === 0 ? "Select area(s), then set a name:" : selected.size === 1 ? "Rename to:" : `Merge ${selected.size} into:`}
                </span>
                <input className="input-mo" placeholder="Target name" value={target} onChange={(e) => setTarget(e.target.value)} style={{ flex: 1, minWidth: 180 }} />
                <button className="btn btn-primary" onClick={() => void handleMerge()} disabled={loading || selected.size === 0 || !target.trim()}>
                  {loading ? "Saving…" : selected.size <= 1 ? "Rename" : "Merge"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
