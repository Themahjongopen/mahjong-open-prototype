"use client";

import { useState } from "react";
import PageBanner from "@/components/marketing/PageBanner";
import { ExternalLink } from "lucide-react";

type Category = "All favorites" | "Tiles & sets" | "Table & decor";

const CATEGORIES: Category[] = [
  "All favorites",
  "Tiles & sets",
  "Table & decor",
];

type Product = {
  title: string;
  category: Category;
  blurb: string;
  href: string;
  image: string;
  bg: string;
  comingSoon?: boolean;
};

const PRODUCTS: Product[] = [
  {
    title: "Willow Mahjong Tiles",
    category: "Tiles & sets",
    blurb: "A serene acrylic set in muted green, dusty blue, and soft gold — 160 tiles with numbered flowers and a charming elephant joker. Quiet luxury for the table.",
    href: "https://ohmymahjong.com/discount/TSMJP?redirect=/products/willow-tile-set",
    image: "https://ohmymahjong.com/cdn/shop/files/willow-mahjong-tiles-8261776.jpg?v=1777349053",
    bg: "var(--lime-wash)",
  },
  {
    title: "Lagoon Mahjong Tiles",
    category: "Tiles & sets",
    blurb: "Crisp white faces with triple-layered edges in teal, citron, and magenta. A cool, water-inspired 160-tile set that feels both calming and vivid.",
    href: "https://ohmymahjong.com/discount/TSMJP?redirect=/products/lagoon-tile-set",
    image: "https://ohmymahjong.com/cdn/shop/files/lagoon-mahjong-tiles-2471015.jpg?v=1774628489",
    bg: "var(--peri-50)",
  },
  {
    title: "Holiday Soirée Mahjong Tiles",
    category: "Tiles & sets",
    blurb: "A festive heirloom set — bow-tied ornaments, winter florals, nutcracker jokers, and a candy-cane-red back. Hand-painted holiday cheer for every game night.",
    href: "https://thatmahjongmoment.com/discount/Mahjparlor?redirect=/products/holiday-soiree",
    image: "https://thatmahjongmoment.com/cdn/shop/files/HOLIDAY_SOIREE_TILES.jpg?v=1783890580",
    bg: "var(--pink-50)",
  },
  {
    title: "Mahjong Racks & Pushers (Set of 4)",
    category: "Table & decor",
    blurb: "Sleek 20-inch racks with magnetic pushers, sized for larger tiles and offered in fourteen colors to match any set. Sweep your whole wall in one motion.",
    href: "https://peacelovemahjong.com/discount/TSMJP?redirect=/products/mahjong-racks-racks-pushers-set-of-4",
    image: "https://peacelovemahjong.com/cdn/shop/files/IMG_6813-Edit_754fb59a-81a0-439b-8bca-c6f7dcfd7881.jpg?v=1780507217",
    bg: "var(--lime-50)",
  },
  {
    title: "Scallop Acrylic Mahjong Racks",
    category: "Table & decor",
    blurb: "Thick clear acrylic racks with sixteen scallops per pusher and snap-in magnets. A pretty, sturdy upgrade that fits our tiles and most other brands.",
    href: "https://thatmahjongmoment.com/discount/Mahjparlor?redirect=/products/scallop-pusher-mahjong-rack",
    image: "https://thatmahjongmoment.com/cdn/shop/files/1488D0CF-7D02-46CE-A9CC-181BB1C00677.jpg?v=1783890821",
    bg: "var(--lime-wash)",
  },
  {
    title: "Heirloom Collection: Fire + Fortune — Verdant Fortune",
    category: "Tiles & sets",
    blurb: "A jewel-toned heirloom set steeped in deep verdant greens and gilded detail, where fiery symbolism meets lush botanical artistry. A statement set worth the wait.",
    href: "https://www.macandmillermahjong.com/discount/TSMJP?redirect=/products/heirloom-collection-fire-fortune-verdant-fortune-coming-soon",
    image: "https://www.macandmillermahjong.com/cdn/shop/files/IMG_5750_1500x.jpg?v=1777589747",
    bg: "var(--peri-50)",
    comingSoon: true,
  },
];

export default function ShopPage() {
  const [active, setActive] = useState<Category>("All favorites");

  const filtered = active === "All favorites" ? PRODUCTS : PRODUCTS.filter((p) => p.category === active);

  return (
    <>
      <PageBanner
        eyebrow="Our favorites"
        headline={<>The good stuff, <em className="serif-italic">handpicked</em></>}
        lead="Our favorite gear for playing, hosting, and gifting — curated by players, for players."
      />

      {/* Category filter */}
      <section style={{ padding: "40px 0 0", background: "#fff", borderBottom: "1px solid var(--hair-200)" }}>
        <div className="container-mo">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingBottom: 20 }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  padding: "7px 16px",
                  borderRadius: "var(--radius-pill)",
                  border: active === cat ? "2px solid var(--pink-400)" : "1.5px solid var(--hair-200)",
                  background: active === cat ? "var(--pink-50)" : "#fff",
                  color: active === cat ? "var(--pink-700)" : "var(--ink-700)",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Product grid */}
      <section style={{ padding: "48px 0 80px" }}>
        <div className="container-mo">
          <div className="products-grid">
            {filtered.map((product) => (
              <div
                key={product.title}
                className="card-lift"
                style={{
                  background: "#fff",
                  border: "1px solid var(--hair-200)",
                  borderRadius: "var(--radius-lg)",
                  boxShadow: "var(--shadow-sm)",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Product image (colored block shows as fallback if the image fails) */}
                <div
                  style={{
                    aspectRatio: "4/3",
                    background: product.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {product.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.image}
                      alt={product.title}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <p style={{ fontSize: 13, color: "var(--ink-500)", textAlign: "center", padding: 16 }}>
                      {product.title}
                    </p>
                  )}
                </div>
                <div style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span className="badge badge-lime">{product.category}</span>
                    {product.comingSoon ? <span className="badge badge-mute">Coming soon</span> : null}
                  </div>
                  <h3
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      fontWeight: 400,
                      color: "var(--ink-900)",
                      lineHeight: 1.25,
                    }}
                  >
                    {product.title}
                  </h3>
                  <p style={{ fontSize: 14, color: "var(--ink-700)", lineHeight: 1.6, flex: 1 }}>{product.blurb}</p>
                  <a
                    href={product.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--pink-600)",
                      textDecoration: "none",
                      marginTop: 4,
                    }}
                  >
                    {product.comingSoon ? "Get notified" : "Shop this pick"}
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* Affiliate disclosure */}
          <p
            style={{
              marginTop: 48,
              fontSize: 12,
              color: "var(--ink-500)",
              lineHeight: 1.6,
              borderTop: "1px solid var(--hair-200)",
              paddingTop: 24,
            }}
          >
            <strong>Affiliate disclosure:</strong> Some links on this page may earn The Mahjong Open a small commission at no extra cost to you. We only recommend products we genuinely use and love.
          </p>
        </div>
      </section>

      <style>{`
        .products-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }
        @media (max-width: 900px) {
          .products-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .products-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
