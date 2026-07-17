"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NOTIFICATION_PREFS, type ResolvedPrefs } from "@/lib/portal/notificationPrefs";

type SkillValue = "beginner" | "intermediate" | "advanced" | "";

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--ink-800)", marginBottom: 6, display: "block" };

export default function ProfileEditForm({
  initialName,
  initialSkill,
  initialPrefs,
}: {
  initialName: string;
  initialSkill: SkillValue;
  initialPrefs: ResolvedPrefs;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [skill, setSkill] = useState<SkillValue>(initialSkill);
  const [prefs, setPrefs] = useState<ResolvedPrefs>(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    setError(null);

    const res = await fetch("/api/portal/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: name,
        skill_level: skill === "" ? null : skill,
        notification_preferences: prefs,
      }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload.error || "Your profile could not be updated.");
      setSaving(false);
      return;
    }

    setFeedback("Profile saved.");
    setSaving(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {feedback ? <div style={{ background: "#f2f7f1", border: "1px solid #dcebdc", padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "var(--ink-800)" }}>{feedback}</div> : null}
      {error ? <div style={{ background: "#fff5f7", border: "1px solid #f4cbd6", padding: "10px 14px", borderRadius: 10, fontSize: 13, color: "var(--pink-700)" }}>{error}</div> : null}

      <div>
        <label style={labelStyle} htmlFor="full_name">Name</label>
        <input id="full_name" className="input-mo" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div>
        <label style={labelStyle} htmlFor="skill_level">Skill level</label>
        <select id="skill_level" className="input-mo" value={skill} onChange={(e) => setSkill(e.target.value as SkillValue)}>
          <option value="">Not set</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </div>

      <div>
        <span style={labelStyle}>Email notifications</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
          {NOTIFICATION_PREFS.map((pref) => (
            <label key={pref.key} style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={prefs[pref.key]}
                onChange={(e) => setPrefs((p) => ({ ...p, [pref.key]: e.target.checked }))}
                style={{ marginTop: 3, width: 16, height: 16, accentColor: "var(--pink-500)" }}
              />
              <span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-900)", display: "block" }}>{pref.label}</span>
                <span style={{ fontSize: 13, color: "var(--ink-500)" }}>{pref.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <button className="btn btn-primary" type="submit" disabled={saving} style={{ alignSelf: "flex-start", justifyContent: "center" }}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
