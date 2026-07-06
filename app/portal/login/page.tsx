"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const cardStyle: React.CSSProperties = {
  background: "#fff",
  borderRadius: "var(--radius-xl)",
  boxShadow: "var(--shadow-lg)",
  width: "100%",
  maxWidth: 420,
  padding: "44px 40px",
};
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--ink-800)", marginBottom: 6, display: "block" };

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link_invalid" ? "That link has expired or was already used. Please sign in or request a new one." : null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError("Incorrect email or password.");
      setLoading(false);
      return;
    }
    const next = params.get("next");
    router.push(next && next.startsWith("/") ? next : "/portal");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--pink-wash)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={cardStyle}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--pink-600)", marginBottom: 8, textAlign: "center" }}>
          The Mahjong Open
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--ink-900)", marginBottom: 24, textAlign: "center" }}>
          Player portal sign in
        </h1>

        {error ? (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--crimson-100)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--ink-700)" }}>
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle} htmlFor="email">Email</label>
            <input id="email" className="input-mo" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div>
            <label style={labelStyle} htmlFor="password">Password</label>
            <input id="password" className="input-mo" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: "center", marginTop: 4 }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <Link href="/portal/reset-password" style={{ fontSize: 13, color: "var(--pink-600)" }}>Forgot password?</Link>
        </div>
      </div>
    </div>
  );
}

export default function PortalLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
