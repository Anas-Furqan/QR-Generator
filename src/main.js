import QRCode from 'qrcode';
import './style.css';

// --- Grab the elements we need from index.html ---
const form = document.getElementById('qr-form');
const input = document.getElementById('url-input');
const errorMsg = document.getElementById('error-msg');
const sizeSelect = document.getElementById('size-select');
const eclSelect = document.getElementById('ecl-select');
const fgColor = document.getElementById('fg-color');
const bgColor = document.getElementById('bg-color');
const result = document.getElementById('result');
const canvas = document.getElementById('qr-canvas');
const encodedText = document.getElementById('encoded-text');
const pngButton = document.getElementById('download-png');
const svgButton = document.getElementById('download-svg');

// The exact text currently encoded in the QR (null until first generate).
let currentText = null;

// Quiet zone: the blank border around the QR, measured in "modules"
// (one module = one small square). The QR spec recommends 4.
const QUIET_ZONE = 4;

// Downloaded PNGs are never smaller than this, so they print sharply.
const MIN_PNG_SIZE = 1024;

/**
 * Turn whatever the user typed into the exact string we will encode.
 * Returns { text } on success or { error } on failure.
 */
function normalizeInput(raw) {
  const value = raw.trim();

  if (!value) {
    return { error: 'Please paste a link first.' };
  }
  if (/\s/.test(value)) {
    return { error: 'Links can’t contain spaces. Please check what you pasted.' };
  }

  // "forms.gle/abc" -> "https://forms.gle/abc". Links that already start
  // with http:// or https:// are left exactly as typed.
  const text = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  // Let the browser's URL parser decide if it's a real URL.
  let url;
  try {
    url = new URL(text);
  } catch {
    return { error: 'That doesn’t look like a valid link. Example: https://forms.gle/abc123' };
  }

  // Require a real-looking host like "example.com" (or localhost).
  const host = url.hostname;
  const looksLikeHost = host === 'localhost' || /^[^.]+(\.[^.]+)+$/.test(host);
  if (!looksLikeHost) {
    return { error: 'That link is missing a domain, like example.com.' };
  }

  // Important: we return `text`, not `url.href`. The URL parser may tweak
  // the link (e.g. add a trailing slash), and we want the QR to contain
  // exactly what the user gave us.
  return { text };
}

/** Collect the current settings into options for the qrcode library. */
function qrOptions(width) {
  return {
    width, // final image size in pixels
    margin: QUIET_ZONE,
    errorCorrectionLevel: eclSelect.value,
    color: {
      dark: fgColor.value, // the squares
      light: bgColor.value, // the background + quiet zone
    },
  };
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.hidden = false;
  input.setAttribute('aria-invalid', 'true');
}

function clearError() {
  errorMsg.hidden = true;
  errorMsg.textContent = '';
  input.removeAttribute('aria-invalid');
}

/**
 * How the QR is generated:
 * The `qrcode` library turns the text into a grid of black/white modules
 * and draws it straight onto our <canvas>. Everything runs in the browser;
 * no request is made to any server.
 */
async function renderQR() {
  if (currentText === null) return;
  try {
    await QRCode.toCanvas(canvas, currentText, qrOptions(Number(sizeSelect.value)));
    encodedText.textContent = currentText;
    result.hidden = false;
  } catch (err) {
    // Happens if the text is too long to fit in a QR code.
    console.error(err);
    showError('Couldn’t create a QR for that link. It may be too long.');
    result.hidden = true;
  }
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
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Free the memory once the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadPNG() {
  if (currentText === null) return;
  // Render a separate, high-resolution copy instead of reusing the on-screen
  // canvas, so the PNG is at least 1024px even if the preview is smaller.
  const width = Math.max(Number(sizeSelect.value), MIN_PNG_SIZE);
  const bigCanvas = document.createElement('canvas');
  await QRCode.toCanvas(bigCanvas, currentText, qrOptions(width));
  bigCanvas.toBlob((blob) => downloadBlob(blob, 'qr-code.png'), 'image/png');
}

async function downloadSVG() {
  if (currentText === null) return;
  // SVG is vector, so it stays sharp at any print size.
  const svg = await QRCode.toString(currentText, {
    ...qrOptions(Number(sizeSelect.value)),
    type: 'svg',
  });
  downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'qr-code.svg');
}

// --- Wire up events ---

// Submitting the form covers both the Generate button and the Enter key.
form.addEventListener('submit', (event) => {
  event.preventDefault();
  clearError();

  const { text, error } = normalizeInput(input.value);
  if (error) {
    showError(error);
    return;
  }

  // Show the user the final link (e.g. with https:// added).
  input.value = text;
  currentText = text;
  renderQR();
});

// Clear a stale error as soon as the user starts fixing their input.
input.addEventListener('input', clearError);

// Re-draw the QR live when any setting changes.
for (const el of [sizeSelect, eclSelect, fgColor, bgColor]) {
  el.addEventListener('input', renderQR);
}

pngButton.addEventListener('click', downloadPNG);
svgButton.addEventListener('click', downloadSVG);
