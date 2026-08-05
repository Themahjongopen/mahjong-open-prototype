"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

const ROUND_TYPE_INFO: { name: string; desc: string }[] = [
  { name: "Social", desc: "Light conversation, casual play" },
  { name: "Focused", desc: "Minimal talking, game focused" },
  { name: "Lightning", desc: "15-minute rounds; a quick way to get in a game when you’re short on time" },
];

// Hover (desktop) or tap (mobile) info popover describing the round types.
function RoundTypeInfo() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="What do the round types mean?"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink-500)", display: "inline-flex", alignItems: "center" }}
      >
        <Info size={14} />
      </button>
      {open && (
        <div
          role="tooltip"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 30,
            width: 264,
            maxWidth: "80vw",
            background: "#fff",
            border: "1px solid var(--hair-200)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            padding: "12px 14px",
          }}
        >
          {ROUND_TYPE_INFO.map((t, i) => (
            <p key={t.name} style={{ margin: i < ROUND_TYPE_INFO.length - 1 ? "0 0 8px" : 0, fontSize: 13, lineHeight: 1.5, color: "var(--ink-700)" }}>
              <strong style={{ color: "var(--ink-900)" }}>{t.name}</strong> — {t.desc}
            </p>
          ))}
        </div>
      )}
    </span>
  );
}

// The series' round/week for a calendar date, or "" if the date is outside the
// 8-week window (before the start, or >8 weeks after). UTC-midnight day-math so
// there's no timezone/DST off-by-one — same approach as lib/format/zonedTime.ts.
function weekNumberForDate(seriesStartDate: string | null, dateStr: string): string {
  if (!seriesStartDate || !dateStr) return "";
  const [sy, sm, sd] = seriesStartDate.split("-").map(Number);
  const [dy, dm, dd] = dateStr.split("-").map(Number);
  if ([sy, sm, sd, dy, dm, dd].some(Number.isNaN)) return "";
  const days = Math.floor((Date.UTC(dy, dm - 1, dd) - Date.UTC(sy, sm - 1, sd)) / 86400000);
  const week = Math.floor(days / 7) + 1;
  return week >= 1 && week <= 8 ? String(week) : "";
}

export default function CreateTableForm({ cityName, seriesStartDate }: { cityName: string | null; seriesStartDate: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    week_number: "",
    table_date: "",
    table_time: "",
    location_name: "",
    location_address: "",
    round_type: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.week_number || !form.table_date || !form.table_time || !form.location_name || !form.round_type) {
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

  function field(label: string, required: boolean, children: React.ReactNode, info?: React.ReactNode) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
            {label} {required && <span style={{ color: "var(--pink-500)" }}>*</span>}
          </label>
          {info}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      {cityName ? <p className="eyebrow" style={{ marginBottom: 4 }}>{cityName}</p> : null}
      <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 20 }}>
        Create a table
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {field("Date", true,
          // Auto-fills the round below from the series start date. Fires on every
          // date change; the host can still override the round afterward.
          <input className="input-mo" type="date" value={form.table_date} onChange={(e) => setForm((f) => ({ ...f, table_date: e.target.value, week_number: weekNumberForDate(seriesStartDate, e.target.value) }))} />
        )}
        {field("Round (week 1–8)", true,
          <>
            <select className="input-mo" value={form.week_number} onChange={(e) => setForm((f) => ({ ...f, week_number: e.target.value }))}>
              <option value="">Select round</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w}>Round {w}</option>)}
            </select>
            <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>Auto-filled from the date above — change it if this isn&rsquo;t right.</p>
          </>
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
        {field("Round type", true,
          <select className="input-mo" value={form.round_type} onChange={(e) => setForm((f) => ({ ...f, round_type: e.target.value }))}>
            <option value="">Select type</option>
            <option value="social">Social</option>
            <option value="focused">Focused</option>
            <option value="lightning">Lightning</option>
          </select>,
          <RoundTypeInfo />
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
