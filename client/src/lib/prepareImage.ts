const MAX_DIMENSION = 1600;
const QUALITY = 0.82;

export class ImageProcessingError extends Error {}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

// Both paths apply EXIF orientation, so phone photos keep their rotation.
async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Some browsers reject the options bag or the format; try an <img> instead.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * Downscales to at most 1600px on the longest side and re-encodes as WebP
 * (JPEG where the browser can't encode WebP), which also strips EXIF/GPS data.
 * GIFs are returned unchanged so animations survive.
 */
export async function prepareImageForUpload(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new ImageProcessingError("decode failed");
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageProcessingError("no canvas context");
    ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    // Browsers that can't encode WebP silently return PNG instead.
    let blob = await toBlob(canvas, "image/webp");
    if (blob?.type !== "image/webp") {
      // JPEG has no alpha, so flatten transparent areas onto white rather than black.
      const flat = document.createElement("canvas");
      flat.width = canvas.width;
      flat.height = canvas.height;
      const flatCtx = flat.getContext("2d");
      if (!flatCtx) throw new ImageProcessingError("no canvas context");
      flatCtx.fillStyle = "#ffffff";
      flatCtx.fillRect(0, 0, flat.width, flat.height);
      flatCtx.drawImage(canvas, 0, 0);
      blob = await toBlob(flat, "image/jpeg");
    }
    if (!blob) throw new ImageProcessingError("encode failed");

    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const name = `${file.name.replace(/\.[^.]*$/, "") || "image"}.${ext}`;
    return new File([blob], name, { type: blob.type });
  } finally {
    decoded.release();
  }
}
