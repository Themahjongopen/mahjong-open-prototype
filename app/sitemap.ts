import type { MetadataRoute } from "next";

const BASE = "https://themahjongopen.com";

// Only the indexable pages. All noindex pages (legal, register results,
// coming-soon, refund-policy, portal, etc.) are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: { path: string; priority: number }[] = [
    { path: "/", priority: 1 },
    { path: "/how-it-works", priority: 0.8 },
    { path: "/shop", priority: 0.7 },
    { path: "/contact", priority: 0.6 },
    { path: "/lead-a-city", priority: 0.8 },
  ];
  return routes.map(({ path, priority }) => ({
    url: `${BASE}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: "monthly",
    priority,
  }));
}
