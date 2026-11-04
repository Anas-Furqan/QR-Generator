// Unit tests for the QR text builders. Run with: npm test
// Uses Node's built-in test runner, so no extra packages are needed.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUrl,
  buildText,
  buildWifi,
  buildWhatsApp,
  buildEmail,
  buildPhone,
  escapeWifi,
  maskWifiPassword,
  normalizeWhatsApp,
  densityProblem,
  MAX_TEXT_BYTES,
} from '../src/content.js';

// String.raw keeps backslashes literal, so `\;` below really is backslash + semicolon.
const raw = String.raw;

describe('URL', () => {
  it('adds https:// when missing', () => {
    assert.equal(buildUrl({ url: 'forms.gle/abc' }).text, 'https://forms.gle/abc');
  });
  it('keeps the link exactly as typed (no trailing slash added)', () => {
    assert.equal(buildUrl({ url: 'https://example.com' }).text, 'https://example.com');
  });
  it('keeps non-English characters', () => {
    assert.equal(buildUrl({ url: 'ur.wikipedia.org/wiki/پاکستان' }).text, 'https://ur.wikipedia.org/wiki/پاکستان');
  });
  it('rejects spaces and missing domains', () => {
    assert.equal(buildUrl({ url: 'not a link' }).field, 'url');
    assert.equal(buildUrl({ url: 'abc' }).field, 'url');
  });
  it('treats blank input as empty, not an error', () => {
    assert.equal(buildUrl({ url: '   ' }).empty, true);
  });
});

describe('Plain text', () => {
  it('encodes text exactly, including spaces and line breaks', () => {
    assert.equal(buildText({ text: ' a\nb ' }).text, ' a\nb ');
  });
  it('enforces the byte limit', () => {
    assert.equal(buildText({ text: 'x'.repeat(MAX_TEXT_BYTES) }).text.length, MAX_TEXT_BYTES);
    assert.equal(buildText({ text: 'x'.repeat(MAX_TEXT_BYTES + 1) }).field, 'text');
  });
});

describe('WiFi', () => {
  it('escapes \\ ; , : and " with a backslash', () => {
    assert.equal(escapeWifi(raw`a\b;c,d:e"f`), raw`a\\b\;c\,d\:e\"f`);
  });
  it('builds the standard WIFI: string with special characters', () => {
    const { text } = buildWifi({ ssid: 'Cafe;Net', security: 'WPA', password: raw`p;a,s:s"w\rd!` });
    assert.equal(text, raw`WIFI:T:WPA;S:Cafe\;Net;P:p\;a\,s\:s\"w\\rd!;;`);
  });
  it('adds H:true for hidden networks', () => {
    const { text } = buildWifi({ ssid: 'Home', security: 'WPA', password: '12345678', hidden: true });
    assert.equal(text, 'WIFI:T:WPA;S:Home;P:12345678;H:true;;');
  });
  it('leaves out the password for open networks', () => {
    assert.equal(buildWifi({ ssid: 'Guest', security: 'nopass', password: 'x' }).text, 'WIFI:T:nopass;S:Guest;;');
  });
  it('validates WPA and WEP password lengths', () => {
    assert.equal(buildWifi({ ssid: 'x', security: 'WPA', password: 'short' }).field, 'password');
    assert.equal(buildWifi({ ssid: 'x', security: 'WEP', password: 'abcd' }).field, 'password');
    assert.ok(buildWifi({ ssid: 'x', security: 'WEP', password: 'abcde' }).text);
  });
  it('masks the password for display, even with escaped semicolons inside', () => {
    const { text } = buildWifi({ ssid: 'Cafe;Net', security: 'WPA', password: raw`p;a,s:s"w\rd!`, hidden: true });
    assert.equal(maskWifiPassword(text), raw`WIFI:T:WPA;S:Cafe\;Net;P:••••••••;H:true;;`);
  });
});

describe('WhatsApp', () => {
  const cases = [
    ['0300 1234567', '923001234567'],
    ['0300-1234567', '923001234567'],
    ['+92 300 1234567', '923001234567'],
    ['923001234567', '923001234567'],
    ['0092 300 1234567', '923001234567'],
    ['+92 0300 1234567', '923001234567'],
    ['(0321) 555-0000', '923215550000'],
    ['+44 7911 123456', '447911123456'],
  ];
  for (const [input, expected] of cases) {
    it(`normalizes "${input}" to ${expected}`, () => {
      assert.equal(normalizeWhatsApp(input).digits, expected);
    });
  }
  it('formats Pakistani numbers for display', () => {
    assert.equal(normalizeWhatsApp('03001234567').display, '+92 300 1234567');
  });
  it('rejects bad numbers', () => {
    assert.ok(normalizeWhatsApp('0300123').error); // too short
    assert.ok(normalizeWhatsApp('0123456789').error); // local number, no country code
    assert.ok(normalizeWhatsApp('03OO1234567').error); // letter O instead of zero
  });
  it('URL-encodes Urdu and emoji messages, which decode back exactly', () => {
    const message = 'سلام! آپ کیسے ہیں؟ 👋 & more?';
    const { text } = buildWhatsApp({ phone: '0300 1234567', message });
    assert.equal(text, `https://wa.me/923001234567?text=${encodeURIComponent(message)}`);
    assert.equal(decodeURIComponent(text.split('text=')[1]), message);
  });
  it('omits ?text= when there is no message', () => {
    assert.equal(buildWhatsApp({ phone: '03001234567', message: '  ' }).text, 'https://wa.me/923001234567');
  });
});

describe('Email', () => {
  it('URL-encodes subject and body, with CRLF line breaks', () => {
    const { text } = buildEmail({ to: 'me@x.com', subject: 'Hi & bye?', body: 'L1\nL2' });
    assert.equal(text, 'mailto:me@x.com?subject=Hi%20%26%20bye%3F&body=L1%0D%0AL2');
  });
  it('works with just an address', () => {
    assert.equal(buildEmail({ to: 'me@x.com' }).text, 'mailto:me@x.com');
  });
  it('rejects invalid addresses', () => {
    assert.equal(buildEmail({ to: 'nope' }).field, 'to');
  });
});

describe('Phone', () => {
  it('keeps the + for international format', () => {
    assert.equal(buildPhone({ phone: '+92 300 123-4567' }).text, 'tel:+923001234567');
  });
  it('turns a leading 00 into +', () => {
    assert.equal(buildPhone({ phone: '0044 20 7946 0000' }).text, 'tel:+442079460000');
  });
  it('keeps local numbers as typed (digits only)', () => {
    assert.equal(buildPhone({ phone: '0300 1234567' }).text, 'tel:03001234567');
  });
  it('rejects letters', () => {
    assert.ok(buildPhone({ phone: '12ab' }).error);
  });
});

describe('Density warning', () => {
  it('is silent up to 300 bytes', () => {
    assert.equal(densityProblem(300, false), null);
  });
  it('is mild above 300, strong above 600', () => {
    assert.equal(densityProblem(301, false).level, 'mild');
    assert.equal(densityProblem(601, false).level, 'strong');
  });
  it('is always strong with a logo', () => {
    assert.equal(densityProblem(301, true).level, 'strong');
    assert.match(densityProblem(601, true).message, /logo/);
  });
});
