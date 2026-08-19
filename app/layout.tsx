import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import ConfirmProvider from "@/components/ConfirmProvider";
import "./globals.css";

// Self-hosted from the vendored @fontsource woff2 (copied into ./fonts) rather
// than next/font/google — Google's build-time CDN fetch of Bodoni Moda's static
// instances intermittently 404s and fails the whole production build. Local
// files remove that dependency entirely. Same latin subset + weights/styles as
// before, same CSS-variable names, so globals.css and rendering are unchanged.
const bodoniModa = localFont({
  src: [
    { path: "./fonts/bodoni-moda-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/bodoni-moda-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/bodoni-moda-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/bodoni-moda-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/bodoni-moda-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/bodoni-moda-latin-600-italic.woff2", weight: "600", style: "italic" },
  ],
  variable: "--font-display-loaded",
  display: "swap",
  adjustFontFallback: "Times New Roman", // serif metric match for CLS (Bodoni is a serif)
});

const quicksand = localFont({
  src: [
    { path: "./fonts/quicksand-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/quicksand-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/quicksand-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/quicksand-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body-loaded",
  display: "swap",
  // adjustFontFallback defaults to 'Arial' (sans) — correct for Quicksand.
});

// Search-engine visibility is OFF by default (pre-launch safe default).
// The site stays noindex until SITE_INDEXABLE is explicitly set to "true"
// in the environment (set it in Vercel at launch, then redeploy).
// The link still works for anyone you share it with — noindex only keeps
// the site out of Google/Bing search results.
const isIndexable = process.env.SITE_INDEXABLE === "true";

export const metadata: Metadata = {
  metadataBase: new URL("https://themahjongopen.com"),
  title: "The Mahjong Open — Mahjong Made Social",
  description:
    "Mahjong Made Social. Register once, play unlimited games over an 8-week league, meet new friends, and climb your city's leaderboard. Warm, welcoming, flexible.",
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
  verification: { google: "kN2Y9zGfQ8wL_Ln8Wk-L0j0RX5zm6DfFIlptpWf9uBY" },
  openGraph: {
    title: "The Mahjong Open — Mahjong Made Social",
    description:
      "Mahjong Made Social. Register once, play unlimited games over an 8-week league, meet new friends, and climb your city's leaderboard. Warm, welcoming, flexible.",
    type: "website",
    siteName: "The Mahjong Open",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Mahjong Open — Mahjong Made Social",
    description:
      "Mahjong Made Social. Register once, play unlimited games over an 8-week league, meet new friends, and climb your city's leaderboard. Warm, welcoming, flexible.",
  },
};

// Organization structured data (JSON-LD) — helps Google and AI answer engines
// understand what The Mahjong Open is. City-agnostic (no fixed address yet).
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "The Mahjong Open",
  description:
    "The Mahjong Open is Mahjong Made Social — players register once and play unlimited games over an 8-week league, meeting new friends and climbing their city's leaderboard.",
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
