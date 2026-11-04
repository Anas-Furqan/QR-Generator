/*
 * QR content builders. Each QR type turns its form fields into the exact text
 * the QR will contain. Every builder returns one of:
 *   { text }            ready to encode
 *   { error, field }    a message plus the name of the field to highlight
 *   { empty: true }     nothing typed yet (show the empty state, no error)
 */

// Plain text can't be longer than this (in bytes) or the QR gets too dense.
export const MAX_TEXT_BYTES = 1200;

export const byteLength = (s) => new TextEncoder().encode(s).length;

/* ---------------- URL ---------------- */

export function buildUrl({ url = '' }) {
  const value = url.trim();
  if (!value) return { empty: true, error: 'Please paste a link first.', field: 'url' };
  if (/\s/.test(value)) {
    return { error: 'Links can’t contain spaces. Please check what you pasted.', field: 'url' };
  }

  // "forms.gle/abc" -> "https://forms.gle/abc". Links that already start
  // with http:// or https:// are left exactly as typed.
  const text = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  // Let the browser's URL parser decide if it's a real URL.
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    return {
      error: 'That doesn’t look like a valid link. Example: https://forms.gle/abc123',
      field: 'url',
    };
  }

  // Require a real-looking host like "example.com" (or localhost).
  const host = parsed.hostname;
  if (host !== 'localhost' && !/^[^.]+(\.[^.]+)+$/.test(host)) {
    return { error: 'That link is missing a domain, like example.com.', field: 'url' };
  }

  // Return `text`, not `parsed.href`: the parser may tweak the link (e.g. add
  // a trailing slash), and we want the QR to contain exactly what was typed.
  return { text };
}

/* ---------------- Plain text ---------------- */

export function buildText({ text = '' }) {
  if (!text.trim()) return { empty: true, error: 'Please type some text first.', field: 'text' };
  if (byteLength(text) > MAX_TEXT_BYTES) {
    return { error: 'That text is too long for a reliable QR. Please shorten it.', field: 'text' };
  }
  return { text }; // encoded exactly as typed, including line breaks
}

/* ---------------- WiFi ---------------- */

/**
 * In the WIFI: format, the characters \ ; , : and " have special meaning,
 * so a backslash is put in front of each one. Example: my;pass -> my\;pass
 * A single regex pass handles backslashes correctly (no double-escaping).
 */
