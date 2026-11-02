/**
 * Images are stored inside the note as base64 data URLs in localStorage, which on a
 * phone allows roughly 5-10 MB for the whole app. A single camera photo is 3-6 MB, so
 * storing it as taken could fill the quota in one go and make the save fail.
 *
 * Photos are therefore scaled down and re-encoded before they are stored. Small files
 * are kept as they are, so screenshots and icons stay sharp and keep transparency.
 */

/** Files at or below this size are stored untouched. */
const KEEP_AS_IS_BYTES = 300 * 1024;
/** Longest side after scaling; plenty for a phone screen, even zoomed in. */
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

const readAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

/**
 * Reads an image file as a data URL, scaled to fit MAX_DIMENSION and encoded as JPEG
 * when that makes it smaller. Falls back to the original file when the browser cannot
 * decode it (e.g. HEIC on some devices), so an attachment is never refused.
 */
export async function readImageForStorage(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  if (file.size <= KEEP_AS_IS_BYTES || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return original;
  }

  try {
    const img = await loadImage(original);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;

    // JPEG has no transparency; paint white first so transparent areas don't turn black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    return compressed.length < original.length ? compressed : original;
  } catch {
    return original;
  }
}
