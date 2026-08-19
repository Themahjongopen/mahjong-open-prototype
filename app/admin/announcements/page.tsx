"use client";

import { useEffect, useState } from "react";
import { useConfirm } from "@/components/ConfirmProvider";

type City = { id: string; name: string; state: string | null; is_active: boolean };
type Series = { id: string; name: string; is_active: boolean };

const ALL_CITIES = "__all__"; // sentinel -> cityId: null ("every city in this series")

export default function AdminAnnouncementsPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [cityId, setCityId] = useState<string>(ALL_CITIES);
  const [seriesId, setSeriesId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; skipped: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  // Same active-first dropdown data as the standings page.
  useEffect(() => {
    (async () => {
      const [cRes, sRes] = await Promise.all([fetch("/api/admin/cities"), fetch("/api/admin/series")]);
      const cPayload = await cRes.json().catch(() => ({}));
      const sPayload = await sRes.json().catch(() => ({}));
      if (!cRes.ok || !sRes.ok) { setError("Could not load cities or leagues."); return; }
      setCities(cPayload.cities ?? []);
      setSeries(sPayload.series ?? []);
      setSeriesId((sPayload.series ?? [])[0]?.id ?? "");
    })();
  }, []);

  const seriesName = series.find((s) => s.id === seriesId)?.name ?? "this league";
  const selectedCity = cities.find((c) => c.id === cityId);
  const scopeLabel = cityId === ALL_CITIES
    ? `all cities in ${seriesName}`
    : `${selectedCity ? (selectedCity.state ? `${selectedCity.name}, ${selectedCity.state}` : selectedCity.name) : "the selected city"} (${seriesName})`;

  async function handleSend() {
    setError(null);
    setResult(null);
    if (!seriesId) { setError("Pick a league."); return; }
    if (!subject.trim() || !message.trim()) { setError("Subject and message are both required."); return; }

    const ok = await confirm({
      title: "Send announcement?",
      message: `This sends "${subject.trim()}" to ${scopeLabel} — every paid player there who hasn't opted out of league updates. It goes out immediately and can't be undone.`,
      confirmLabel: "Send announcement",
    });
    if (!ok) return;

    setSending(true);
    try {
      const res = await fetch("/api/admin/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesId, cityId: cityId === ALL_CITIES ? null : cityId, subject: subject.trim(), message: message.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setError(payload.error ?? "Could not send the announcement."); return; }
      setResult({ sent: payload.sent ?? 0, skipped: payload.skipped ?? 0, failed: payload.failed ?? 0 });
    } finally {
      setSending(false);
    }
  }

  const fieldLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--ink-800)", marginBottom: 6, display: "block" };
  const selectStyle: React.CSSProperties = { padding: "9px 12px", borderRadius: 10, border: "1px solid var(--hair-200)", background: "#fff", fontSize: 14, color: "var(--ink-900)", minWidth: 240 };

  return (
    <div style={{ maxWidth: 720 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 26, color: "var(--ink-900)", marginBottom: 8 }}>Announcements</h1>
      <p style={{ fontSize: 14, color: "var(--ink-500)", marginBottom: 24 }}>
        Send a series update to players — scope it to one city or an entire series. Only paid players with a portal account who haven&rsquo;t opted out receive it.
      </p>

      {result ? (
        <div style={{ background: "#f2f7f1", border: "1px solid #dcebdc", padding: "12px 14px", borderRadius: 10, marginBottom: 20, color: "var(--ink-800)", fontSize: 14 }}>
          Sent to {result.sent} player{result.sent === 1 ? "" : "s"}
          {result.skipped ? `, ${result.skipped} skipped (opted out)` : ""}
          {result.failed ? `, ${result.failed} failed` : ""}.
        </div>
      ) : null}
      {error ? (
        <div style={{ background: "#fff5f7", border: "1px solid #f4cbd6", padding: "12px 14px", borderRadius: 10, marginBottom: 20, color: "var(--pink-700)", fontSize: 14 }}>{error}</div>
      ) : null}

      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-lg)", padding: 24, boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div>
            <label style={fieldLabel}>League</label>
            <select style={selectStyle} value={seriesId} onChange={(e) => setSeriesId(e.target.value)} disabled={series.length === 0}>
              {series.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.is_active ? "" : " (inactive)"}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Audience</label>
            <select style={selectStyle} value={cityId} onChange={(e) => setCityId(e.target.value)}>
              <option value={ALL_CITIES}>All cities in this league</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.state ? `${c.name}, ${c.state}` : c.name}{c.is_active ? "" : " (inactive)"}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label style={fieldLabel}>Subject</label>
          <input className="input-mo" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Week 3 schedule update" maxLength={200} />
        </div>

        <div>
          <label style={fieldLabel}>Message</label>
          <textarea
            className="input-mo"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={"Write your announcement in plain text.\n\nLeave a blank line between paragraphs."}
            rows={9}
            style={{ resize: "vertical", lineHeight: 1.55 }}
          />
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSend}
          disabled={sending || !seriesId || !subject.trim() || !message.trim()}
          style={{ alignSelf: "flex-start" }}
        >
          {sending ? "Sending…" : "Send announcement"}
        </button>
      </div>
    </div>
  );
}
