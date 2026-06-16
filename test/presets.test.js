import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsePresets,
  serializePresets,
  upsertPreset,
  deletePreset,
  listPresetNames,
} from '../src/presets.js';

test('parsePresets tolerates corrupt, empty, and non-object JSON, yielding an empty store', () => {
  // A valid store of named form states parses to the same object.
  assert.deepEqual(parsePresets('{"Live":{"event":"x"}}'), { Live: { event: 'x' } });
  // Absent / blank localStorage → empty store, never a throw.
  assert.deepEqual(parsePresets(null), {});
  assert.deepEqual(parsePresets(undefined), {});
  assert.deepEqual(parsePresets(''), {});
  // Corrupt JSON falls back silently (a bricked localStorage entry must not break the page).
  assert.deepEqual(parsePresets('not json{'), {});
  // Valid JSON that isn't a plain object is not a store.
  assert.deepEqual(parsePresets('[1,2,3]'), {});
  assert.deepEqual(parsePresets('"hello"'), {});
  assert.deepEqual(parsePresets('42'), {});
  assert.deepEqual(parsePresets('null'), {});
});

test('serializePresets and parsePresets round-trip a store of named form states', () => {
  const store = {
    'Friday Train': { event: 'trainwreck-lucky-13', mode: 'marquee', tz: 'PT,ET' },
    weekend: { event: 'other-slug', openslots: true },
  };
  assert.deepEqual(parsePresets(serializePresets(store)), store);
  // An empty store round-trips too.
  assert.deepEqual(parsePresets(serializePresets({})), {});
});

test('upsertPreset saves a named Preset without mutating the existing store', () => {
  const store = { existing: { event: 'a' } };
  const next = upsertPreset(store, 'New', { event: 'b' });
  assert.deepEqual(next, { existing: { event: 'a' }, New: { event: 'b' } });
  // Pure: the input store is untouched.
  assert.deepEqual(store, { existing: { event: 'a' } });
  assert.notEqual(next, store);
});

test('upsertPreset overwrites an existing name, trims it, and ignores blank names', () => {
  const store = { Live: { event: 'old' } };
  // Overwrite: same name, new value, key count unchanged.
  assert.deepEqual(upsertPreset(store, 'Live', { event: 'new' }), { Live: { event: 'new' } });
  // Name is trimmed before use as the key.
  assert.deepEqual(upsertPreset({}, '  Live  ', { event: 'x' }), { Live: { event: 'x' } });
  // Blank / whitespace-only names are silent no-ops (store unchanged copy).
  assert.deepEqual(upsertPreset(store, '', { event: 'z' }), { Live: { event: 'old' } });
  assert.deepEqual(upsertPreset(store, '   ', { event: 'z' }), { Live: { event: 'old' } });
});

test('deletePreset removes a Preset by name and no-ops on a missing name', () => {
  const store = { Live: { event: 'a' }, weekend: { event: 'b' } };
  // Remove one, leave the rest intact.
  assert.deepEqual(deletePreset(store, 'Live'), { weekend: { event: 'b' } });
  // Missing name → unchanged copy, no throw.
  assert.deepEqual(deletePreset(store, 'nope'), { Live: { event: 'a' }, weekend: { event: 'b' } });
  // Pure: input untouched.
  assert.deepEqual(store, { Live: { event: 'a' }, weekend: { event: 'b' } });
  assert.notEqual(deletePreset(store, 'Live'), store);
});

test('listPresetNames returns saved names in case-insensitive order', () => {
  const store = { banana: {}, Apple: {}, cherry: {}, Date: {} };
  assert.deepEqual(listPresetNames(store), ['Apple', 'banana', 'cherry', 'Date']);
  assert.deepEqual(listPresetNames({}), []);
});

test('a saved Preset round-trips through storage and restores the full form state', () => {
  // Integration: the page's full save → persist → reload → restore path.
  const formState = {
    event: 'trainwreck-lucky-13', mode: 'pass', interval: '15', speed: '1',
    openslots: true, spotlight: 'DJ Alpha, dj charlie', tz: 'pt,et', height: '20',
  };
  const saved = upsertPreset(parsePresets(null), 'My Event', formState);
  const reloaded = parsePresets(serializePresets(saved));
  assert.deepEqual(reloaded['My Event'], formState);
});
