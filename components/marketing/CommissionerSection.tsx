import Link from "next/link";
import { BadgeCheck, HandCoins, HeartHandshake, TrendingUp } from "lucide-react";

export default function CommissionerSection() {
  return (
    <section
      className="stack-panel"
      style={{
        padding: "72px 0 88px",
        borderTop: "1px solid var(--hair-200)",
        backgroundColor: "var(--bg)",
        // Tiles photo behind the card, washed out by a white overlay (~22% of the image shows through)
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.78), rgba(255,255,255,0.78)), url(/commissioner-tiles-bg.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="container-mo">
        <div
          style={{
            background: "#fff",
            border: "1px solid var(--hair-200)",
            borderRadius: "var(--radius-xl)",
            padding: "48px 40px",
            boxShadow: "var(--shadow-sm)",
            animation: "fadeIn 0.6s ease",
          }}
        >
          <p className="eyebrow" style={{ marginBottom: 14 }}>
            Lead a city
          </p>
          <h2 className="h2" style={{ marginBottom: 16 }}>
            Bring The Mahjong Open to your city
          </h2>
          <p className="body-lg" style={{ maxWidth: 760, marginBottom: 28 }}>
            The Mahjong Open grows one community at a time. If you love the game and want to build something local, you can lead The Mahjong Open in your city as its commissioner — we’ll bring the structure, the brand, and the support.
          </p>

          {/* Reassurance strip */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            {[
              { Icon: BadgeCheck, label: "No franchise fees", caption: "Lead your city with zero upfront cost." },
              { Icon: HandCoins, label: "No buy-in", caption: "No financial commitment to get started." },
              { Icon: HeartHandshake, label: "Full support", caption: "We bring the brand, tools, and structure." },
              { Icon: TrendingUp, label: "Earn as you grow", caption: "Tiered commissions that rise as more players join your city." },
            ].map(({ Icon, label, caption }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  background: "var(--pink-wash)",
                  border: "1px solid var(--hair-200)",
                  borderRadius: "var(--radius-lg)",
                  padding: "18px",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "#fff",
                    border: "1px solid var(--pink-100)",
                    color: "var(--pink-600)",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={20} strokeWidth={1.75} />
                </span>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 15, color: "var(--ink-900)", marginBottom: 3 }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--ink-500)", lineHeight: 1.5 }}>
                    {caption}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/lead-a-city"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            style={{ fontSize: 15 }}
          >
            Apply to lead a city
          </Link>
        </div>
      </div>
    </section>
  );
}
