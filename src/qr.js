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

/*
 * Each corner "eye" has two parts: the outer square ring and the inner dot.
 * Our three simple choices map to a matching pair of library shapes.
 */
export const CORNER_STYLES = {
  square: { square: 'square', dot: 'square' },
  rounded: { square: 'extra-rounded', dot: 'dot' },
  dot: { square: 'dot', dot: 'dot' },
};

/** The dot fill: either one solid color or a two-color gradient. */
function dotPaint(s) {
  if (!s.gradient) return { color: s.fg };
  return {
    gradient: {
      type: s.gradientType,
      rotation: Math.PI / 4, // 45° diagonal for linear gradients
      colorStops: [
        { offset: 0, color: s.fg },
        { offset: 1, color: s.fg2 },
      ],
    },
  };
}

/**
 * Translate our app state into the options object qr-code-styling expects.
 * `size` is the output size in pixels; `type` is "svg" or "canvas".
 */
export function buildOptions(s, size, type = 'svg') {
  const corners = CORNER_STYLES[s.cornerType];
  // Corners use their own color if chosen, otherwise the same paint as the dots.
  const cornerPaint = s.cornerCustom ? { color: s.cornerColor } : dotPaint(s);

  const options = {
    width: size,
    height: size,
    type,
    data: s.data, // encoded exactly as-is, nothing added
    margin: Math.round((size * s.margin) / 100),
    qrOptions: { errorCorrectionLevel: s.ecl },
    dotsOptions: { type: s.dotType, ...dotPaint(s) },
    cornersSquareOptions: { type: corners.square, ...cornerPaint },
    cornersDotOptions: { type: corners.dot, ...cornerPaint },
    backgroundOptions: { color: s.transparent ? 'transparent' : s.bg },
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
 * Draw a tiny sample QR used as a style swatch (the Style section's picker).
 * Using the real library means each swatch shows exactly what you'll get.
 */
export function renderSwatch(container, { dotType = 'square', cornerType = 'square' }) {
  const corners = CORNER_STYLES[cornerType];
  const qr = new QRCodeStyling({
    width: 150,
    height: 150,
    type: 'svg',
    data: 'Static QR swatch',
    margin: 0,
    qrOptions: { errorCorrectionLevel: 'L' },
    dotsOptions: { type: dotType, color: '#17161b' },
    cornersSquareOptions: { type: corners.square, color: '#17161b' },
    cornersDotOptions: { type: corners.dot, color: '#17161b' },
    backgroundOptions: { color: '#ffffff' },
  });
  qr.append(container);
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