export const escapeWifi = (s) => s.replace(/([\\;,:"])/g, '\\$1');

/**
 * Replace the password in a WIFI: string with dots, for display only.
 * The password ends at the first ";" that isn't escaped with a backslash.
 */
export const maskWifiPassword = (text) =>
  text.replace(/;P:((?:\\.|[^;\\])*);/, ';P:••••••••;');

/**
 * Standard format understood by iPhone and Android cameras:
 *   WIFI:T:<WPA|WEP|nopass>;S:<network name>;P:<password>;H:true;;
 */
export function buildWifi({ ssid = '', security = 'WPA', password = '', hidden = false }) {
  if (!ssid) return { empty: true, error: 'Please enter the network name.', field: 'ssid' };
  if (byteLength(ssid) > 32) {
    return { error: 'WiFi network names can be at most 32 characters.', field: 'ssid' };
  }

  if (security !== 'nopass') {
    if (!password) return { error: 'Please enter the WiFi password.', field: 'password' };
    if (security === 'WPA' && (password.length < 8 || password.length > 63)) {
      return { error: 'WPA passwords are 8 to 63 characters long.', field: 'password' };
    }
    if (security === 'WEP' && ![5, 10, 13, 26].includes(password.length)) {
      return { error: 'WEP keys are 5 or 13 characters (or 10 or 26 hex digits).', field: 'password' };
    }
  }

  let text = `WIFI:T:${security};S:${escapeWifi(ssid)};`;
  if (security !== 'nopass') text += `P:${escapeWifi(password)};`;
  if (hidden) text += 'H:true;';
  return { text: `${text};` };
}

/* ---------------- WhatsApp ---------------- */

// Removes spaces, dashes, dots and brackets people type in phone numbers.
const stripPhone = (s) => s.trim().replace(/[\s\-().]/g, '');

/** "923001234567" -> "+92 300 1234567" (other countries: "+" + digits). */
export function formatNumber(digits) {
  if (/^923\d{9}$/.test(digits)) return `+92 ${digits.slice(2, 5)} ${digits.slice(5)}`;
  return `+${digits}`;
}

/**
 * wa.me needs the full international number as digits only: no "+", no
 * spaces, no leading 0. Pakistani local numbers (03xx...) become 923xx...
 */
export function normalizeWhatsApp(raw) {
  let n = stripPhone(raw);
  if (!n) return { empty: true };

  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2); // 00 is the dial-out prefix for "+"
  else if (/^03\d{9}$/.test(n)) n = `92${n.slice(1)}`; // 0300 1234567 -> 92 300 1234567

  // "+92 0300..." (country code plus the local 0) -> drop the extra 0.
  if (/^920\d{10}$/.test(n)) n = `92${n.slice(3)}`;

  if (!/^\d+$/.test(n)) return { error: 'Phone numbers can only contain digits.' };
  if (n.startsWith('0')) return { error: 'Add the country code, e.g. 92 for Pakistan.' };
  if (n.startsWith('923') && n.length !== 12) {
    return { error: 'Pakistani mobile numbers look like 0300 1234567 or +92 300 1234567.' };
  }
  if (n.length < 8 || n.length > 15) {
    return { error: 'That number looks too short or too long. Include the country code.' };
  }
  return { digits: n, display: formatNumber(n) };
}

export function buildWhatsApp({ phone = '', message = '' }) {
  const number = normalizeWhatsApp(phone);
  if (number.empty) {
    return { empty: true, error: 'Please enter a WhatsApp number.', field: 'phone' };
  }
  if (number.error) return { error: number.error, field: 'phone' };

  let text = `https://wa.me/${number.digits}`;
  // encodeURIComponent turns spaces, Urdu letters and emoji into %XX codes,
  // so the message survives inside a link.
  if (message.trim()) text += `?text=${encodeURIComponent(message)}`;
  return { text };
}

/* ---------------- Email ---------------- */

export function buildEmail({ to = '', subject = '', body = '' }) {
  const address = to.trim();
  if (!address) return { empty: true, error: 'Please enter an email address.', field: 'to' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    return { error: 'That doesn’t look like an email address.', field: 'to' };
  }

  // mailto: links use %20 for spaces and %0D%0A for line breaks.
  const params = [];
  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body.replace(/\r?\n/g, '\r\n'))}`);
  return { text: `mailto:${address}${params.length ? `?${params.join('&')}` : ''}` };
}

/* ---------------- Phone ---------------- */

/** Keep a leading "+" (international format); "00" also becomes "+". */
export function normalizePhone(raw) {
  let n = stripPhone(raw);
  if (!n) return { empty: true };
  if (n.startsWith('00')) n = `+${n.slice(2)}`;
  if (!/^\+?\d{3,15}$/.test(n)) {
    return { error: 'Use digits only, optionally starting with + and the country code.' };
  }
  const display = n.startsWith('+') ? formatNumber(n.slice(1)) : n;
  return { number: n, display };
}

export function buildPhone({ phone = '' }) {
  const number = normalizePhone(phone);
  if (number.empty) return { empty: true, error: 'Please enter a phone number.', field: 'phone' };
  if (number.error) return { error: number.error, field: 'phone' };
  return { text: `tel:${number.number}` };
}

/* ---------------- Dispatcher ---------------- */

export const BUILDERS = {
  url: buildUrl,
  text: buildText,
  wifi: buildWifi,
  whatsapp: buildWhatsApp,
  email: buildEmail,
  phone: buildPhone,
};
