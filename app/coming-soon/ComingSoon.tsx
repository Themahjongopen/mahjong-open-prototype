"use client";

import { useState } from "react";
import Image from "next/image";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ComingSoon() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), website }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong. Please try again.");
      }
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        // Lead-a-City tile image (cropped copy without the "Bam! Let's Mahjong"
        // script) under a pale-pink (--pink-wash) wash instead of white.
        backgroundImage:
          "linear-gradient(rgba(253, 239, 243, 0.82), rgba(253, 239, 243, 0.82)), url('/coming-soon-bg.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="cs-card" style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
        <div className="cs-fade" style={{ animationDelay: "0ms" }}>
          <Image src="/assets/logo-nav.svg?v=2" alt="The Mahjong Open" width={200} height={65} priority style={{ height: "auto", width: 200, margin: "0 auto 36px" }} />
        </div>

        <h1
          className="cs-fade"
          style={{
            animationDelay: "80ms",
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: "clamp(40px, 9vw, 64px)",
            lineHeight: 1.02,
            color: "var(--ink-900)",
            margin: "0 0 18px",
            letterSpacing: "-0.01em",
          }}
        >
          Coming <em className="serif-italic" style={{ color: "var(--pink-600)" }}>Soon</em>
        </h1>

        <p
          className="cs-fade"
          style={{
            animationDelay: "160ms",
            fontSize: 16,
            lineHeight: 1.65,
            color: "var(--ink-700)",
            margin: "0 auto 32px",
            maxWidth: 400,
          }}
        >
          A city-based mahjong social league for everyone who loves the game. Be the first to know when we open.
        </p>

        {status === "done" ? (
          <div
            className="cs-fade"
            style={{
              animationDelay: "0ms",
              background: "var(--lime-50)",
              border: "1px solid var(--lime-200)",
              borderRadius: "var(--radius-lg)",
              padding: "18px 22px",
              fontSize: 15,
              color: "var(--ink-800)",
              lineHeight: 1.6,
            }}
          >
            You&rsquo;re on the list — we&rsquo;ll be in touch.
          </div>
        ) : (
          <form className="cs-fade" onSubmit={handleSubmit} style={{ animationDelay: "240ms" }} noValidate>
            {/* Honeypot — visually hidden, off-screen */}
            <div style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }} aria-hidden="true">
              <label htmlFor="cs-website">Website</label>
              <input id="cs-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </div>

            <div className="cs-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <input
                type="email"
                className="input-mo cs-input"
                placeholder="you@example.com"
                aria-label="Email address"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={status === "loading"}
                style={{ flex: "1 1 240px", minWidth: 0 }}
              />
              <button type="submit" className="btn btn-primary" disabled={status === "loading"} style={{ justifyContent: "center", flex: "0 0 auto" }}>
                {status === "loading" ? "Adding…" : "Notify me"}
              </button>
            </div>
            {error ? (
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--danger)" }}>{error}</p>
            ) : null}
          </form>
        )}
      </div>

      <style>{`
        .cs-fade {
          opacity: 0;
          transform: translateY(12px);
          animation: csFadeUp 0.6s var(--easing, cubic-bezier(0.22, 0.61, 0.36, 1)) forwards;
        }
        @keyframes csFadeUp {
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .cs-fade { animation: none; opacity: 1; transform: none; }
        }
        @media (max-width: 480px) {
          .cs-row { flex-direction: column; }
          .cs-input { flex-basis: auto !important; width: 100%; }
          .cs-row .btn { width: 100%; }
        }
      `}</style>
    </main>
  );
}
