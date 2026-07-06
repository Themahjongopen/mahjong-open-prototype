"use client";

import { useState } from "react";
import Link from "next/link";

export default function CreateTablePage() {
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    week_number: "",
    table_date: "",
    table_time: "",
    location_name: "",
    location_address: "",
    skill_level: "",
    notes: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.week_number || !form.table_date || !form.table_time || !form.location_name || !form.skill_level) {
      setError("Please fill in all required fields.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setCreated(true);
      setLoading(false);
    }, 700);
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

  if (created) {
    return (
      <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--lime-50)", display: "flex", alignItems: "center", justifyContent: "center", margin: "48px auto 20px", fontSize: 24 }}>
          ✓
        </div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 8 }}>Table created!</p>
        <p style={{ fontSize: 14, color: "var(--ink-500)", marginBottom: 28 }}>
          Week {form.week_number} · {form.location_name}<br />
          You&rsquo;re in seat 1 as the creator.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <Link href="/portal/tables" className="btn btn-primary" style={{ display: "inline-flex" }}>
            Back to open tables
          </Link>
          <button onClick={() => { setCreated(false); setForm({ week_number: "", table_date: "", table_time: "", location_name: "", location_address: "", skill_level: "", notes: "" }); }} className="btn btn-ghost" style={{ fontSize: 13 }}>
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 20 }}>
        Create a table
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {field("Week number (1–8)", true,
          <select className="input-mo" value={form.week_number} onChange={(e) => setForm((f) => ({ ...f, week_number: e.target.value }))}>
            <option value="">Select week</option>
            {[1,2,3,4,5,6,7,8].map((w) => <option key={w} value={w}>Week {w}</option>)}
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
