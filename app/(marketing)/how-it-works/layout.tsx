import type { Metadata } from "next";

// Metadata lives in this server layout because how-it-works/page.tsx is a
// client component (which can't export `metadata`).
const title = "How The Mahjong Open Works — 8-Week Mahjong Series";
const description =
  "See how The Mahjong Open works: register for your city, play unlimited 4-player games across an 8-week series, submit scores, and climb the leaderboard.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/how-it-works" },
  openGraph: { title, description, type: "website", siteName: "The Mahjong Open" },
  twitter: { card: "summary_large_image", title, description },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
