export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

// Logos are redrawn onto a square canvas of this size before going into the QR.
const LOGO_CANVAS = 512;

/** Return an error message if the file can't be used, or null if it's fine. */
export function validateLogoFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Please choose a PNG, JPG, SVG or WEBP image.';
  }
  if (file.size > MAX_LOGO_BYTES) {
    return 'That image is over 2 MB. Please choose a smaller one.';
  }
  return null;
}

/**
 * Read the file locally with FileReader and return it as a data URL
 * ("data:image/png;base64,..."). The image never leaves the browser.
 */
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });
}

/**
 * A tiny version of the logo for the "Recent" list (about 1–3 KB).
 * Saving full logos in localStorage could exceed its ~5 MB limit.
 */
export async function makeThumbnail(src, size = 48) {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const w = img.naturalWidth || size;
  const h = img.naturalHeight || size;
  const scale = Math.min(size / w, size / h);
  ctx.drawImage(img, (size - w * scale) / 2, (size - h * scale) / 2, w * scale, h * scale);
  return canvas.toDataURL('image/webp', 0.7);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Prepare the logo for the QR: fit it into a square, and optionally put a
 * white rounded "plate" behind it so it stands out from the dots.
 * Redrawing on a canvas also turns SVGs and huge photos into a small PNG.
 */
export async function composeLogo(src, withPlate) {
  const img = await loadImage(src);
  const size = LOGO_CANVAS;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  let inset = 0;
  if (withPlate) {
    ctx.fillStyle = '#ffffff';
    roundedRect(ctx, 0, 0, size, size, size * 0.18);
    ctx.fill();
    inset = size * 0.14; // breathing room between plate edge and logo
  }

  // "Contain" fit: scale the image to fit the box without stretching it.
  // Some SVGs report 0×0, so fall back to a square.
  const w = img.naturalWidth || size;
  const h = img.naturalHeight || size;
  const box = size - inset * 2;
  const scale = Math.min(box / w, box / h);
  const dw = w * scale;
  const dh = h * scale;
  ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);

  return canvas.toDataURL('image/png');
}
