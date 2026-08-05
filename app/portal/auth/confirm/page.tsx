"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
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

function ConfirmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const rawNext = params.get("next") ?? "/portal";
  const next = rawNext.startsWith("/") ? rawNext : "/portal";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    !tokenHash || !type ? "That link is missing some information. Please request a new one." : null
  );

  async function handleContinue() {
    if (!tokenHash || !type) return;
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      setError("That link has expired or was already used. Please sign in or request a new one.");
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--pink-wash)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={cardStyle}>
        <AuthLogo />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--ink-900)", marginBottom: 12, textAlign: "center" }}>
          Confirm it&rsquo;s you
        </h1>
        <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 24, textAlign: "center" }}>
          For your security, tap continue to finish signing in.
        </p>

        {error ? (
          <div style={{ background: "var(--danger-bg)", border: "1px solid var(--crimson-100)", borderRadius: "var(--radius-md)", padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--ink-700)", textAlign: "center" }}>
            {error}
          </div>
        ) : null}

        {tokenHash && type ? (
          <button className="btn btn-primary" type="button" onClick={handleContinue} disabled={loading} style={{ justifyContent: "center", width: "100%" }}>
            {loading ? "Confirming…" : "Continue"}
          </button>
        ) : null}

        <div style={{ marginTop: 20, textAlign: "center" }}>
          <Link href="/portal/login" style={{ fontSize: 13, color: "var(--pink-600)" }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmInner />
    </Suspense>
  );
}
