"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NOTIFICATION_PREFS, type ResolvedPrefs } from "@/lib/portal/notificationPrefs";
import Avatar from "@/components/portal/Avatar";

type SkillValue = "beginner" | "intermediate" | "advanced" | "";

const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--ink-800)", marginBottom: 6, display: "block" };

export default function ProfileEditForm({
  userId,
  initialName,
  initialSkill,
  initialPrefs,
  initialAvatarUrl,
}: {
  userId: string;
  initialName: string;
  initialSkill: SkillValue;
  initialPrefs: ResolvedPrefs;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [skill, setSkill] = useState<SkillValue>(initialSkill);
  const [prefs, setPrefs] = useState<ResolvedPrefs>(initialPrefs);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setFeedback(null);

    const supabase = createClient();
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    // Fixed per-user path (RLS: folder must be the member's uid); upsert to
    // replace the old photo. Cache-bust the saved URL so the new image shows.
    const path = `${userId}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setError("Photo upload failed. Use a JPG, PNG, or WebP under 3 MB.");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(`${data.publicUrl}?v=${file.size}-${file.lastModified}`);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

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
        avatar_url: avatarUrl,
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
        <span style={labelStyle}>Photo</span>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Avatar src={avatarUrl} size={64} alt="Your photo" />
          <div>
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ fontSize: 13, padding: "7px 14px" }}>
              {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} style={{ display: "none" }} />
            <p style={{ fontSize: 12, color: "var(--ink-500)", marginTop: 6 }}>JPG, PNG, or WebP · up to 3 MB.</p>
          </div>
        </div>
      </div>

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

      <button className="btn btn-primary" type="submit" disabled={saving || uploading} style={{ alignSelf: "flex-start", justifyContent: "center" }}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
