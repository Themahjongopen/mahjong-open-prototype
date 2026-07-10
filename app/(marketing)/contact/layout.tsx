import type { Metadata } from "next";

// Metadata lives in this server layout because contact/page.tsx is a client component.
const title = "Contact The Mahjong Open — Get in Touch";
const description =
  "Questions about registration, your city, or the series? Contact The Mahjong Open — we typically respond within 1–2 business days.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/contact" },
  openGraph: { title, description, type: "website", siteName: "The Mahjong Open" },
  twitter: { card: "summary_large_image", title, description },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
