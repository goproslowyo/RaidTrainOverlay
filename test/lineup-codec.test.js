import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeLineup, decodeLineup } from '../src/lineup-codec.js';

// A representative manual-lineup model (the domain shape — no version field; the
// codec stamps/validates the wire version internally).
const MODEL = {
  t: 'Saturday Bass Train',
  o: { n: 'djhost' },
  z: 'America/New_York',
  s: '2026-06-27T00:00:00.000Z',
  d: [
    { h: 'nikkid', d: 120 },
    { h: 'basslines', d: 60 },
    { h: 'groovekitty', d: 90 },
  ],
};

test('encodeLineup → decodeLineup round-trips the model exactly', () => {
  const decoded = decodeLineup(encodeLineup(MODEL));
  assert.deepEqual(decoded, MODEL);
});

test('encoded blob is URL-safe (no +, /, =, or chars needing escaping)', () => {
  const blob = encodeLineup(MODEL);
  assert.ok(!/[+/=]/.test(blob), 'no standard-base64 chars');
  assert.equal(blob, encodeURIComponent(blob), 'survives a query value unescaped');
});

test('encode round-trips Unicode handles and titles', () => {
  const m = { t: 'Träin 日本', o: { n: 'dj_é' }, z: 'UTC', s: '2026-01-01T00:00:00.000Z', d: [{ h: 'naïve', d: 60 }] };
  assert.deepEqual(decodeLineup(encodeLineup(m)), m);
});

test('an organiser with no avatar round-trips (optional image omitted)', () => {
  const m = { t: 'X', o: { n: 'me' }, z: 'UTC', s: '2026-01-01T00:00:00.000Z', d: [{ h: 'a', d: 60 }] };
  assert.deepEqual(decodeLineup(encodeLineup(m)), m);
});

test('decodeLineup returns null for garbage rather than throwing', () => {
  for (const bad of ['', '!!!!', 'not base64 at all', 'YWJj', '@@@@', '%%%']) {
    assert.equal(decodeLineup(bad), null, `expected null for ${JSON.stringify(bad)}`);
  }
});

test('decodeLineup rejects a valid blob of the wrong shape', () => {
  const notAModel = encodeLineup; // a function — definitely not a model
  // Hand-encode some structurally-wrong but well-formed payloads:
  const wrong = [
    { v: 1, t: 'x' }, // missing d/s/o
    { v: 1, t: 'x', o: { n: 'a' }, s: '2026-01-01T00:00:00Z', d: 'nope' }, // d not array
    { v: 1, o: { n: 'a' }, s: 'x', d: [] }, // missing title is tolerated? title required
  ];
  for (const w of wrong) {
    const blob = b64urlOf(JSON.stringify(w));
    assert.equal(decodeLineup(blob), null);
  }
  void notAModel;
});

test('decodeLineup rejects an unknown wire version', () => {
  const blob = b64urlOf(JSON.stringify({ v: 99, t: 'x', o: { n: 'a' }, z: 'UTC', s: '2026-01-01T00:00:00.000Z', d: [{ h: 'a', d: 60 }] }));
  assert.equal(decodeLineup(blob), null);
});

test('decodeLineup rejects an oversized blob (URL-length guard)', () => {
  const huge = { t: 'x', o: { n: 'a' }, z: 'UTC', s: '2026-01-01T00:00:00.000Z', d: Array.from({ length: 5000 }, (_, i) => ({ h: `dj${i}`, d: 60 })) };
  assert.equal(decodeLineup(encodeLineup(huge)), null);
});

// Local base64url helper for hand-crafting wire payloads in tests (mirrors the codec's).
function b64urlOf(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

test('decodeLineup strips an organiser avatar URL a crafted link tried to smuggle in', () => {
  // The wire format once accepted `o.i` as any string, and the Overlay painted
  // it into <image href> — so a shared "paste this into OBS" link could make
  // someone else's machine fetch an attacker-chosen URL. Nothing in the product
  // ever wrote the field, so dropping it costs nothing and closes that door.
  const hostile = { ...MODEL, o: { n: 'DJ Someone', i: 'http://198.51.100.7/beacon.png' } };
  const decoded = decodeLineup(encodeLineup(hostile));
  assert.deepEqual(decoded.o, { n: 'DJ Someone' }, 'only the name survives');
  assert.equal('i' in decoded.o, false, 'the URL must not ride through the rest-spread');
});

test('decodeLineup keeps accepting a well-formed organiser after the avatar drop', () => {
  const decoded = decodeLineup(encodeLineup({ ...MODEL, o: { n: 'DJ Someone' } }));
  assert.deepEqual(decoded.o, { n: 'DJ Someone' });
});
