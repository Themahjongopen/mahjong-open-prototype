// Client-side image compression for profile photo uploads. Runs a
// resize-then-reencode pass entirely in the browser before the file reaches
// Supabase Storage's 3MB `avatars` bucket limit (file_size_limit = 3145728,
// migration 015) — most phone camera photos are well over that, and this is
// what fixes the "photo upload failed" friction at registration without
// asking players to resize their own photos first.
//
// Skips files already comfortably under the limit (no benefit to re-encoding
// a photo that's already small — avoids unnecessary quality loss). Always
// caps the longest edge at MAX_DIMENSION and iterates JPEG quality downward
// if a first pass is still over TARGET_BYTES (defensive backstop for
// unusually detailed source photos).
//
// createImageBitmap(file, { imageOrientation: "from-image" }) is used
// specifically (not a plain `new Image()` + drawImage) because it's the
// approach that reliably respects EXIF orientation across Chrome/Safari/
// Firefox — otherwise portrait phone photos can come out rotated after
// re-encoding.

const MAX_DIMENSION = 1600;
const SKIP_THRESHOLD_BYTES = 900_000; // ~900KB — already small enough, skip re-encoding
const TARGET_BYTES = 2_500_000; // stay comfortably under the 3MB bucket cap
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.5;
const QUALITY_STEP = 0.15;

export async function compressImage(file: File): Promise<File> {
  if (file.size <= SKIP_THRESHOLD_BYTES) return file;
  if (!file.type.startsWith("image/")) return file; // defensive; <input accept=> already restricts this

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Decode failed for some reason — fall back to the original file rather
    // than blocking the upload entirely; the existing 3MB-cap error still
    // applies downstream if it's actually too large.
    return file;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close(); return file; }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = INITIAL_QUALITY;
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP;
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob) return file; // encoding failed — fall back rather than block the upload

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg", lastModified: Date.now() });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
