import { getItem, setItem, removeItem } from './storage.js';

/*
 * "Recent QRs": the last few configurations, kept in localStorage on this
 * device only. Privacy and size rules:
 *   - WiFi passwords are NEVER saved (the password field is removed).
 *   - The encoded text itself isn't saved (for WiFi it contains the password).
 *   - Logos are saved only as a tiny thumbnail for the list, never full size.
 */
const KEY = 'qr-history';
export const MAX_ENTRIES = 5;
const TYPES = ['url', 'text', 'wifi', 'whatsapp', 'email', 'phone'];

/** Remove anything that must never be stored. */
function sanitizeFields(type, fields) {
  const clean = { ...fields };
  if (type === 'wifi') delete clean.password;
  return clean;
}

/** Two entries are "the same QR" when their type, fields and style match. */
const fingerprint = (e) => JSON.stringify([e.type, e.fields, e.style]);

export function loadHistory() {
  try {
    const list = JSON.parse(getItem(KEY, '[]'));
    if (!Array.isArray(list)) return [];
    // Storage can be edited by hand, so only keep entries that look right.
    return list.filter(
      (e) => e && TYPES.includes(e.type) && typeof e.fields === 'object' && typeof e.style === 'object',
    );
  } catch {
    return [];
  }
}

function write(list) {
  return setItem(KEY, JSON.stringify(list));
}

/**
 * Add an entry to the top of the list (moving it up if it already exists).
 * If storage is full we retry without thumbnails, then with fewer entries.
 * Returns true if it was saved.
 */
export function addToHistory(entry) {
  const item = { ...entry, fields: sanitizeFields(entry.type, entry.fields) };
  const others = loadHistory().filter((e) => fingerprint(e) !== fingerprint(item));
  const list = [item, ...others].slice(0, MAX_ENTRIES);

  if (write(list)) return true;
  // Probably over the storage quota: drop the thumbnails and try again.
  const noThumbs = list.map(({ logoThumb, ...rest }) => rest);
  if (write(noThumbs)) return true;
  return write(noThumbs.slice(0, 1));
}

export function clearHistory() {
  removeItem(KEY);
}
