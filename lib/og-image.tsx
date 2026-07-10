import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const OG_ALT = "The Mahjong Open — a city-based mahjong social league";
export const OG_SIZE = { width: 1200, height: 630 };

const FONTS = "node_modules/@fontsource";

// Shared 1200×630 share image: the tile background under a pale-pink --pink-wash
// wash, with the brand wordmark (Bodoni) and tagline (Quicksand). Used by both
// opengraph-image and twitter-image.
export async function renderShareImage() {
  const bodoni = readFileSync(join(process.cwd(), FONTS, "bodoni-moda/files/bodoni-moda-latin-600-normal.woff"));
  const quicksand = readFileSync(join(process.cwd(), FONTS, "quicksand/files/quicksand-latin-500-normal.woff"));
  // Text-free crop of the tile image (no "Bam! Let's Mahjong" script) so it reads
  // as a clean, subtle backdrop behind the wordmark.
  const tiles = readFileSync(join(process.cwd(), "public/coming-soon-bg.jpg")).toString("base64");
  const bg = `data:image/jpeg;base64,${tiles}`;

  return new ImageResponse(
    (
      <div style={{ position: "relative", display: "flex", width: "100%", height: "100%" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={bg} width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} alt="" />
        {/* Stronger --pink-wash so the colorful tiles stay subtle and the text stays legible at thumbnail size.
            (Satori ignores the `inset` shorthand — set explicit dimensions so the wash covers the image.) */}
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
            fontFamily: "Bodoni",
          }}
        >
          <div style={{ display: "flex", fontSize: 30, letterSpacing: 10, color: "#1F3843" }}>THE</div>
          <div style={{ display: "flex", fontSize: 128, lineHeight: 1, color: "#D64466", marginTop: 4 }}>MAHJONG</div>
          <div style={{ display: "flex", fontSize: 34, letterSpacing: 18, color: "#1F3843", marginTop: 2 }}>OPEN</div>
          <div style={{ display: "flex", marginTop: 40, fontFamily: "Quicksand", fontSize: 38, color: "#3A5163" }}>
            A city-based mahjong social league.
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Bodoni", data: bodoni, weight: 600 as const, style: "normal" as const },
        { name: "Quicksand", data: quicksand, weight: 500 as const, style: "normal" as const },
      ],
    }
  );
}
