import type { Metadata } from "next";
import CommissionerForm from "@/components/marketing/CommissionerForm";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function LeadACityPage() {
  return (
    <main style={{ background: "var(--bg)", padding: "48px 0 88px" }}>
      <div className="container-mo" style={{ display: "grid", gap: 26 }}>
        <section
          style={{
            background: "#fff",
            border: "1px solid var(--hair-200)",
            borderRadius: "var(--radius-xl)",
            padding: "40px 36px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <p className="eyebrow" style={{ marginBottom: 12 }}>
            Lead the Mahjong Open in your city
          </p>
          <h1 className="h1" style={{ marginBottom: 14 }}>
            Bring the Mahjong Open to your city
          </h1>
          <p className="body-lg" style={{ maxWidth: 680, marginBottom: 4 }}>
            If you love the game and want to build a local community around it, we’d love to hear from you. No franchise fees. No buy-in.
          </p>
        </section>

        <section
          style={{
            background: "#fff",
            border: "1px solid var(--hair-200)",
            borderRadius: "var(--radius-xl)",
            padding: "34px 32px",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <CommissionerForm />
        </section>
      </div>
    </main>
  );
}
