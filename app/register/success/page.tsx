import type { Metadata } from "next";
import Link from "next/link";
import ConfirmationIcon from "@/components/ui/ConfirmationIcon";
import TrackOnMount from "@/components/analytics/TrackOnMount";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function RegisterSuccessPage() {
  return (
    <main style={{ minHeight: "calc(100dvh - 120px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <TrackOnMount event="registration_complete" />
      <div style={{ background: "#fff", border: "1px solid var(--hair-200)", borderRadius: "var(--radius-xl)", padding: "40px 36px", maxWidth: 440, textAlign: "center", boxShadow: "var(--shadow-md)" }}>
        <ConfirmationIcon name="rsvp" />
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 400, color: "var(--ink-900)", marginBottom: 12 }}>
          You’re registered and paid
        </h1>
        <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 24 }}>
          Your registration is confirmed. We’ll send the welcome email after payment confirmation and keep you posted about the series.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link href="/portal" className="btn btn-primary">
            Go to the portal
          </Link>
        </div>
      </div>
    </main>
  );
}
