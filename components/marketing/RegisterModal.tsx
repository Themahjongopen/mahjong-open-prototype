"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface RegisterModalProps {
  open: boolean;
  onClose: () => void;
}

type Step = "form" | "success";

type CityOption = {
  id: string;
  name: string;
  state: string | null;
};

type SeriesOption = {
  id: string;
  name: string;
  registration_closes_at: string | null;
};

export default function RegisterModal({ open, onClose }: RegisterModalProps) {
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cities, setCities] = useState<CityOption[]>([]);
  const [currentSeries, setCurrentSeries] = useState<SeriesOption | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city_id: "",
    series_id: "",
    skill_level: "" as "beginner" | "intermediate" | "advanced" | "",
  });
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    const supabase: any = createClient();

    async function loadCatalog() {
      const [{ data: cityData, error: cityError }, { data: seriesData, error: seriesError }] = await Promise.all([
        supabase.from("cities").select("id, name, state").eq("is_active", true).order("name", { ascending: true }),
        supabase.from("series").select("id, name, registration_closes_at").eq("is_active", true).order("starts_at", { ascending: true }),
      ]);

      if (!active) return;

      if (cityError) {
        console.error("Failed to load cities", cityError);
      }

      if (seriesError) {
        console.error("Failed to load active series", seriesError);
      }

      const nextCities = cityData ?? [];
      const nextSeries = seriesData?.[0] ?? null;

      setCities(nextCities as CityOption[]);
      setCurrentSeries(nextSeries as SeriesOption | null);
      setForm((current) => ({
        ...current,
        city_id: current.city_id || "",
        series_id: current.series_id || nextSeries?.id || "",
      }));
    }

    loadCatalog();

    return () => {
      active = false;
    };
  }, [open]);

  function reset() {
    setStep("form");
    setForm({ full_name: "", email: "", phone: "", city_id: "", series_id: currentSeries?.id ?? "", skill_level: "" });
    setError("");
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const selectedSeriesId = form.series_id || currentSeries?.id || "";

    if (!form.full_name.trim() || !form.email.trim() || !form.phone.trim() || !form.city_id || !selectedSeriesId || !form.skill_level) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          city_id: form.city_id,
          series_id: selectedSeriesId,
          skill_level: form.skill_level,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Registration failed. Please try again.");
      }

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Payment checkout was not returned.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Registration stays open through the close date (inclusive). The catalog
  // query only returns active series, so this handles the "series still active
  // but past its deadline" case; the register API enforces the same rule.
  const today = new Date().toISOString().slice(0, 10);
  const seriesClosed = Boolean(
    currentSeries?.registration_closes_at && currentSeries.registration_closes_at < today
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        backgroundColor: "var(--overlay-scrim)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Register for The Mahjong Open"
        style={{
          background: "#fff",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-lg)",
          width: "100%",
          maxWidth: 480,
          padding: "40px 36px",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--ink-500)",
            padding: 4,
            borderRadius: "var(--radius-sm)",
          }}
        >
          <X size={18} />
        </button>

        {step === "success" ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "var(--lime-50)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 20px",
              }}
            >
              <Check size={24} color="var(--lime-600)" />
            </div>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--ink-900)",
                marginBottom: 12,
              }}
            >
              You&rsquo;re on the list!
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 28 }}>
              You&rsquo;re registered — watch for details.
            </p>
            <button className="btn btn-primary" onClick={handleClose} style={{ justifyContent: "center" }}>
              Done
            </button>
          </div>
        ) : seriesClosed ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p className="eyebrow" style={{ marginBottom: 8 }}>{currentSeries?.name}</p>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                fontWeight: 400,
                color: "var(--ink-900)",
                marginBottom: 12,
              }}
            >
              Registration has closed
            </h2>
            <p style={{ fontSize: 16, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 28 }}>
              Registration for this series has closed. Check back soon for the next one.
            </p>
            <button className="btn btn-primary" onClick={handleClose} style={{ justifyContent: "center" }}>
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow" style={{ marginBottom: 8 }}>{currentSeries?.name ?? "The Mahjong Open — 2026 — Series One"}</p>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 30,
                fontWeight: 400,
                lineHeight: 1.1,
                color: "var(--ink-900)",
                marginBottom: 24,
              }}
            >
              Join the{" "}
              <em style={{ color: "var(--pink-400)" }}>Mahjong Open</em>
            </h2>

            <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Full name">
                <input
                  className="input-mo"
                  type="text"
                  placeholder="Your name"
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  autoComplete="name"
                />
              </Field>

              <Field label="Email address">
                <input
                  className="input-mo"
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="email"
                />
              </Field>

              <Field label="Phone number">
                <input
                  className="input-mo"
                  type="tel"
                  placeholder="(601) 555-0147"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="tel"
                />
              </Field>

              <Field label="City">
                <select
                  className="input-mo"
                  value={form.city_id}
                  onChange={(e) => setForm((f) => ({ ...f, city_id: e.target.value }))}
                  disabled={cities.length === 0}
                >
                  <option value="">Select your city</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}, {city.state}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Skill level">
                <select
                  className="input-mo"
                  value={form.skill_level}
                  onChange={(e) => setForm((f) => ({ ...f, skill_level: e.target.value as typeof form.skill_level }))}
                >
                  <option value="">Select level</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </Field>

              {error && (
                <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{error}</p>
              )}

              <button
                className="btn btn-primary"
                type="submit"
                disabled={loading}
                style={{ marginTop: 8, justifyContent: "center", padding: "14px 24px" }}
              >
                {loading ? "Saving your spot…" : "Save my spot →"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>{label}</label>
      {children}
    </div>
  );
}
