/**
 * Turn whatever the user typed into the exact string we will encode.
 * Returns { text } on success or { error } on failure.
 */
export function normalizeUrl(raw) {
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
