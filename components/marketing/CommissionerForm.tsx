"use client";

import { useState, type CSSProperties } from "react";
import ConfirmationIcon from "@/components/ui/ConfirmationIcon";

const teachOptions = [
  { value: "regularly", label: "Yes, regularly" },
  { value: "occasionally", label: "Occasionally" },
  { value: "not_yet", label: "Not yet" },
];

const reachOptions = [
  { value: "1_10", label: "1–10" },
  { value: "11_25", label: "11–25" },
  { value: "26_50", label: "26–50" },
  { value: "50_plus", label: "50+" },
];

const timelineOptions = [
  { value: "asap", label: "As soon as possible" },
  { value: "1_3", label: "1–3 months" },
  { value: "3_6", label: "3–6 months" },
  { value: "exploring", label: "Just exploring for now" },
];

const venueOptions = [
  "Private homes",
  "Clubs or country clubs",
  "Restaurants or cafés",
  "Community or rec centers",
  "Other",
];

export default function CommissionerForm() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    proposed_city: "",
    socials: "",
    experience: "",
    teaches_organize: "",
    reach_estimate: "",
    play_venues: [] as string[],
    motivation: "",
    desired_timeline: "",
    notes: "",
    honeypot: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleVenue(value: string) {
    setForm((current) => ({
      ...current,
      play_venues: current.play_venues.includes(value)
        ? current.play_venues.filter((item) => item !== value)
        : [...current.play_venues, value],
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    setLoading(true);

    try {
      const response = await fetch("/api/commissioner-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          play_venues: form.play_venues,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Your application could not be submitted. Please try again.");
      }

      setSubmitted(true);
      setForm({
        full_name: "",
        email: "",
        phone: "",
        proposed_city: "",
        socials: "",
        experience: "",
        teaches_organize: "",
        reach_estimate: "",
        play_venues: [],
        motivation: "",
        desired_timeline: "",
        notes: "",
        honeypot: "",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--hair-200)",
          borderRadius: "var(--radius-xl)",
          padding: "42px 32px",
          boxShadow: "var(--shadow-sm)",
          textAlign: "center",
        }}
      >
        <ConfirmationIcon name="invite" />
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 400, color: "var(--ink-900)", marginBottom: 12 }}>
          Thanks — we’ve got your interest
        </h2>
        <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6 }}>
          Thanks — we’ve got your interest and will be in touch.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 18 }} noValidate>
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Full name *</label>
          <input
            className="input-mo"
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            required
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Email *</label>
          <input
            className="input-mo"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            required
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Phone *</label>
          <input
            className="input-mo"
            type="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            required
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>What city / region would you bring the Mahjong Open to? *</label>
          <input
            className="input-mo"
            value={form.proposed_city}
            onChange={(e) => updateField("proposed_city", e.target.value)}
            placeholder="City or region"
            required
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Social media and/or website</label>
          <input
            className="input-mo"
            value={form.socials}
            onChange={(e) => updateField("socials", e.target.value)}
            placeholder="Instagram, LinkedIn, website, etc."
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>How would you describe your Mahjong experience? *</label>
          <textarea
            className="input-mo"
            rows={4}
            value={form.experience}
            onChange={(e) => updateField("experience", e.target.value)}
            required
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Do you currently teach or organize Mahjong? *</label>
          <select
            className="input-mo"
            value={form.teaches_organize}
            onChange={(e) => updateField("teaches_organize", e.target.value)}
            required
          >
            <option value="">Select one</option>
            {teachOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Roughly how many local players could you realistically bring or reach? *</label>
          <select
            className="input-mo"
            value={form.reach_estimate}
            onChange={(e) => updateField("reach_estimate", e.target.value)}
            required
          >
            <option value="">Select a range</option>
            {reachOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Where do people in your area usually play?</label>
          <div style={{ display: "grid", gap: 10 }}>
            {venueOptions.map((venue) => {
              const checked = form.play_venues.includes(venue);
              return (
                <label
                  key={venue}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 14px",
                    border: `1px solid ${checked ? "var(--pink-200)" : "var(--hair-200)"}`,
                    borderRadius: "var(--radius-md)",
                    background: checked ? "var(--pink-50)" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleVenue(venue)}
                    style={{ width: 16, height: 16, accentColor: "var(--pink-600)" }}
                  />
                  <span style={{ fontSize: 14, color: "var(--ink-700)" }}>{venue}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Why do you want to lead the Mahjong Open in your city? *</label>
          <textarea
            className="input-mo"
            rows={4}
            value={form.motivation}
            onChange={(e) => updateField("motivation", e.target.value)}
            required
          />
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>How soon would you hope to launch?</label>
          <select
            className="input-mo"
            value={form.desired_timeline}
            onChange={(e) => updateField("desired_timeline", e.target.value)}
          >
            <option value="">Select one</option>
            {timelineOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={labelStyle}>Anything else you’d like us to know?</label>
          <textarea
            className="input-mo"
            rows={4}
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </div>

        <input
          type="text"
          style={{ position: "absolute", left: "-9999px", opacity: 0, pointerEvents: "none" }}
          tabIndex={-1}
          autoComplete="off"
          value={form.honeypot}
          onChange={(e) => updateField("honeypot", e.target.value)}
          aria-hidden="true"
        />

        {error ? (
          <div style={{ padding: "12px 14px", background: "var(--warning-bg)", borderRadius: "var(--radius-sm)", color: "var(--ink-700)", fontSize: 14 }}>
            {error}
          </div>
        ) : null}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "fit-content" }}>
          {loading ? "Submitting..." : "Submit interest"}
        </button>
      </div>
    </form>
  );
}

const labelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "var(--ink-900)",
};
