import { renderBlob } from './qr.js';
import { readableTextColor } from './color.js';

export const FORMATS = {
  png: { label: 'PNG', mime: 'image/png', ext: 'png' },
  svg: { label: 'SVG', mime: 'image/svg+xml', ext: 'svg' },
  jpeg: { label: 'JPEG', mime: 'image/jpeg', ext: 'jpg' },
  webp: { label: 'WEBP', mime: 'image/webp', ext: 'webp' },
};

/* ================= Frame layout =================
 * Every size is a fraction of the total image width, so the frame looks the
 * same at 512px and 2048px. The CSS preview uses the same numbers (cqw units).
 */
const FRAME = {
  pad: 0.045, // border around the QR
  radius: 0.07, // outer corner rounding
  innerRadius: 0.03, // corner rounding of the QR inside the frame
  label: 0.17, // height of the label band under the QR
  font: 0.075, // largest label font size
};

const FONT_FAMILY = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif';

const hasLabel = (s) => s.frameLabel.trim().length > 0;

/** Pixel positions for a framed image of the given width. */
function frameLayout(s, width) {
  const pad = Math.round(width * FRAME.pad);
  const qr = width - pad * 2;
  // No label text = just an even border all around.
  const band = hasLabel(s) ? Math.round(width * FRAME.label) : pad;
  return { width, height: pad + qr + band, pad, qr, band };
}

let measureCtx;
/**
 * Label font size as a fraction of the image width. Long labels shrink so
 * they always fit inside the frame. (Exported so the preview can match.)
 */
export function labelFontRatio(label) {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  measureCtx.font = `700 100px ${FONT_FAMILY}`;
  const widthAt100 = measureCtx.measureText(label.trim()).width || 1;
  const maxWidth = (1 - FRAME.pad * 2) * 0.86; // stay inside the QR's width
  return Math.min(FRAME.font, (100 * maxWidth) / widthAt100);
}

/* ================= Raster: PNG, JPEG, WEBP ================= */

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draw the (optionally framed) QR onto a new canvas. */
async function drawCanvas(s, width, format) {
  const framed = s.frame;
  const box = framed ? frameLayout(s, width) : { width, height: width, pad: 0, qr: width };

  // The QR itself comes from the QR library as a PNG...
  const qrBlob = await renderBlob(s, 'png', box.qr);
  const qrImage = await createImageBitmap(qrBlob);

  // ...and we paint it onto our own canvas, plus the frame and label.
  const canvas = document.createElement('canvas');
  canvas.width = box.width;
  canvas.height = box.height;
  const ctx = canvas.getContext('2d');

  // JPEG has no transparency: transparent pixels would turn black, so start white.
  if (format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, box.width, box.height);
  }

  if (framed) {
    ctx.fillStyle = s.frameColor;
    roundedRect(ctx, 0, 0, box.width, box.height, width * FRAME.radius);
    ctx.fill();

    // Clip the QR to softly rounded corners. A transparent QR gets a white
    // backing here, otherwise the frame color would show through the dots.
    ctx.save();
    roundedRect(ctx, box.pad, box.pad, box.qr, box.qr, width * FRAME.innerRadius);
    ctx.clip();
    if (s.transparent) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(box.pad, box.pad, box.qr, box.qr);
    }
    ctx.drawImage(qrImage, box.pad, box.pad, box.qr, box.qr);
    ctx.restore();

    if (hasLabel(s)) {
      await document.fonts?.load(`700 40px ${FONT_FAMILY}`);
      ctx.fillStyle = readableTextColor(s.frameColor);
      ctx.font = `700 ${width * labelFontRatio(s.frameLabel)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(s.frameLabel.trim(), box.width / 2, box.pad + box.qr + box.band / 2);
    }
  } else {
    ctx.drawImage(qrImage, 0, 0, box.width, box.height);
  }
  qrImage.close();
  return canvas;
}

/* ================= Vector: SVG ================= */

const escapeXml = (s) =>
  s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

/**
 * For SVG we wrap the library's SVG inside our own outer SVG that draws the
 * frame and label as real vector shapes and text, so everything stays sharp.
 */
async function buildSvg(s, width) {
  if (!s.frame) return (await renderBlob(s, 'svg', width)).text();

  const box = frameLayout(s, width);
  const qrSvg = (await (await renderBlob(s, 'svg', box.qr)).text())
    .replace(/<\?xml[^>]*\?>\s*/, '') // drop the XML header; it's only allowed at the very top
    .replace('<svg', `<svg x="${box.pad}" y="${box.pad}"`); // place the QR inside the frame

  const label = hasLabel(s)
    ? `<text x="${box.width / 2}" y="${box.pad + box.qr + box.band / 2}" text-anchor="middle" dominant-baseline="central" font-family="${escapeXml(FONT_FAMILY)}" font-weight="700" font-size="${(width * labelFontRatio(s.frameLabel)).toFixed(1)}" fill="${readableTextColor(s.frameColor)}">${escapeXml(s.frameLabel.trim())}</text>`
    : '';

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}" viewBox="0 0 ${box.width} ${box.height}">`,
    `<defs><clipPath id="qr-frame-clip"><rect x="${box.pad}" y="${box.pad}" width="${box.qr}" height="${box.qr}" rx="${width * FRAME.innerRadius}"/></clipPath></defs>`,
    `<rect width="${box.width}" height="${box.height}" rx="${width * FRAME.radius}" fill="${s.frameColor}"/>`,
    s.transparent ? `<rect x="${box.pad}" y="${box.pad}" width="${box.qr}" height="${box.qr}" rx="${width * FRAME.innerRadius}" fill="#ffffff"/>` : '',
    `<g clip-path="url(#qr-frame-clip)">${qrSvg}</g>`,
    label,
    '</svg>',
  ].join('');
}

