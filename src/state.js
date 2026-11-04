/*
 * The app's single source of truth. Every control writes into `state`,
 * and the QR is always redrawn from it. This keeps the UI and the QR in sync.
 */
export const DEFAULTS = Object.freeze({
  data: '', // the exact text encoded in the QR
  ecl: 'M', // error correction level: L, M, Q or H

  // Shapes
  dotType: 'square', // square | rounded | dots | classy | extra-rounded
  cornerType: 'square', // square | rounded | dot (the three big "eyes")
  margin: 8, // quiet zone, as % of the image width

  // Colors
  fg: '#000000', // dot color (or first gradient color)
  gradient: false,
  gradientType: 'linear', // linear | radial
  fg2: '#5b3df5', // second gradient color
  bg: '#ffffff',
  transparent: false,
  cornerCustom: false, // false = corners use the dot color
  cornerColor: '#5b3df5',

  // Logo
  logoSrc: null, // the original uploaded image (data URL)
  logoName: '',
  logo: null, // the processed logo actually drawn on the QR (data URL)
  logoSize: 20, // logo width, as % of the QR width
  logoPlate: true, // draw a white rounded square behind the logo
});

// The settings that "Reset style" puts back (content and logo are kept).
export const STYLE_KEYS = [
  'dotType',
  'cornerType',
  'margin',
  'fg',
  'gradient',
  'gradientType',
  'fg2',
  'bg',
  'transparent',
  'cornerCustom',
  'cornerColor',
];

export const state = { ...DEFAULTS };
