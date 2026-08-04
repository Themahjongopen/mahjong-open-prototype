"use client";

import { useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useToast } from "@/components/portal/PortalShellClient";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "login", label: "Signing in / my account" },
  { value: "registration", label: "Registration or payment" },
  { value: "tables", label: "Tables, seats, or scoring" },
  { value: "standings", label: "Standings or stats look wrong" },
  { value: "other", label: "Something else" },
];

export default function SupportForm() {
  const { showToast } = useToast();
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!category) {
      setError("Please choose what this is about.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Please give us a few more details so we know what's going on.");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/portal/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, message: message.trim() }),
    });
    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(payload.error || "Something went wrong sending that. Please try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setSent(true);
    showToast("Thanks — we've got your message.");
  }

  if (sent) {
    return (
      <div style={{ padding: "40px 16px", maxWidth: 480, margin: "0 auto", textAlign: "center" }}>
        <LifeBuoy size={32} color="var(--pink-500)" style={{ marginBottom: 16 }} />
        <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 10 }}>
          Got it, thanks!
        </p>
        <p style={{ fontSize: 14, color: "var(--ink-500)", lineHeight: 1.6, marginBottom: 24 }}>
          Someone from The Mahjong Open will follow up by email as soon as they can.
        </p>
        <button
          className="btn btn-ghost"
          onClick={() => { setSent(false); setCategory(""); setMessage(""); }}
          style={{ justifyContent: "center" }}
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px", maxWidth: 480, margin: "0 auto" }}>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-900)", marginBottom: 6 }}>
        Get help
      </p>
      <p style={{ fontSize: 14, color: "var(--ink-500)", marginBottom: 20, lineHeight: 1.6 }}>
        Something not working right, or just have a question? Send us a note and we&rsquo;ll get back to you at the email on your account.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
            What&rsquo;s this about? <span style={{ color: "var(--pink-500)" }}>*</span>
          </label>
          <select className="input-mo" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Select one</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-800)" }}>
            Tell us what&rsquo;s going on <span style={{ color: "var(--pink-500)" }}>*</span>
          </label>
          <textarea
            className="input-mo"
            rows={6}
            placeholder="The more detail the better — what you were doing, what you expected, what happened instead."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ resize: "vertical" }}
          />
        </div>

        {error && <p style={{ fontSize: 13, color: "var(--danger)" }}>{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: "center", padding: "14px", marginTop: 4 }}>
          {loading ? "Sending…" : "Send message"}
        </button>
      </form>
    </div>
  );
}
