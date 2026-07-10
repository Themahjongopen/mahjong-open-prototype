import type { Metadata } from "next";
import Link from "next/link";
import ConfirmationIcon from "@/components/ui/ConfirmationIcon";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RegisterCancelledPage() {
  return (
    <main style={{ minHeight: "calc(100dvh - 120px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-xl)", padding: "40px 36px", maxWidth: 440, textAlign: "center", boxShadow: "var(--shadow-md)" }}>
        <ConfirmationIcon name="clock" />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 400, color: "var(--ink-900)", marginBottom: 12 }}>
          Your registration isn’t complete
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 24 }}>
          Your spot isn’t reserved yet — no payment was processed. Pick up right where you left off whenever you’re ready.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href="/" className="btn btn-primary">
            Back to register
          </Link>
        </div>
      </div>
    </main>
  );
}
