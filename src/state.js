/*
 * The app's single source of truth. Every control writes into `state`,
 * and the QR is always redrawn from it. This keeps the UI and the QR in sync.
 */
export const DEFAULTS = Object.freeze({
  data: '', // the exact text encoded in the QR
  ecl: 'M', // error correction level: L, M, Q or H
  fg: '#000000', // dot color
  bg: '#ffffff', // background color
  margin: 8, // quiet zone, as % of the image width

  logoSrc: null, // the original uploaded image (data URL)
  logoName: '',
  logo: null, // the processed logo actually drawn on the QR (data URL)
  logoSize: 20, // logo width, as % of the QR width
  logoPlate: true, // draw a white rounded square behind the logo
});

export const state = { ...DEFAULTS };
