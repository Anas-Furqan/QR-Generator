import QRCodeStyling from 'qr-code-styling';

// How much of the code each level can rebuild if part of it is damaged or covered.
export const ECL_RECOVERY = { L: 0.07, M: 0.15, Q: 0.25, H: 0.3 };

// The preview is drawn as an SVG at this internal size; CSS scales it to fit.
const PREVIEW_SIZE = 600;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/**
 * qr-code-styling sizes the logo with `imageSize`: the share of the
 * error-correction budget the logo may cover. Covered area = imageSize × recovery.
 * We want the logo width to be `logoSize`% of the QR, so its area is
 * (logoSize/100)², which gives imageSize = area / recovery.
 */
function logoImageSize(s) {
  const area = (s.logoSize / 100) ** 2;
  return Math.min(1, area / ECL_RECOVERY[s.ecl]);
}

/**
 * Translate our app state into the options object qr-code-styling expects.
 * `size` is the output size in pixels; `type` is "svg" or "canvas".
 */
export function buildOptions(s, size, type = 'svg') {
  const options = {
    width: size,
    height: size,
    type,
    data: s.data, // encoded exactly as-is, nothing added
    margin: Math.round((size * s.margin) / 100),
    qrOptions: { errorCorrectionLevel: s.ecl },
    dotsOptions: { type: 'square', color: s.fg },
    cornersSquareOptions: { type: 'square', color: s.fg },
    cornersDotOptions: { type: 'square', color: s.fg },
    backgroundOptions: { color: s.bg },
  };

  if (s.logo) {
    options.image = s.logo;
    options.imageOptions = {
      imageSize: logoImageSize(s),
      hideBackgroundDots: true, // remove the dots under the logo instead of drawing over them
      margin: 0,
    };
  }
  return options;
}

/**
 * Draw the live preview into `container`.
 * We create a fresh QRCodeStyling instance each time, which keeps things
 * simple: there's no leftover state from the previous drawing (like an old logo).
 */
export function renderPreview(container, s, { animate = false } = {}) {
  const qr = new QRCodeStyling(buildOptions(s, PREVIEW_SIZE, 'svg'));
  container.replaceChildren();
  qr.append(container);

  // Small fade + scale-in so updates feel smooth (skipped for reduced motion).
  if (animate && !reducedMotion.matches) {
    container.animate(
      [
        { opacity: 0.4, transform: 'scale(0.97)' },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }
}

/**
 * Render the QR at full export size and return it as a Blob (file data in memory).
 * Raster formats are drawn on a canvas; SVG stays vector.
 */
export async function renderBlob(s, extension, size) {
  const type = extension === 'svg' ? 'svg' : 'canvas';
  const qr = new QRCodeStyling(buildOptions(s, size, type));
  return qr.getRawData(extension);
}
