import type { Metadata } from "next";

// Metadata lives in this server layout because shop/page.tsx is a client component.
const title = "Shop Our Favorites — Mahjong Tiles, Racks & Gear";
const description =
  "Our handpicked favorite mahjong gear — tiles, racks, pushers, and gifts, curated by players. Quiet-luxury sets we genuinely use and love.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/shop" },
  openGraph: { title, description, type: "website", siteName: "The Mahjong Open" },
  twitter: { card: "summary_large_image", title, description },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
