"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";
import { enumerateSeriesWeeks } from "@/lib/portal/seriesWeek";
import { useConfirm } from "@/components/ConfirmProvider";
import AreaCombobox from "@/components/portal/AreaCombobox";

const ROUND_TYPE_INFO: { name: string; desc: string }[] = [
  { name: "Casual", desc: "Light conversation, casual play" },
  { name: "Mindful", desc: "Minimal talking, game focused" },
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

export default function CreateTableForm({ cityId, cityName, seriesStartDate, seriesEndDate, isAdmin = false }: { cityId: string | null; cityName: string | null; seriesStartDate: string | null; seriesEndDate: string | null; isAdmin?: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    week_number: "",
    table_date: "",
    table_time: "",
    location_name: "",
    location_address: "",
    area: "",
    round_type: "",
    notes: "",
  });

  const seriesWeeks = useMemo(() => enumerateSeriesWeeks(seriesStartDate, seriesEndDate), [seriesStartDate, seriesEndDate]);
  const hasDynamicDates = seriesWeeks.length > 0;

  // Today-forward floor, applied on top of the pure per-week enumeration.
  // Weeks left with zero visible dates (fully in the past) are dropped
  // entirely rather than rendered as an empty optgroup. The label still shows
  // each week's full canonical range (dates[0]/dates[dates.length - 1] from the
  // unfiltered week), so a host mid-week still sees which week they're in
  // even if only its tail end remains selectable.
  const visibleWeeks = useMemo(() => {
    const today = localTodayString();
    return seriesWeeks
      .map((r) => ({ week: r.week, rangeStart: r.dates[0], rangeEnd: r.dates[r.dates.length - 1], dates: r.dates.filter((d) => d >= today) }))
      .filter((r) => r.dates.length > 0);
  }, [seriesWeeks]);

  // The week the selected date falls in — the value the server will store for a
  // non-admin regardless of what's posted. Non-admins see it read-only; admins may
  // override (with a confirm) for a deliberate exception like a make-up round.
  const derivedWeek = useMemo(
    () => (form.table_date ? visibleWeeks.find((r) => r.dates.includes(form.table_date))?.week ?? null : null),
    [visibleWeeks, form.table_date],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.week_number || !form.table_date || !form.table_time || !form.location_name || !form.round_type || !form.area.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    // An admin deliberately setting a week that disagrees with the date confirms
    // it first — this is the only way to intentionally label a table off its date,
    // and it must never happen silently (that was the bug).
    if (isAdmin && derivedWeek !== null && Number(form.week_number) !== derivedWeek) {
      const ok = await confirm({
        title: "Week doesn't match the date",
        message: `This date falls in Week ${derivedWeek}, but you set Week ${form.week_number}. Create it with Week ${form.week_number} anyway?`,
        confirmLabel: `Use Week ${form.week_number}`,
        danger: true,
      });
      if (!ok) return;
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
                const week = visibleWeeks.find((r) => r.dates.includes(e.target.value))?.week;
                setForm((f) => ({ ...f, table_date: e.target.value, week_number: week ? String(week) : "" }));
              }}
            >
              <option value="">Select a date</option>
              {visibleWeeks.map((r) => (
                <optgroup key={r.week} label={`Week ${r.week} (${formatDateOption(r.rangeStart)} – ${formatDateOption(r.rangeEnd)})`}>
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
        {field("Week (1–8)", true,
          // Non-admin hosts see the derived week READ-ONLY — the week is fixed by
          // the date, and the server ignores any posted value for them, so an
          // editable control would only invite the mislabel this whole change
          // fixes. Admins keep the dropdown (and the native-date fallback, which
          // can't auto-fill, needs manual entry) — a mismatch is confirmed on
          // submit.
          isAdmin || !hasDynamicDates ? (
            <>
              <select className="input-mo" value={form.week_number} onChange={(e) => setForm((f) => ({ ...f, week_number: e.target.value }))}>
                <option value="">Select week</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((w) => <option key={w} value={w}>Week {w}</option>)}
              </select>
              <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>
                {isAdmin ? "Auto-filled from the date. As an admin you can override it — you’ll be asked to confirm." : "Auto-filled from the date above — change it if this isn’t right."}
              </p>
            </>
          ) : (
            <>
              <div className="input-mo" style={{ display: "flex", alignItems: "center", background: "var(--paper-50)", color: form.week_number ? "var(--ink-800)" : "var(--ink-400)" }}>
                {form.week_number ? `Week ${form.week_number}` : "Choose a date above first"}
              </div>
              <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>Set automatically from the date you pick above.</p>
            </>
          )
        )}
        {field("Time", true,
          <input className="input-mo" type="time" value={form.table_time} onChange={(e) => setForm((f) => ({ ...f, table_time: e.target.value }))} />
        )}
        {field("Location name", true,
          <>
            <input className="input-mo" type="text" placeholder="e.g. Jane's place, Rosewood Café" value={form.location_name} onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))} />
            <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>
              Include your city or town (e.g. &ldquo;Jane&rsquo;s place, Auburn&rdquo;) so players in your area can tell how far it is.
            </p>
          </>
        )}
        {field("Address or directions", false,
          <input className="input-mo" type="text" placeholder="Optional" value={form.location_address} onChange={(e) => setForm((f) => ({ ...f, location_address: e.target.value }))} />
        )}
        {/* Part of town — REQUIRED (Step 2). A combobox, not a native <select>: it
            must both reuse existing areas and accept new ones. */}
        {field("Part of town", true,
          <>
            <AreaCombobox cityId={cityId} value={form.area} onChange={(v) => setForm((f) => ({ ...f, area: v }))} placeholderFallback="e.g. North, Midtown, East" />
            <p style={{ fontSize: 12, color: "var(--ink-500)", margin: "2px 0 0" }}>
              What part of town? Players use this to find tables near them.
            </p>
          </>
        )}
        {field("Round type", true,
          <select className="input-mo" value={form.round_type} onChange={(e) => setForm((f) => ({ ...f, round_type: e.target.value }))}>
            <option value="">Select type</option>
            <option value="casual">Casual</option>
            <option value="mindful">Mindful</option>
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
