import sharp from 'sharp';

export type OcrMode = 'auto' | 'printed' | 'handwriting';

// PaddleOCR detection works best when the smaller image dimension is at
// least ~1000px; small phone crops and thumbnails lose accuracy fast.
const MIN_DIMENSION = 1000;
const TARGET_MIN_DIMENSION = 1400;
const MAX_UPSCALE = 3;

/**
 * Normalize an image before OCR:
 * - apply EXIF orientation (phone photos are often stored rotated)
 * - flatten transparency onto white (dark text on transparent PNGs
 *   otherwise renders on black)
 * - upscale small images so the detector can find text lines
 * - for handwriting, boost contrast and sharpen pen strokes
 *
 * Falls back to the original buffer if preprocessing fails, so a corrupt
 * but still-decodable image never blocks the OCR attempt itself.
 */
export async function preprocessForOcr(
  fileBuffer: Buffer,
  mode: OcrMode
): Promise<Buffer> {
  try {
    let image = sharp(fileBuffer).rotate().flatten({ background: '#ffffff' });

    const metadata = await sharp(fileBuffer).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const minDimension = Math.min(width, height);

    if (minDimension > 0 && minDimension < MIN_DIMENSION) {
      const scale = Math.min(TARGET_MIN_DIMENSION / minDimension, MAX_UPSCALE);
      // Square bound + fit:'inside' preserves aspect ratio and stays correct
      // even when the EXIF rotation above swaps width and height.
      const bound = Math.round(Math.max(width, height) * scale);
      image = image.resize({
        width: bound,
        height: bound,
        fit: 'inside',
        kernel: 'lanczos3',
      });
    }

    if (mode === 'handwriting') {
      // Grayscale + full-range contrast stretch makes faint pencil/pen
      // strokes legible to the detector. Deliberately no sharpening — it
      // creates phantom marks that get recognized as stray characters.
      image = image.grayscale().normalize();
    }

    return await image.png().toBuffer();
  } catch (error) {
    console.warn('Image preprocessing failed, using original image:', error);
    return fileBuffer;
  }
}
