import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The handbook filename is versioned per edition (…-2026-3.pdf) so a new
      // edition gets a fresh URL and the browser/CDN can't serve a stale cached
      // copy. Point every prior edition's path (still live in already-sent
      // registration emails and any bookmarks) at the CURRENT file so those links
      // resolve to the latest edition instead of 404-ing. 308 = permanent. Each
      // old path targets the newest file directly — single hop, no redirect chain.
      // Redirects run before /public static files, so this fires even though the
      // old files have been removed.
      {
        source: "/handbook/the-mahjong-open-handbook-2026.pdf",
        destination: "/handbook/the-mahjong-open-handbook-2026-3.pdf",
        permanent: true,
      },
      {
        source: "/handbook/the-mahjong-open-handbook-2026-2.pdf",
        destination: "/handbook/the-mahjong-open-handbook-2026-3.pdf",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
