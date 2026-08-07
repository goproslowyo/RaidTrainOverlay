import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRESET_SETTINGS_FIELDS,
  parsePresetLibrary, serializePresetLibrary,
  createPreset, renamePreset, updatePresetSettings, duplicatePreset, deletePreset,
  getPreset, listPresets,
} from '../src/preset-library.js';

const genIds = (...ids) => {
  const queue = [...ids];
  return () => queue.shift();
};

const SETTINGS = { theme: 'neon', mode: 'marquee', scale: '1.2' };

test('parsePresetLibrary tolerates absent, corrupt, and non-object JSON', () => {
  assert.deepEqual(parsePresetLibrary(null), {});
  assert.deepEqual(parsePresetLibrary(''), {});
  assert.deepEqual(parsePresetLibrary('{nope'), {});
  assert.deepEqual(parsePresetLibrary('[1,2]'), {});
});

test('createPreset stores a named, settings-only Preset under a generated id', () => {
  const { library, id } = createPreset({}, 'Neon Night', SETTINGS, genIds('id-1'));
  assert.equal(id, 'id-1');
  assert.equal(getPreset(library, 'id-1').name, 'Neon Night');
  assert.equal(getPreset(library, 'id-1').settings.theme, 'neon');
});

test('createPreset strips non-settings fields — Presets are settings-only by construction', () => {
  const dirty = { ...SETTINGS, source: 'raidpal', manual: { djs: [] }, event: 'luna-hao8', spotlight: 'me,friend' };
  const { library, id } = createPreset({}, 'Clean', dirty, genIds('id-1'));
  const kept = Object.keys(getPreset(library, id).settings);
  assert.ok(!kept.includes('source'));
  assert.ok(!kept.includes('manual'));
  assert.ok(!kept.includes('event'));
  assert.ok(!kept.includes('spotlight'));
  assert.ok(kept.includes('theme'));
  assert.ok(PRESET_SETTINGS_FIELDS.includes('tz'));
  assert.ok(!PRESET_SETTINGS_FIELDS.includes('spotlight'));
});

test('createPreset with a blank name is a no-op returning the store unchanged', () => {
  const { library, id } = createPreset({}, '   ', SETTINGS, genIds('id-1'));
  assert.equal(id, null);
  assert.deepEqual(library, {});
});

test('renamePreset changes only the display label; the id and references stay stable', () => {
  const { library } = createPreset({}, 'Old Name', SETTINGS, genIds('id-1'));
  const renamed = renamePreset(library, 'id-1', 'New Name');
  assert.equal(getPreset(renamed, 'id-1').name, 'New Name');
  assert.deepEqual(getPreset(renamed, 'id-1').settings, getPreset(library, 'id-1').settings);
  // Never mutates the input store.
  assert.equal(getPreset(library, 'id-1').name, 'Old Name');
});

test('updatePresetSettings replaces the settings (stripped to settings-only), keeping the name', () => {
  const { library } = createPreset({}, 'Neon Night', SETTINGS, genIds('id-1'));
  const updated = updatePresetSettings(library, 'id-1', { theme: 'lava', event: 'sneaky' });
  assert.equal(getPreset(updated, 'id-1').settings.theme, 'lava');
  assert.equal(getPreset(updated, 'id-1').settings.event, undefined);
  assert.equal(getPreset(updated, 'id-1').name, 'Neon Night');
});

test('duplicatePreset copies settings under a new id with a derived name — the quick dupe+rename flow', () => {
  const { library } = createPreset({}, 'Neon Night', SETTINGS, genIds('id-1'));
  const { library: dup, id } = duplicatePreset(library, 'id-1', genIds('id-2'));
  assert.equal(id, 'id-2');
  assert.equal(getPreset(dup, 'id-2').name, 'Neon Night (copy)');
  assert.deepEqual(getPreset(dup, 'id-2').settings, SETTINGS);
  // Independent copies: the duplicate is not a reference.
  assert.notEqual(getPreset(dup, 'id-2').settings, getPreset(dup, 'id-1').settings);
});

test('duplicatePreset of an unknown id is a no-op', () => {
  const { library, id } = duplicatePreset({}, 'ghost', genIds('id-2'));
  assert.equal(id, null);
  assert.deepEqual(library, {});
});

test('deletePreset removes the entry; unknown id is a silent no-op', () => {
  const { library } = createPreset({}, 'Neon Night', SETTINGS, genIds('id-1'));
  assert.equal(getPreset(deletePreset(library, 'id-1'), 'id-1'), null);
  assert.deepEqual(deletePreset(library, 'ghost'), library);
});

test('listPresets returns { id, name, settings } sorted case-insensitively by name', () => {
  let lib = {};
  ({ library: lib } = createPreset(lib, 'zebra', SETTINGS, genIds('z')));
  ({ library: lib } = createPreset(lib, 'Apple', SETTINGS, genIds('a')));
  ({ library: lib } = createPreset(lib, 'mango', SETTINGS, genIds('m')));
  assert.deepEqual(listPresets(lib).map((p) => p.name), ['Apple', 'mango', 'zebra']);
  assert.deepEqual(listPresets(lib).map((p) => p.id), ['a', 'm', 'z']);
});

test('serialize/parse round-trips the library', () => {
  const { library } = createPreset({}, 'Neon Night', SETTINGS, genIds('id-1'));
  assert.deepEqual(parsePresetLibrary(serializePresetLibrary(library)), library);
});
