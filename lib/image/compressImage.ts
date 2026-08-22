// Client-side image compression, run as a resize-then-reencode pass entirely in
// the browser before a file reaches Supabase Storage. Originally built for the
// 3MB `avatars` bucket (migration 015); now parameterized so the scorecard-photo
// path can ask for more resolution and a higher quality floor without a second,
// forkable copy of the constants.
//
// Skips files already comfortably under skipThresholdBytes (no benefit to
// re-encoding a small photo — avoids unnecessary quality loss). Always caps the
// longest edge at maxDimension and iterates JPEG quality downward toward
// minQuality if a first pass is still over targetBytes.
//
// createImageBitmap(file, { imageOrientation: "from-image" }) is used specifically
// (not `new Image()` + drawImage) because it reliably respects EXIF orientation
// across Chrome/Safari/Firefox — otherwise portrait phone photos (avatars AND
// scorecards, which people will shoot in portrait) can come out rotated.

export type CompressOptions = {
  maxDimension: number; // longest-edge cap in px
  skipThresholdBytes: number; // files at or under this are returned untouched
  targetBytes: number; // iterate quality down until under this (or minQuality)
  initialQuality: number;
  minQuality: number; // quality floor — never re-encode below this
  qualityStep: number;
};

// Avatar defaults — the original constants verbatim, so existing callers
// (ProfileEditForm, RegisterModal) that call compressImage(file) with no options
// behave byte-for-byte as before.
export const AVATAR_COMPRESSION: CompressOptions = {
  maxDimension: 1600,
  skipThresholdBytes: 900_000, // ~900KB — already small enough
  targetBytes: 2_500_000, // comfortably under the 3MB avatars cap
  initialQuality: 0.85,
  minQuality: 0.5,
  qualityStep: 0.15,
};

// Scorecard preset — handwritten numbers need more resolution and a higher quality
// floor than faces: a photo that can't distinguish 45 from 90 is worthless. Larger
// target, still under the private `scorecards` bucket's 4MB cap.
export const SCORECARD_COMPRESSION: CompressOptions = {
  maxDimension: 2400,
  skipThresholdBytes: 900_000,
  targetBytes: 3_500_000,
  initialQuality: 0.85,
  minQuality: 0.7,
  qualityStep: 0.1,
};

export async function compressImage(file: File, options?: Partial<CompressOptions>): Promise<File> {
  const opts: CompressOptions = { ...AVATAR_COMPRESSION, ...options };

  if (file.size <= opts.skipThresholdBytes) return file;
  if (!file.type.startsWith("image/")) return file; // defensive; <input accept=> already restricts this

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Decode failed — fall back to the original rather than blocking the upload;
    // the bucket's own size cap still applies downstream if it's actually too large.
    return file;
  }

  const scale = Math.min(1, opts.maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close(); return file; }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = opts.initialQuality;
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > opts.targetBytes && quality > opts.minQuality) {
    quality -= opts.qualityStep;
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob) return file; // encoding failed — fall back rather than block the upload

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
