"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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

const MIN_LENGTH = 8;

// Shared by /portal/set-password (invite) and /portal/update-password (reset).
// Both land here with an active session already established by the auth callback.
export default function SetPasswordForm({ heading, blurb, cta }: { heading: string; blurb: string; cta: string }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(Boolean(data.user));
      setChecking(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message || "Couldn't set your password. Please try again.");
      setLoading(false);
      return;
    }
    router.push("/portal");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--pink-wash)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={cardStyle}>
        <AuthLogo />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--ink-900)", marginBottom: 12, textAlign: "center" }}>
          {heading}
        </h1>

        {checking ? (
          <p style={{ fontSize: 14, color: "var(--ink-500)", textAlign: "center" }}>Loading…</p>
        ) : !hasSession ? (
          <div style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, textAlign: "center" }}>
            <p style={{ marginBottom: 16 }}>This link has expired or was already used. Request a new one from the sign-in page.</p>
            <Link href="/portal/login" className="btn btn-primary" style={{ justifyContent: "center" }}>Back to sign in</Link>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 24, textAlign: "center" }}>{blurb}</p>
            {error ? (
              <div style={{ background: "var(--danger-bg)", border: "1px solid var(--crimson-100)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--ink-700)" }}>
                {error}
              </div>
            ) : null}
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="password">New password</label>
                <input id="password" className="input-mo" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN_LENGTH} characters`} />
              </div>
              <div>
                <label style={labelStyle} htmlFor="confirm">Confirm password</label>
                <input id="confirm" className="input-mo" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: "center", marginTop: 4 }}>
                {loading ? "Saving…" : cta}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
