"use client";

import { useState } from "react";

type EligibleCity = { id: string; name: string; state: string | null };
type ProfileFields = {
  full_name: string;
  email: string;
  phone: string;
  skill_level: "beginner" | "intermediate" | "advanced" | "";
  avatar_url: string;
};

// Interactive part of the "register another city" page. The player already has
// full_name/phone/skill_level/avatar_url on their profile, so we only ask for a
// city (and let them tweak skill level). On submit we POST the existing profile
// fields + the chosen city to /api/register and redirect to Stripe checkout —
// the same redirect pattern as the marketing RegisterModal.
export default function RegisterCityForm({
  eligibleCities,
  seriesId,
  profile,
}: {
  eligibleCities: EligibleCity[];
  seriesId: string;
  profile: ProfileFields;
}) {
  const [cityId, setCityId] = useState("");
  const [skill, setSkill] = useState<ProfileFields["skill_level"]>(profile.skill_level || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!cityId) {
      setError("Please choose a city.");
      return;
    }
    if (!skill) {
      setError("Please choose a skill level.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          city_id: cityId,
          series_id: seriesId,
          skill_level: skill,
          avatar_url: profile.avatar_url,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not start registration. Please try again.");
      }
      const data = await res.json();
      if (data.url) {
        // Hand off to Stripe checkout (page unmounts, so leave loading on).
        window.location.href = data.url;
      } else {
        throw new Error("Payment checkout was not returned.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>City</label>
        <select className="input-mo" value={cityId} onChange={(e) => setCityId(e.target.value)}>
          <option value="">Select a city</option>
          {eligibleCities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.state ? `${c.name}, ${c.state}` : c.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>Skill level</label>
        <select className="input-mo" value={skill} onChange={(e) => setSkill(e.target.value as ProfileFields["skill_level"])}>
          <option value="">Select level</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      {error ? <p style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>{error}</p> : null}

      <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop: 4, justifyContent: "center", padding: "14px 24px" }}>
        {loading ? "Starting checkout…" : "Continue to payment →"}
      </button>
    </form>
  );
}
