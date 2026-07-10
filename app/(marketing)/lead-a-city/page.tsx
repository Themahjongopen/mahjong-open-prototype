import type { Metadata } from "next";
import CommissionerForm from "@/components/marketing/CommissionerForm";

// Approved indexable page (target keyword: "become a mahjong league commissioner").
// No page-level robots override — it follows the global SITE_INDEXABLE guard, so it
// stays noindex pre-launch and becomes indexable when SITE_INDEXABLE=true at launch.
const title = "Become a Mahjong League Commissioner — The Mahjong Open";
const description =
  "Become a mahjong league commissioner and bring The Mahjong Open to your city. No franchise fees, no buy-in — we bring the brand, tools, and support.";

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "become a mahjong league commissioner",
    "mahjong league commissioner",
    "lead a mahjong league",
    "start a mahjong club",
    "The Mahjong Open",
  ],
  alternates: { canonical: "/lead-a-city" },
  openGraph: { title, description, type: "website", siteName: "The Mahjong Open" },
  twitter: { card: "summary_large_image", title, description },
};

export default function LeadACityPage() {
  return (
    <main style={{ background: "var(--pink-wash)", padding: "48px 0 88px" }}>
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
            Become a commissioner
          </p>
          <h1 className="h1" style={{ marginBottom: 14 }}>
            Bring The Mahjong Open to your city
          </h1>
          <p className="body-lg" style={{ maxWidth: 680, marginBottom: 4 }}>
            If you love the game and want to build a local community around it, we’d love to hear from you.{" "}
            <strong style={{ fontWeight: 700, color: "var(--lime-600)" }}>No franchise fees. No buy-in.</strong>
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
