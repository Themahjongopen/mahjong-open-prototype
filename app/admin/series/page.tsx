"use client";

import { useEffect, useState } from "react";

interface Series {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  registration_closes_at: string | null;
  total_weeks: number;
  price_cents: number;
  is_active: boolean;
}

const emptyForm = {
  name: "",
  starts_at: "",
  ends_at: "",
  registration_closes_at: "",
  total_weeks: "8",
  price: "80.00",
};

type SeriesForm = typeof emptyForm;

function toFormValues(series: Series): SeriesForm {
  return {
    name: series.name,
    starts_at: series.starts_at,
    ends_at: series.ends_at,
    registration_closes_at: series.registration_closes_at ?? "",
    total_weeks: String(series.total_weeks),
    price: (series.price_cents / 100).toFixed(2),
  };
}

// { name, starts_at, ends_at, registration_closes_at, total_weeks, price_cents }
function toPayload(form: SeriesForm) {
  return {
    name: form.name,
    starts_at: form.starts_at,
    ends_at: form.ends_at,
    registration_closes_at: form.registration_closes_at || null,
    total_weeks: form.total_weeks,
    price_cents: Math.round(Number(form.price) * 100),
  };
}

function formatDate(value: string | null) {
  if (!value) return null;
  // Series dates are plain YYYY-MM-DD; anchor to midday UTC to avoid the date
  // shifting a day in negative-offset timezones.
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function priceLabel(cents: number) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, "")}`;
}

export default function AdminSeriesPage() {
  const [series, setSeries] = useState<Series[]>([]);
  const [form, setForm] = useState<SeriesForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SeriesForm>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSeries() {
    const response = await fetch("/api/admin/series", { method: "GET" });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Series could not be loaded.");
      return;
    }

    const payload = await response.json();
    setSeries(payload.series ?? []);
    setError(null);
  }

  useEffect(() => {
    void loadSeries();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/series", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(form)),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "Series could not be created.");
      setLoading(false);
      return;
    }

    setForm(emptyForm);
    setFeedback("Series added.");
    await loadSeries();
    setLoading(false);
  }

  function startEdit(item: Series) {
    setEditingId(item.id);
    setEditForm(toFormValues(item));
  }

  async function handleUpdate(seriesId: string) {
    setLoading(true);
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/series", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: seriesId, ...toPayload(editForm) }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "Series could not be updated.");
      setLoading(false);
      return;
    }

    setEditingId(null);
    setFeedback("Series updated.");
    await loadSeries();
    setLoading(false);
  }

  async function toggleActive(item: Series) {
    setLoading(true);
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/series", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action: "toggle" }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "Series status could not be updated.");
      setLoading(false);
      return;
    }

    setFeedback(item.is_active ? "Series deactivated." : "Series activated.");
    await loadSeries();
    setLoading(false);
  }

  async function handleDelete(seriesId: string) {
    const item = series.find((s) => s.id === seriesId);
    const confirmed = window.confirm(item ? `Delete ${item.name}? This can't be undone.` : "Delete this series?");

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/series", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: seriesId }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "Series could not be deleted.");
      setLoading(false);
      return;
    }

    setFeedback("Series deleted.");
    await loadSeries();
    setLoading(false);
  }

  const fieldLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ink-800)" };
  const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  };

  function renderFields(values: SeriesForm, onChange: (patch: Partial<SeriesForm>) => void) {
    return (
      <>
        <div style={fieldWrap}>
          <label style={fieldLabel}>Series name</label>
          <input
            className="input-mo"
            placeholder="The Mahjong Open — 2026 — Series One"
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
        </div>
        <div style={gridStyle}>
          <div style={fieldWrap}>
            <label style={fieldLabel}>Starts (Week 1)</label>
            <input className="input-mo" type="date" value={values.starts_at} onChange={(e) => onChange({ starts_at: e.target.value })} required />
          </div>
          <div style={fieldWrap}>
            <label style={fieldLabel}>Ends (Week 8)</label>
            <input className="input-mo" type="date" value={values.ends_at} onChange={(e) => onChange({ ends_at: e.target.value })} required />
          </div>
          <div style={fieldWrap}>
            <label style={fieldLabel}>Registration closes</label>
            <input
              className="input-mo"
              type="date"
              value={values.registration_closes_at}
              onChange={(e) => onChange({ registration_closes_at: e.target.value })}
            />
          </div>
        </div>
        <div style={gridStyle}>
          <div style={fieldWrap}>
            <label style={fieldLabel}>Total weeks</label>
            <input className="input-mo" type="number" min={1} value={values.total_weeks} onChange={(e) => onChange({ total_weeks: e.target.value })} required />
          </div>
          <div style={fieldWrap}>
            <label style={fieldLabel}>Price (USD)</label>
            <input className="input-mo" type="number" min={0} step="0.01" value={values.price} onChange={(e) => onChange({ price: e.target.value })} required />
          </div>
        </div>
      </>
    );
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 32 }}>Series</h1>

      {feedback ? <div style={{ background: "#f2f7f1", border: "1px solid #dcebdc", padding: "12px 14px", borderRadius: 10, marginBottom: 20, color: "var(--ink-800)" }}>{feedback}</div> : null}
      {error ? <div style={{ background: "#fff5f7", border: "1px solid #f4cbd6", padding: "12px 14px", borderRadius: 10, marginBottom: 20, color: "var(--pink-700)" }}>{error}</div> : null}

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 32, boxShadow: "var(--shadow-sm)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", marginBottom: 20 }}>Create series</h2>
        <form onSubmit={handleCreate} className="admin-season-form" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {renderFields(form, (patch) => setForm((f) => ({ ...f, ...patch })))}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? "Creating…" : "Create series"}
          </button>
        </form>
      </div>

      <div className="admin-cities-list" style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        {series.map((item, i) => (
          <div key={item.id} className="admin-cities-row" style={{ borderBottom: i < series.length - 1 ? "1px solid var(--hair-200)" : "none" }}>
            <div className="admin-cities-meta">
              <div>
                <span className="admin-mobile-label">Series</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", margin: 0 }}>{item.name}</p>
                <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "4px 0 0" }}>
                  {formatDate(item.starts_at)} – {formatDate(item.ends_at)} · {item.total_weeks} weeks · {priceLabel(item.price_cents)}
                  {item.registration_closes_at ? ` · reg. closes ${formatDate(item.registration_closes_at)}` : ""}
                </p>
              </div>
              <div className="admin-cities-actions">
                <span className={`badge ${item.is_active ? "badge-lime" : "badge-mute"}`}>{item.is_active ? "Active" : "Inactive"}</span>
                <button onClick={() => toggleActive(item)} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} disabled={loading}>
                  {item.is_active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => startEdit(item)} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} disabled={loading}>
                  Edit
                </button>
                <button onClick={() => handleDelete(item.id)} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} disabled={loading}>
                  Delete
                </button>
              </div>
            </div>
            {editingId === item.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14 }}>
                {renderFields(editForm, (patch) => setEditForm((f) => ({ ...f, ...patch })))}
                <div className="admin-cities-edit" style={{ marginTop: 0 }}>
                  <button className="btn btn-primary" onClick={() => void handleUpdate(item.id)} disabled={loading}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setEditingId(null)} disabled={loading}>Cancel</button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
        {series.length === 0 && <p style={{ padding: 20, color: "var(--ink-500)", fontSize: 14 }}>No series yet.</p>}
      </div>
    </div>
  );
}
