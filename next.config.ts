import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The handbook filename is versioned per edition (…-2026-2.pdf) so a new
      // edition gets a fresh URL and the browser/CDN can't serve a stale cached
      // copy. Point the previous edition's path (still live in already-sent
      // registration emails and any bookmarks) at the current file so those links
      // resolve to the latest edition instead of 404-ing. 308 = permanent.
      // Redirects run before /public static files, so this fires even though the
      // old file has been removed.
      {
        source: "/handbook/the-mahjong-open-handbook-2026.pdf",
        destination: "/handbook/the-mahjong-open-handbook-2026-2.pdf",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
