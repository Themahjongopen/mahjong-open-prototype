import { OG_ALT, OG_SIZE, renderShareImage } from "@/lib/og-image";

export const runtime = "nodejs";
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return renderShareImage();
}