/* ================= One entry point for every export ================= */

/**
 * Build the final image file in memory (a Blob) in any format, at any size.
 * Download, Copy, Share and the scan check all use this, so they always
 * produce exactly the same image (frame and label included).
 */
export async function exportBlob(s, format = s.exportFormat, width = s.exportSize) {
  if (format === 'svg') {
    return new Blob([await buildSvg(s, width)], { type: FORMATS.svg.mime });
  }
  const canvas = await drawCanvas(s, width, format);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Rendering failed'))),
      FORMATS[format].mime,
      0.92, // quality for JPEG/WEBP (ignored for PNG)
    ),
  );
}

/**
 * How downloads work:
 * We build the file in memory (a Blob), give it a temporary local URL,
 * and "click" an invisible <a download> link pointing at it. The browser
 * then saves it like any other download. Nothing is uploaded anywhere.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Free the memory once the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Save the QR in the chosen format and size. Returns the filename. */
export async function downloadQR(s) {
  const blob = await exportBlob(s);
  const filename = `qr-code.${FORMATS[s.exportFormat].ext}`;
  downloadBlob(blob, filename);
  return filename;
}

/* ================= Clipboard ================= */

/** True if this browser can put an image (not just text) on the clipboard. */
export function canCopyImage() {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  // Newer browsers can tell us up front whether PNG is allowed.
  return typeof ClipboardItem.supports === 'function' ? ClipboardItem.supports('image/png') : true;
}

/**
 * Copy the QR as a PNG image. We hand the clipboard a *promise* of the image
 * rather than waiting for it first: Safari only allows clipboard writes that
 * start right inside the click.
 */
export async function copyQR(s) {
  const item = new ClipboardItem({ 'image/png': exportBlob(s, 'png') });
  await navigator.clipboard.write([item]);
}

/* ================= Share (mostly phones) ================= */

/** True if this browser can share an actual image file (Web Share API level 2). */
export function canShareFiles() {
  try {
    const probe = new File(['x'], 'qr-code.png', { type: 'image/png' });
    return Boolean(navigator.canShare?.({ files: [probe] }));
  } catch {
    return false;
  }
}

/** Open the phone's share sheet with the QR as a real PNG file. */
export async function shareQR(s) {
  const blob = await exportBlob(s, 'png');
  const file = new File([blob], 'qr-code.png', { type: 'image/png' });
  await navigator.share({ files: [file], title: 'QR code' });
}
