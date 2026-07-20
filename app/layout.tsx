import type { Metadata } from "next";
import { Bodoni_Moda, Quicksand } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import ConfirmProvider from "@/components/ConfirmProvider";
import "./globals.css";

const bodoniModa = Bodoni_Moda({
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
});

const quicksand = Quicksand({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body-loaded",
  display: "swap",
});

// Search-engine visibility is OFF by default (pre-launch safe default).
// The site stays noindex until SITE_INDEXABLE is explicitly set to "true"
// in the environment (set it in Vercel at launch, then redeploy).
// The link still works for anyone you share it with — noindex only keeps
// the site out of Google/Bing search results.
const isIndexable = process.env.SITE_INDEXABLE === "true";

export const metadata: Metadata = {
  metadataBase: new URL("https://themahjongopen.com"),
  title: "The Mahjong Open — City-Based Mahjong Social League",
  description:
    "A city-based mahjong social league. Register once, play unlimited games over an 8-week series, and climb your city's leaderboard. Warm, welcoming, flexible.",
  keywords: [
    "mahjong social league",
    "mahjong league",
    "city mahjong league",
    "mahjong club",
    "learn mahjong",
    "The Mahjong Open",
  ],
  alternates: { canonical: "/" },
  robots: isIndexable ? undefined : { index: false, follow: false },
  openGraph: {
    title: "The Mahjong Open — City-Based Mahjong Social League",
    description:
      "A city-based mahjong social league. Register once, play unlimited games over an 8-week series, and climb your city's leaderboard. Warm, welcoming, flexible.",
    type: "website",
    siteName: "The Mahjong Open",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Mahjong Open — City-Based Mahjong Social League",
    description:
      "A city-based mahjong social league. Register once, play unlimited games over an 8-week series, and climb your city's leaderboard. Warm, welcoming, flexible.",
  },
};

// Organization structured data (JSON-LD) — helps Google and AI answer engines
// understand what The Mahjong Open is. City-agnostic (no fixed address yet).
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "The Mahjong Open",
  description:
    "The Mahjong Open is a city-based mahjong social league where players register once and play unlimited games over an 8-week series, climbing their city's leaderboard.",
  url: "https://themahjongopen.com",
  knowsAbout: "Mahjong",
  slogan: "Warm, welcoming, and flexible.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bodoniModa.variable} ${quicksand.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <ConfirmProvider>{children}</ConfirmProvider>
        <Analytics />
      </body>
    </html>
  );
}
