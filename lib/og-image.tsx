import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const OG_ALT = "The Mahjong Open — a city-based mahjong social league";
export const OG_SIZE = { width: 1200, height: 630 };

const FONTS = "node_modules/@fontsource";

// Shared 1200×630 share image: the tile background under a pale-pink --pink-wash
// wash, with the primary logo mark (raster PNG — Satori needs a bitmap, not the
// SVG) and the tagline in Quicksand. Used by both opengraph-image and twitter-image.
export async function renderShareImage() {
  const quicksand = readFileSync(join(process.cwd(), FONTS, "quicksand/files/quicksand-latin-500-normal.woff"));
  const tiles = readFileSync(join(process.cwd(), "public/coming-soon-bg.jpg")).toString("base64");
  // Transparent PNG of the brand mark (already generated from mark-primary.svg).
  const mark = readFileSync(join(process.cwd(), "app/icon.png")).toString("base64");
  const bg = `data:image/jpeg;base64,${tiles}`;
  const markSrc = `data:image/png;base64,${mark}`;

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        {/* --pink-wash so the colorful tiles stay subtle behind the mark + text. */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(253, 239, 243, 0.84)" }} />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markSrc} width={300} height={300} style={{ width: 300, height: 300 }} alt="" />
          <div style={{ display: "flex", marginTop: 20, fontFamily: "Quicksand", fontSize: 40, color: "#3A5163" }}>
            A city-based mahjong social league.
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Quicksand", data: quicksand, weight: 500 as const, style: "normal" as const }],
    }
  );
}
