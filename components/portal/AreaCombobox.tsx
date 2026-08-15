"use client";

import { useEffect, useRef, useState } from "react";

// A text input with a suggestion list beneath it, populated from
// /api/tables/areas for the given city. Used by BOTH the create and edit forms.
//
// Bias toward reuse: existing areas appear as tappable options the moment the
// field is focused, before any typing; typing filters them case-insensitively.
// Typing a brand-new area is allowed — it's the fallback, not the default path.
//
// Resilience: the suggestions fetch is best-effort. If it errors or times out,
// `areas` stays empty and this is just a plain text input that still accepts
// typed values and still submits. The field NEVER blocks on the network.
//
// Layout: the dropdown is absolutely positioned (overlay, not in flow), so it
// can never push the form's submit button out of reach on a short viewport.
export default function AreaCombobox({
  value,
  onChange,
  cityId,
  placeholderFallback = "e.g. Downtown, East side",
  inputId,
}: {
  value: string;
  onChange: (v: string) => void;
  cityId: string | null;
  placeholderFallback?: string;
  inputId?: string;
}) {
  const [areas, setAreas] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const attempted = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Lazily fetch suggestions on first focus (cheap, safe to call on focus).
  // Best-effort: any failure leaves `areas` empty and the plain input works.
  async function ensureLoaded() {
    if (attempted.current || !cityId) return;
    attempted.current = true;
    try {
      const res = await fetch(`/api/tables/areas?city_id=${encodeURIComponent(cityId)}`);
      const payload = await res.json().catch(() => ({}));
      if (Array.isArray(payload?.areas)) setAreas(payload.areas.filter((a: unknown): a is string => typeof a === "string"));
    } catch {
      // swallow — the field degrades to a plain text input
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const q = value.trim().toLowerCase();
  // Empty input on focus → show all; typing → case-insensitive substring match.
  // Hide an exact match (nothing left to pick).
  const suggestions = areas.filter((a) => {
    const la = a.toLowerCase();
    if (q && la === q) return false;
    return q === "" || la.includes(q);
  });

  // Placeholder shows a real example from this city when we have one.
  const placeholder = areas.length > 0 ? `e.g. ${areas[0]}` : placeholderFallback;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        id={inputId}
        className="input-mo"
        type="text"
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          void ensureLoaded();
          setOpen(true);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
      />
      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 40,
            margin: 0,
            padding: 4,
            listStyle: "none",
            background: "#fff",
            border: "1px solid var(--hair-300)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-lg)",
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          {suggestions.map((a) => (
            <li key={a}>
              <button
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onChange(a);
                  setOpen(false);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--lime-50)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 10px",
                  fontSize: 14,
                  color: "var(--ink-800)",
                  background: "none",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                }}
              >
                {a}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
