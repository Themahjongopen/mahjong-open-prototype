"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateTablePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    week_number: "",
    table_date: "",
    table_time: "",
    location_name: "",
    location_address: "",
    skill_level: "",
    round_type: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.week_number || !form.table_date || !form.table_time || !form.location_name || !form.skill_level || !form.round_type) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok || !payload.id) {
      setError(payload.error || "Your table could not be created.");
      setLoading(false);
      return;
    }

    router.push(`/portal/tables/${payload.id}`);
  }

  function field(label: string, required: boolean, children: React.ReactNode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
          {label} {required && <span style={{ color: "var(--pink-500)" }}>*</span>}
        </label>
        {children}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 20 }}>
        Create a table
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {field("Round (week 1–8)", true,
          <select className="input-mo" value={form.week_number} onChange={(e) => setForm((f) => ({ ...f, week_number: e.target.value }))}>
            <option value="">Select round</option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w}>Round {w}</option>)}
          </select>
        )}
        {field("Date", true,
          <input className="input-mo" type="date" value={form.table_date} onChange={(e) => setForm((f) => ({ ...f, table_date: e.target.value }))} />
        )}
        {field("Time", true,
          <input className="input-mo" type="time" value={form.table_time} onChange={(e) => setForm((f) => ({ ...f, table_time: e.target.value }))} />
        )}
        {field("Location name", true,
          <input className="input-mo" type="text" placeholder="e.g. Jane's place, Rosewood Café" value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} />
        )}
        {field("Address or directions", false,
          <input className="input-mo" type="text" placeholder="Optional" value={form.location_address} onChange={(e) => setForm((f) => ({ ...f, location_address: e.target.value }))} />
        )}
        {field("Skill level", true,
          <select className="input-mo" value={form.skill_level} onChange={(e) => setForm((f) => ({ ...f, skill_level: e.target.value }))}>
            <option value="">Select level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        )}
        {field("Round type", true,
          <select className="input-mo" value={form.round_type} onChange={(e) => setForm((f) => ({ ...f, round_type: e.target.value }))}>
            <option value="">Select type</option>
            <option value="social">Social</option>
            <option value="focused">Focused</option>
            <option value="lightning">Lightning</option>
          </select>
        )}
        {field("Notes", false,
          <textarea className="input-mo" rows={3} placeholder="Anything players should know" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ resize: "vertical" }} />
        )}

        <div style={{ background: "var(--lime-50)", border: "1px solid var(--lime-100)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 13, color: "var(--lime-700)" }}>
          You&rsquo;ll automatically fill seat 1 as the table creator.
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--danger)" }}>{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: "center", padding: "14px", marginTop: 4 }}>
          {loading ? "Creating…" : "Create table"}
        </button>
      </form>
    </div>
  );
}
