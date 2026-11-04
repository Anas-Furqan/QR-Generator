import jsQR from 'jsqr';
import { exportBlob } from './export.js';

/*
 * Scan check. A big, perfect PNG is easy to decode, so we also try a
 * "phone-like" version: shrunk to ~150px and slightly blurred, roughly what a
 * camera sees from a distance. Results:
 *   'ok'   both versions decode to exactly the right content
 *   'warn' only the clean version decodes (may be hard on some phones)
 *   'fail' even the clean version doesn't decode
 */
const CLEAN_SIZE = 512;
const DEGRADED_SIZE = 150;

/** Draw the image at the given width on white, return its pixels. */
function pixelsAt(image, width) {
  const height = Math.round((width * image.height) / image.width);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Transparent QRs are checked on white (where they're meant to be used).
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

/**
 * A simple 3×3 box blur: each pixel becomes the average of itself and its
 * 8 neighbours. Written by hand so it behaves the same in every browser.
 */
function boxBlur({ data, width, height }) {
  const src = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
            sum += src[(ny * width + nx) * 4 + c];
            count++;
          }
        }
        data[(y * width + x) * 4 + c] = sum / count;
      }
    }
  }
}

/** Decode and compare byte-for-byte with what we meant to encode. */
function decodesTo({ data, width, height }, expected) {
  // dontInvert: light-on-dark codes fail on many phones, so don't let jsQR "rescue" them.
  const result = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
  if (!result) return false;
  const bytes = result.binaryData;
  return bytes.length === expected.length && bytes.every((b, i) => b === expected[i]);
}

export async function verifyScan(s) {
  // Check the real exported image (frame and label included).
  const blob = await exportBlob(s, 'png', CLEAN_SIZE);
  const image = await createImageBitmap(blob);
  const expected = new TextEncoder().encode(s.data);

  try {
    if (!decodesTo(pixelsAt(image, CLEAN_SIZE), expected)) return 'fail';

    const small = pixelsAt(image, DEGRADED_SIZE);
    boxBlur(small);
    return decodesTo(small, expected) ? 'ok' : 'warn';
  } finally {
    image.close();
  }
}
