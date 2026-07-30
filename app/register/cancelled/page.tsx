import type { Metadata } from "next";
import Link from "next/link";
import ConfirmationIcon from "@/components/ui/ConfirmationIcon";
import { getPortalUser } from "@/lib/portal/session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function RegisterCancelledPage() {
  // If they cancelled while adding a city from inside the portal, offer a way
  // back to it. Additive only — Stripe cancel_url/webhook are untouched.
  const session = await getPortalUser();
  const inPortal = !!session && session.status === "active";

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
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
          {inPortal ? (
            <Link href="/portal" className="btn btn-primary">
              Continue to your portal
            </Link>
          ) : null}
          <Link href="/" className={inPortal ? "btn btn-ghost" : "btn btn-primary"}>
            Back to register
          </Link>
        </div>
      </div>
    </main>
  );
}
