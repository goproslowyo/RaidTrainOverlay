import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTING_FIELDS,
  SETTING_GROUPS,
  SETTING_KEYS,
  SETTINGS_DEFAULTS,
  applySettings,
  diffSettings,
  fieldGating,
  groupOverrideCount,
  normalizeSettings,
  schemaMatchesStore,
  toQueryValues,
} from '../src/settings-schema.js';
import { buildOverlayQuery } from '../src/configurator.js';
import { PRESET_SETTINGS_FIELDS } from '../src/preset-library.js';

test('the schema describes exactly the fields a Preset stores', () => {
  assert.ok(schemaMatchesStore());
  assert.equal(SETTING_KEYS.length, PRESET_SETTINGS_FIELDS.length);
  // Both editors render from these — a field with no group would never appear.
  const groupIds = new Set(SETTING_GROUPS.map((g) => g.id));
  for (const def of SETTING_FIELDS) assert.ok(groupIds.has(def.group), `${def.key} has no group`);
});

test('the defaults are the Overlay defaults: a default Preset serializes to an empty query', () => {
  assert.equal(buildOverlayQuery(SETTINGS_DEFAULTS), '');
});

test('normalizeSettings fills defaults, drops unknowns, and coerces checkboxes', () => {
  const n = normalizeSettings({ theme: 'lava', openslots: 'true', hidefinished: 'false', bogus: 'x' });
  assert.equal(n.theme, 'lava');
  assert.equal(n.openslots, true);
  assert.equal(n.hidefinished, false, 'the string "false" must not read as checked');
  assert.equal(n.height, '100');
  assert.ok(!('bogus' in n));
  assert.deepEqual(normalizeSettings(null), SETTINGS_DEFAULTS);
  assert.equal(normalizeSettings({ height: 80 }).height, '80', 'numbers become raw strings');
});

test('diffSettings is sparse, and an override to OFF is a present key', () => {
  const base = normalizeSettings({ theme: 'synthwave', openslots: true, height: '90' });
  assert.deepEqual(diffSettings(base, base), {});
  assert.deepEqual(diffSettings(base, { ...base, theme: 'tron' }), { theme: 'tron' });
  // The distinction the editors hang their badges on: overridden-to-false is
  // NOT the same as not-overridden, so it must survive as a present key.
  const off = diffSettings(base, { ...base, openslots: false });
  assert.deepEqual(off, { openslots: false });
  assert.ok(Object.hasOwn(off, 'openslots'));
  // ...and turning it back on again clears the override entirely.
  assert.deepEqual(diffSettings(base, { ...base, openslots: true }), {});
});

test('applySettings ⊕ diffSettings round-trips the effective settings', () => {
  const base = normalizeSettings({ theme: 'wood', scale: '1.4' });
  const values = normalizeSettings({ theme: 'pixel', scale: '1.4', hidefinished: true });
  assert.deepEqual(applySettings(base, diffSettings(base, values)), values);
});

test('groupOverrideCount counts per group, for the "N overridden" tags', () => {
  const overrides = { theme: 'lava', height: '50', speed: '2' };
  assert.equal(groupOverrideCount('look', overrides), 2);
  assert.equal(groupOverrideCount('motion', overrides), 1);
  assert.equal(groupOverrideCount('behavior', overrides), 0);
  assert.equal(groupOverrideCount('look', {}), 0);
});

test('toQueryValues emits checkboxes as 1/0 so an override to OFF is expressible', () => {
  const q = toQueryValues({ openslots: true, hidefinished: false, height: '80' });
  assert.equal(q.openslots, '1');
  assert.equal(q.hidefinished, '0');
  assert.equal(q.height, '80');
});

test('fieldGating mirrors the Configurator’s existing rules', () => {
  const pass = fieldGating({ mode: 'pass', theme: 'classic', track: 'periodic' });
  assert.equal(pass.interval.disabled, false);
  assert.equal(pass.track.disabled, false);
  assert.equal(pass.trackfadein.disabled, false);

  const marquee = fieldGating({ mode: 'marquee', theme: 'classic', track: 'periodic' });
  assert.equal(marquee.interval.disabled, true);
  assert.equal(marquee.track.disabled, true, 'periodic track is a Pass-only behaviour');
  assert.equal(marquee.trackfadeout.disabled, true);

  // Shuffle reuses interval as its per-theme cadence, even in marquee.
  assert.equal(fieldGating({ mode: 'marquee', theme: 'shuffle' }).interval.disabled, false);
  // Fades only bite while the track actually fades.
  assert.equal(fieldGating({ mode: 'pass', track: 'always' }).trackfadein.disabled, true);
});
