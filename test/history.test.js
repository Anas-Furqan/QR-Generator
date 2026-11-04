import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { addToHistory, loadHistory, clearHistory, MAX_ENTRIES } from '../src/history.js';

// Node has no localStorage, so we provide a tiny in-memory stand-in.
// `quota` lets a test simulate a full storage.
let store;
let quota;
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => {
    if (v.length > quota) throw new Error('QuotaExceededError');
    store[k] = String(v);
  },
  removeItem: (k) => delete store[k],
};

const entry = (overrides = {}) => ({
  type: 'url',
  fields: { url: 'example.com' },
  style: { fg: '#000000' },
  title: 'example.com',
  savedAt: 1,
  ...overrides,
});

describe('Recent QR history', () => {
  beforeEach(() => {
    store = {};
    quota = Infinity;
  });

  it('never stores a WiFi password', () => {
    addToHistory(entry({ type: 'wifi', fields: { ssid: 'HomeNet', security: 'WPA', password: 'SuperSecret#123', hidden: false } }));
    const raw = store['qr-history'];
    assert.ok(raw.includes('HomeNet'));
    assert.ok(!raw.includes('SuperSecret'));
    assert.equal(loadHistory()[0].fields.password, undefined);
  });

  it(`keeps only the last ${MAX_ENTRIES}, newest first`, () => {
    for (let i = 0; i < 8; i++) addToHistory(entry({ fields: { url: `site${i}.com` } }));
    const list = loadHistory();
    assert.equal(list.length, MAX_ENTRIES);
    assert.equal(list[0].fields.url, 'site7.com');
  });

  it('moves a repeated QR to the top instead of duplicating it', () => {
    addToHistory(entry({ fields: { url: 'a.com' } }));
    addToHistory(entry({ fields: { url: 'b.com' } }));
    addToHistory(entry({ fields: { url: 'a.com' } }));
    assert.deepEqual(loadHistory().map((e) => e.fields.url), ['a.com', 'b.com']);
  });

  it('drops thumbnails when storage is full, and reports total failure', () => {
    quota = 400;
    assert.equal(addToHistory(entry({ logoThumb: `data:image/webp;base64,${'A'.repeat(1000)}` })), true);
    assert.ok(!store['qr-history'].includes('data:image'));
    quota = 10;
    assert.equal(addToHistory(entry({ fields: { url: 'c.com' } })), false);
  });

  it('ignores corrupted or hand-edited storage', () => {
    store['qr-history'] = 'not json';
    assert.deepEqual(loadHistory(), []);
    store['qr-history'] = JSON.stringify([{ type: 'evil' }, entry()]);
    assert.equal(loadHistory().length, 1);
  });

  it('clears everything', () => {
    addToHistory(entry());
    clearHistory();
    assert.deepEqual(loadHistory(), []);
  });
});
