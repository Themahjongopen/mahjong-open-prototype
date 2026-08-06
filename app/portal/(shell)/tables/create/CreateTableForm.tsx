"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { enumerateSeriesRounds } from "@/lib/portal/seriesWeek";

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

// "Mon, Aug 17" — UTC-safe (avoids the local-timezone off-by-one every other
// date formatter in this file already guards against).
function formatDateOption(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

// Today as "YYYY-MM-DD" in the viewer's local time zone — used only to floor
// the dropdown's options at today-forward. Deliberately local (not UTC): this
// should match how the host sitting in front of the screen perceives "today."
function localTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CreateTableForm({ cityName, seriesStartDate, seriesEndDate }: { cityName: string | null; seriesStartDate: string | null; seriesEndDate: string | null }) {
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

  const seriesRounds = useMemo(() => enumerateSeriesRounds(seriesStartDate, seriesEndDate), [seriesStartDate, seriesEndDate]);
  const hasDynamicDates = seriesRounds.length > 0;

  // Today-forward floor, applied on top of the pure per-round enumeration.
  // Rounds left with zero visible dates (fully in the past) are dropped
  // entirely rather than rendered as an empty optgroup. The label still shows
  // each round's full canonical range (dates[0]/dates[dates.length - 1] from the
  // unfiltered round), so a host mid-round still sees which round they're in
  // even if only its tail end remains selectable.
  const visibleRounds = useMemo(() => {
    const today = localTodayString();
    return seriesRounds
      .map((r) => ({ round: r.round, rangeStart: r.dates[0], rangeEnd: r.dates[r.dates.length - 1], dates: r.dates.filter((d) => d >= today) }))
      .filter((r) => r.dates.length > 0);
  }, [seriesRounds]);

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
          // A <select>, not a native date picker — deliberately. Every browser
          // renders type="date" pickers differently, and some (confirmed on a
          // real phone) render a fully custom calendar widget that ignores
          // min/max entirely, leaving out-of-window dates selectable. A
          // <select> still uses the browser's own dropdown/wheel UI, but the
          // option list is ours — nothing invalid to ever pick, on any device.
          // Falls back to the original native input (same min/max as before)
          // if the series' dates aren't available, so table creation is never
          // fully blocked by a misconfigured series row.
          hasDynamicDates ? (
            <select
              className="input-mo"
              value={form.table_date}
              onChange={(e) => {
                const round = visibleRounds.find((r) => r.dates.includes(e.target.value))?.round;
                setForm((f) => ({ ...f, table_date: e.target.value, week_number: round ? String(round) : "" }));
              }}
            >
              <option value="">Select a date</option>
              {visibleRounds.map((r) => (
                <optgroup key={r.round} label={`Round ${r.round} (${formatDateOption(r.rangeStart)} – ${formatDateOption(r.rangeEnd)})`}>
                  {r.dates.map((d) => (
                    <option key={d} value={d}>{formatDateOption(d)}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          ) : (
            <input className="input-mo" type="date" min={seriesStartDate ?? undefined} max={seriesEndDate ?? undefined} value={form.table_date} onChange={(e) => setForm((f) => ({ ...f, table_date: e.target.value }))} />
          )
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
