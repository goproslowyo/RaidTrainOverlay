import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStreamers, serializeStreamers, addStreamers, removeStreamer, listStreamers } from '../src/streamers.js';

test('parseStreamers is tolerant — blank/garbage/non-array → empty list, never throws', () => {
  assert.deepEqual(parseStreamers(''), []);
  assert.deepEqual(parseStreamers(null), []);
  assert.deepEqual(parseStreamers('not json'), []);
  assert.deepEqual(parseStreamers('{"a":1}'), []);          // valid JSON, wrong shape
  assert.deepEqual(parseStreamers('["nikkid", 5, null]'), ['nikkid']); // drops non-strings
  assert.deepEqual(parseStreamers('["a","b"]'), ['a', 'b']);
});

test('serialize → parse round-trips the list', () => {
  const list = ['nikkid', 'GoProFlowYo', 'basslines'];
  assert.deepEqual(parseStreamers(serializeStreamers(list)), list);
});

test('addStreamers puts newest first, dedups case-insensitively, keeps the latest casing', () => {
  let s = [];
  s = addStreamers(s, ['alice']);
  s = addStreamers(s, ['bob']);
  assert.deepEqual(s, ['bob', 'alice']);            // newest first
  s = addStreamers(s, ['ALICE']);                   // re-adding moves to front + updates casing
  assert.deepEqual(s, ['ALICE', 'bob']);
  // Blank/whitespace handles are ignored.
  assert.deepEqual(addStreamers(['x'], ['', '   ', null]), ['x']);
});

test('addStreamers accepts a whole lineup at once, preserving its order at the front', () => {
  const s = addStreamers(['old'], ['first', 'second', 'third']);
  assert.deepEqual(s, ['first', 'second', 'third', 'old']);
});

test('addStreamers caps the stored list, keeping the most recent', () => {
  let s = [];
  for (let i = 0; i < 250; i += 1) s = addStreamers(s, [`dj${i}`]);
  assert.equal(s.length, 200);
  assert.equal(s[0], 'dj249');     // newest kept
  assert.ok(!s.includes('dj0'));   // oldest pruned
});

test('removeStreamer forgets a handle case-insensitively', () => {
  assert.deepEqual(removeStreamer(['Alice', 'bob'], 'alice'), ['bob']);
  assert.deepEqual(removeStreamer(['Alice', 'bob'], 'nope'), ['Alice', 'bob']);
});

test('listStreamers returns the list newest-first without mutating the store', () => {
  const store = ['a', 'b'];
  const out = listStreamers(store);
  out.push('c');
  assert.deepEqual(store, ['a', 'b']); // original untouched
});
