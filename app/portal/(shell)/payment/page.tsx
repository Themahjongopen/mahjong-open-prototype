import Link from "next/link";
import { CreditCard } from "lucide-react";

export default function PaymentGatePage() {
  return (
    <div
      style={{
        minHeight: "calc(100dvh - 120px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          border: "1px solid var(--hair-200)",
          borderRadius: "var(--radius-xl)",
          padding: "40px 36px",
          maxWidth: 400,
          textAlign: "center",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--peri-50)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
          }}
        >
          <CreditCard size={24} color="var(--peri-500)" />
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 26,
            fontWeight: 400,
            color: "var(--ink-900)",
            marginBottom: 12,
            lineHeight: 1.15,
          }}
        >
          One step left
        </h1>

        <p style={{ fontSize: 15, color: "var(--ink-700)", lineHeight: 1.6, marginBottom: 24 }}>
          Your registration is saved. To access the player portal, complete your season payment. We&rsquo;ll email you with payment instructions shortly.
        </p>

        {/* TODO: Replace with Stripe Checkout button when Stripe is configured */}
        <div
          style={{
            background: "var(--warning-bg)",
            border: "1px solid var(--peri-200)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 16px",
            fontSize: 13,
            color: "var(--ink-800)",
            marginBottom: 24,
            textAlign: "left",
          }}
        >
          <strong>Coming soon:</strong> Online payment will be available here. In the meantime, contact us and we&rsquo;ll get you set up manually.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/contact" className="btn btn-primary" style={{ justifyContent: "center" }}>
            Contact us to pay
          </Link>
          <Link href="/" className="btn btn-ghost" style={{ justifyContent: "center" }}>
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
