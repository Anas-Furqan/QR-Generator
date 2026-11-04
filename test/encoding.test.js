import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { toUtf8ByteString } from '../src/encoding.js';

// Turn the "one byte per character" string back into real text, the way a
// phone's scanner reads the QR's bytes as UTF-8.
const decode = (byteString) =>
  new TextDecoder().decode(Uint8Array.from(byteString, (c) => c.charCodeAt(0)));

describe('UTF-8 encoding for the QR library', () => {
  it('leaves plain ASCII unchanged', () => {
    assert.equal(toUtf8ByteString('https://forms.gle/abc123'), 'https://forms.gle/abc123');
  });

  it('produces only byte values (0–255), so the library cannot garble them', () => {
    const out = toUtf8ByteString('سلام 👋 café');
    assert.ok([...out].every((c) => c.charCodeAt(0) <= 255));
  });

  for (const text of ['سلام دنیا', 'پاکستان زندہ باد', '👋🎉', 'café naïve', 'Line 1\nLine 2']) {
    it(`round-trips "${text.replace('\n', '\\n')}"`, () => {
      assert.equal(decode(toUtf8ByteString(text)), text);
    });
  }

  it('uses the right number of bytes (Urdu letters are 2 bytes, emoji 4)', () => {
    assert.equal(toUtf8ByteString('س').length, 2);
    assert.equal(toUtf8ByteString('👋').length, 4);
  });
});
