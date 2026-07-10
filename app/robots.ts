import type { MetadataRoute } from "next";

// Gated by SITE_INDEXABLE (read at build time, matching the root layout guard).
// Pre-launch: disallow everything, no sitemap. At launch (SITE_INDEXABLE=true):
// allow all + reference the sitemap.
export default function robots(): MetadataRoute.Robots {
  const isIndexable = process.env.SITE_INDEXABLE === "true";

  if (!isIndexable) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://themahjongopen.com/sitemap.xml",
  };
}
