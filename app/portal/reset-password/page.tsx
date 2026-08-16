"use client";

import { useState } from "react";
import Link from "next/link";
import AuthLogo from "@/components/portal/AuthLogo";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "var(--radius-xl)",
  boxShadow: "var(--shadow-lg)",
  width: "100%",
  maxWidth: 420,
  padding: "44px 40px",
};
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--ink-800)", marginBottom: 6, display: "block" };

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    // App-owned reset flow: this route mints the recovery token server-side and
    // emails our branded link pointing at /portal/auth/confirm (which only
    // consumes the token on a real click) — instead of Supabase's default
    // recovery email, whose link gets burned by email scanners before the player
    // clicks. The route always returns ok, and we show the same confirmation
    // regardless of outcome so account existence never leaks.
    await fetch("/api/portal/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => {});
    setSent(true);
    setLoading(false);
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--pink-wash)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={cardStyle}>
        <AuthLogo />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--ink-900)", marginBottom: 12, textAlign: "center" }}>
          Reset your password
        </h1>

        {sent ? (
          <div style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, textAlign: "center" }}>
            <p style={{ marginBottom: 20 }}>If an account exists for that email, we&rsquo;ve sent a link to reset your password. Check your inbox.</p>
            <Link href="/portal/login" className="btn btn-primary" style={{ justifyContent: "center" }}>Back to sign in</Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 24, textAlign: "center" }}>
              Enter your email and we&rsquo;ll send you a link to set a new password.
            </p>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="email">Email</label>
                <input id="email" className="input-mo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: "center", marginTop: 4 }}>
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <Link href="/portal/login" style={{ fontSize: 13, color: "var(--pink-600)" }}>Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
