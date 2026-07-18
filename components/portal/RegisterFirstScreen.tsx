import Link from "next/link";
import SignOutButton from "@/components/portal/SignOutButton";

// Shown when someone is authenticated but has no paid registration (unpaid or an
// email that doesn't match a paid signup). Friendly dead-end, not a redirect loop.
export default function RegisterFirstScreen({ email }: { email: string }) {
  return (
    <div style={{ minHeight: "100dvh", background: "var(--pink-wash)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-lg)", width: "100%", maxWidth: 460, padding: "44px 40px", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--pink-600)", marginBottom: 8 }}>
          The Mahjong Open
        </p>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--ink-900)", marginBottom: 12 }}>
          You&rsquo;re not registered yet
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 24 }}>
          We couldn&rsquo;t find a paid registration for <strong>{email || "your account"}</strong>. Once you&rsquo;ve registered and paid for a series, your portal will unlock here.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/" className="btn btn-primary" style={{ justifyContent: "center" }}>
            Register for a series
          </Link>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
