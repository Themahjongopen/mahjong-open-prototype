"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";

interface City {
  id: string;
  name: string;
  state: string | null;
  slug: string;
  is_active: boolean;
}

export default function AdminCitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [form, setForm] = useState({ name: "", state: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", state: "" });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function loadCities() {
    const response = await fetch("/api/admin/cities", { method: "GET" });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error || "Cities could not be loaded.");
      return;
    }

    const payload = await response.json();
    setCities(payload.cities ?? []);
    setError(null);
  }

  useEffect(() => {
    void loadCities();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, state: form.state }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "City could not be created.");
      setLoading(false);
      return;
    }

    setForm({ name: "", state: "" });
    setFeedback("City added.");
    await loadCities();
    setLoading(false);
  }

  function startEdit(city: City) {
    setEditingId(city.id);
    setEditForm({ name: city.name, state: city.state ?? "" });
  }

  async function handleUpdate(cityId: string) {
    setLoading(true);
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/cities", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cityId, name: editForm.name, state: editForm.state }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "City could not be updated.");
      setLoading(false);
      return;
    }

    setEditingId(null);
    setFeedback("City updated.");
    await loadCities();
    setLoading(false);
  }

  async function toggleActive(city: City) {
    setLoading(true);
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/cities", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: city.id, action: "toggle" }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "City status could not be updated.");
      setLoading(false);
      return;
    }

    setFeedback(city.is_active ? "City deactivated." : "City activated.");
    await loadCities();
    setLoading(false);
  }

  async function handleDelete(cityId: string) {
    const city = cities.find((item) => item.id === cityId);
    const confirmed = await confirm({
      title: "Delete city?",
      message: city ? `Delete ${city.name}? This can't be undone.` : "Delete this city? This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    setLoading(true);
    setFeedback(null);
    setError(null);

    const response = await fetch("/api/admin/cities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cityId }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(payload.error || "City could not be deleted.");
      setLoading(false);
      return;
    }

    setFeedback("City deleted.");
    await loadCities();
    setLoading(false);
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 32 }}>Cities</h1>

      {feedback ? <div style={{ background: "#f2f7f1", border: "1px solid #dcebdc", padding: "12px 14px", borderRadius: 10, marginBottom: 20, color: "var(--ink-800)" }}>{feedback}</div> : null}
      {error ? <div style={{ background: "#fff5f7", border: "1px solid #f4cbd6", padding: "12px 14px", borderRadius: 10, marginBottom: 20, color: "var(--pink-700)" }}>{error}</div> : null}

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 32, boxShadow: "var(--shadow-sm)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 18, color: "var(--ink-900)", marginBottom: 20 }}>Add city</h2>
        <form onSubmit={handleCreate} className="admin-cities-form">
          <input className="input-mo" placeholder="City name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <input className="input-mo" placeholder="State (e.g. MS)" value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} required />
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ whiteSpace: "nowrap" }}>{loading ? "Adding…" : "Add city"}</button>
        </form>
      </div>

      <div className="admin-cities-list" style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
        {cities.map((city, i) => (
          <div key={city.id} className="admin-cities-row" style={{ borderBottom: i < cities.length - 1 ? "1px solid var(--hair-200)" : "none" }}>
            <div className="admin-cities-meta">
              <div>
                <span className="admin-mobile-label">City</span>
                <p style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-900)", margin: 0 }}>{city.name}{city.state ? `, ${city.state}` : ""}</p>
                <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "4px 0 0" }}>/{city.slug}</p>
              </div>
              <div className="admin-cities-actions">
                <span className={`badge ${city.is_active ? "badge-lime" : "badge-mute"}`}>{city.is_active ? "Active" : "Inactive"}</span>
                <button onClick={() => toggleActive(city)} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} disabled={loading}>
                  {city.is_active ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => startEdit(city)} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} disabled={loading}>
                  Edit
                </button>
                <button onClick={() => handleDelete(city.id)} className="btn btn-ghost" style={{ fontSize: 12, padding: "5px 12px" }} disabled={loading}>
                  Delete
                </button>
              </div>
            </div>
            {editingId === city.id ? (
              <div className="admin-cities-edit">
                <input className="input-mo" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={{ minWidth: 180, flex: 2 }} />
                <input className="input-mo" value={editForm.state} onChange={(e) => setEditForm((f) => ({ ...f, state: e.target.value }))} style={{ minWidth: 120, flex: 1 }} />
                <button className="btn btn-primary" onClick={() => void handleUpdate(city.id)} disabled={loading}>Save</button>
                <button className="btn btn-ghost" onClick={() => setEditingId(null)} disabled={loading}>Cancel</button>
              </div>
            ) : null}
          </div>
        ))}
        {cities.length === 0 && <p style={{ padding: 20, color: "var(--ink-500)", fontSize: 14 }}>No cities yet.</p>}
      </div>
    </div>
  );
}
