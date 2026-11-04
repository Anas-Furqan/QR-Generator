import { renderBlob } from './qr.js';

// Downloaded images are rendered at this size so they print sharply.
export const EXPORT_SIZE = 1024;

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

/** Render the current QR in the given format and save it. Returns the filename. */
export async function downloadQR(s, extension) {
  const blob = await renderBlob(s, extension, EXPORT_SIZE);
  if (!blob) throw new Error('Rendering failed');
  const filename = `qr-code.${extension}`;
  downloadBlob(blob, filename);
  return filename;
}
