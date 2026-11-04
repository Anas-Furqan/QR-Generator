/*
 * Contrast check. Phone cameras need a clear difference between the dots and
 * the background. We use the WCAG contrast formula: 1:1 means identical
 * colors, 21:1 is black on white.
 */

// Below this ratio, some phones start to struggle.
const MIN_CONTRAST = 4;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Perceived brightness from 0 (black) to 1 (white), per the WCAG formula. */
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever is easier to read on top of `hex`. */
export function readableTextColor(hex) {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#111111') ? '#ffffff' : '#111111';
}

export function contrastRatio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Check every color drawn on the QR (dots, gradient end, corners) against the
 * background. Returns null when fine, or a message explaining the problem.
 */
export function contrastProblem(s) {
  // A transparent QR usually ends up on white paper or a white page.
  const bg = s.transparent ? '#ffffff' : s.bg;
  const fgColors = [s.fg];
  if (s.gradient) fgColors.push(s.fg2);
  if (s.cornerCustom) fgColors.push(s.cornerColor);

  // Light dots on a dark background ("inverted") confuse many scanner apps.
  if (fgColors.some((c) => luminance(c) > luminance(bg))) {
    return 'The dots are lighter than the background. Many phones can’t scan inverted QR codes, so use dark dots on a light background.';
  }

  const worst = Math.min(...fgColors.map((c) => contrastRatio(c, bg)));
  if (worst < MIN_CONTRAST) {
    return `Contrast is low (${worst.toFixed(1)}:1). Phones may not scan it. Aim for at least ${MIN_CONTRAST}:1 by darkening the dots or lightening the background.`;
  }
  return null;
}
