/**
 * qr-code-styling turns each character into ONE byte (charCode & 255), which
 * garbles Urdu, emoji and accents. So we hand it the UTF-8 bytes instead,
 * one byte per character. Plain ASCII is unchanged; phones read the bytes
 * back as UTF-8, so "سلام 👋" scans as "سلام 👋".
 * (Kept in its own file so it can be unit-tested without a browser.)
 */
export function toUtf8ByteString(text) {
  let out = '';
  for (const byte of new TextEncoder().encode(text)) out += String.fromCharCode(byte);
  return out;
}
