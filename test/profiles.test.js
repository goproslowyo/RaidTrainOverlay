import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProfiles, serializeProfiles,
  addProfile, removeProfile, setActiveProfile, listProfiles, activeProfile,
  setDefaultPreset, addSpotlight, removeSpotlight,
  upsertTrainConfig, deleteTrainConfig, getTrainConfig,
  resolveTrainSettings, countPresetReferences, materializePreset,
  liveLinkPrefs, setLiveLinkPrefs,
} from '../src/profiles.js';
import { createPreset } from '../src/preset-library.js';

const EMPTY = { active: null, profiles: {} };

function libWith(id, settings, name = 'Preset') {
  return createPreset({}, name, settings, () => id).library;
}

test('parseProfiles tolerates absent, corrupt, and non-object JSON', () => {
  assert.deepEqual(parseProfiles(null), EMPTY);
  assert.deepEqual(parseProfiles(''), EMPTY);
  assert.deepEqual(parseProfiles('{nope'), EMPTY);
  assert.deepEqual(parseProfiles('42'), EMPTY);
});

test('addProfile normalizes the login to lowercase and activates the first Profile added', () => {
  const store = addProfile(EMPTY, 'GoProFlowYo');
  assert.deepEqual(listProfiles(store), ['goproflowyo']);
  assert.equal(activeProfile(store), 'goproflowyo');
});

test('addProfile of an existing or blank login is a no-op; later adds do not steal active', () => {
  let store = addProfile(EMPTY, 'alpha');
  store = addProfile(store, 'Alpha');
  store = addProfile(store, '  ');
  store = addProfile(store, 'beta');
  assert.deepEqual(listProfiles(store), ['alpha', 'beta']);
  assert.equal(activeProfile(store), 'alpha');
});

test('setActiveProfile switches; unknown login is a silent no-op', () => {
  let store = addProfile(addProfile(EMPTY, 'alpha'), 'beta');
  store = setActiveProfile(store, 'beta');
  assert.equal(activeProfile(store), 'beta');
  assert.equal(activeProfile(setActiveProfile(store, 'ghost')), 'beta');
});

test('removeProfile drops the Profile and re-points active at the first remaining (or null)', () => {
  let store = addProfile(addProfile(EMPTY, 'alpha'), 'beta');
  store = removeProfile(store, 'alpha');
  assert.deepEqual(listProfiles(store), ['beta']);
  assert.equal(activeProfile(store), 'beta');
  store = removeProfile(store, 'beta');
  assert.equal(activeProfile(store), null);
});

test('setDefaultPreset stores the Profile default Preset reference (null clears it)', () => {
  let store = addProfile(EMPTY, 'alpha');
  store = setDefaultPreset(store, 'alpha', 'id-1');
  assert.equal(store.profiles.alpha.defaultPresetId, 'id-1');
  store = setDefaultPreset(store, 'alpha', null);
  assert.equal(store.profiles.alpha.defaultPresetId, null);
});

test('liveLinkPrefs round-trips the idle-card horizon, and defaults to no card', () => {
  let store = addProfile(EMPTY, 'alpha');
  assert.deepEqual(liveLinkPrefs(store, 'alpha'), { upcoming: null });
  store = setLiveLinkPrefs(store, 'alpha', { upcoming: '2w' });
  assert.deepEqual(liveLinkPrefs(store, 'ALPHA'), { upcoming: '2w' });
  store = setLiveLinkPrefs(store, 'alpha', { upcoming: null });
  assert.equal(liveLinkPrefs(store, 'alpha').upcoming, null);
  // A Profile written before the field existed reads as "no card", never a throw.
  const legacy = { active: 'beta', profiles: { beta: { spotlight: [], defaultPresetId: null, trains: {} } } };
  assert.deepEqual(liveLinkPrefs(legacy, 'beta'), { upcoming: null });
  assert.deepEqual(liveLinkPrefs(legacy, 'nobody'), { upcoming: null });
  assert.equal(setLiveLinkPrefs(legacy, 'beta', { upcoming: 'all' }).profiles.beta.liveLink.upcoming, 'all');
});

test('addSpotlight builds the standing promote list, deduped case-insensitively; removeSpotlight drops', () => {
  let store = addProfile(EMPTY, 'alpha');
  store = addSpotlight(store, 'alpha', 'DJFriend');
  store = addSpotlight(store, 'alpha', 'djfriend');
  store = addSpotlight(store, 'alpha', 'TeamMate');
  assert.deepEqual(store.profiles.alpha.spotlight, ['DJFriend', 'TeamMate']);
  store = removeSpotlight(store, 'alpha', 'DJFRIEND');
  assert.deepEqual(store.profiles.alpha.spotlight, ['TeamMate']);
});

test('upsertTrainConfig stores { presetId, overrides, spotlight } per Event slug; delete removes it', () => {
  let store = addProfile(EMPTY, 'alpha');
  store = upsertTrainConfig(store, 'alpha', 'luna-hao8', { presetId: 'id-1', overrides: { theme: 'lava' }, spotlight: ['Guest'] });
  const cfg = getTrainConfig(store, 'alpha', 'luna-hao8');
  assert.equal(cfg.presetId, 'id-1');
  assert.deepEqual(cfg.overrides, { theme: 'lava' });
  assert.deepEqual(cfg.spotlight, ['Guest']);
  assert.equal(getTrainConfig(deleteTrainConfig(store, 'alpha', 'luna-hao8'), 'alpha', 'luna-hao8'), null);
});

test('upsertTrainConfig keeps overrides sparse: only settings-only fields survive', () => {
  let store = addProfile(EMPTY, 'alpha');
  store = upsertTrainConfig(store, 'alpha', 'luna-hao8', { presetId: null, overrides: { theme: 'lava', event: 'sneaky', source: 'manual' } });
  assert.deepEqual(getTrainConfig(store, 'alpha', 'luna-hao8').overrides, { theme: 'lava' });
});

// ---- resolution ----

test('resolveTrainSettings: preset ⊕ overrides, spotlight = standing ∪ additions', () => {
  const library = libWith('id-1', { theme: 'neon', mode: 'pass', scale: '1' });
  let store = addProfile(EMPTY, 'alpha');
  store = addSpotlight(store, 'alpha', 'Standing');
  store = upsertTrainConfig(store, 'alpha', 'luna-hao8', { presetId: 'id-1', overrides: { theme: 'lava' }, spotlight: ['Guest'] });
  const r = resolveTrainSettings(library, store, 'alpha', 'luna-hao8');
  assert.equal(r.settings.theme, 'lava'); // overridden
  assert.equal(r.settings.mode, 'pass'); // flows from the Preset
  assert.deepEqual(r.spotlight, ['Standing', 'Guest']);
});

test('resolveTrainSettings falls back to the Profile default Preset for an unmapped train', () => {
  const library = libWith('id-1', { theme: 'neon', mode: 'marquee' });
  let store = addProfile(EMPTY, 'alpha');
  store = setDefaultPreset(store, 'alpha', 'id-1');
  const r = resolveTrainSettings(library, store, 'alpha', 'unmapped-slug');
  assert.equal(r.settings.theme, 'neon');
  assert.equal(r.settings.mode, 'marquee');
});

test('resolveTrainSettings fails soft to empty settings when nothing is referenced or known', () => {
  const r = resolveTrainSettings({}, addProfile(EMPTY, 'alpha'), 'alpha', 'unmapped');
  assert.deepEqual(r.settings, {});
  assert.deepEqual(r.spotlight, []);
});

// ---- delete-while-referenced ----

test('countPresetReferences counts referencing Raid Train Configs and Profile defaults across ALL Profiles', () => {
  let store = addProfile(addProfile(EMPTY, 'alpha'), 'beta');
  store = setDefaultPreset(store, 'beta', 'id-1');
  store = upsertTrainConfig(store, 'alpha', 'luna-hao8', { presetId: 'id-1', overrides: {} });
  store = upsertTrainConfig(store, 'alpha', 'other-train', { presetId: 'id-2', overrides: {} });
  store = upsertTrainConfig(store, 'beta', 'luna-hao8', { presetId: 'id-1', overrides: {} });
  assert.deepEqual(countPresetReferences(store, 'id-1'), { configs: 2, defaults: 1 });
});

test('materializePreset bakes effective settings into every referencing Config and clears default refs', () => {
  const library = libWith('id-1', { theme: 'neon', mode: 'marquee' });
  let store = addProfile(addProfile(EMPTY, 'alpha'), 'beta');
  store = setDefaultPreset(store, 'beta', 'id-1');
  store = upsertTrainConfig(store, 'alpha', 'luna-hao8', { presetId: 'id-1', overrides: { theme: 'lava' } });
  const after = materializePreset(store, library, 'id-1');
  const cfg = getTrainConfig(after, 'alpha', 'luna-hao8');
  // The Config now carries the full effective settings as overrides, no reference.
  assert.equal(cfg.presetId, null);
  assert.equal(cfg.overrides.theme, 'lava');
  assert.equal(cfg.overrides.mode, 'marquee');
  assert.equal(after.profiles.beta.defaultPresetId, null);
  // Configs referencing other presets are untouched.
  const untouched = upsertTrainConfig(store, 'alpha', 'x', { presetId: 'id-2', overrides: {} });
  assert.equal(getTrainConfig(materializePreset(untouched, library, 'id-1'), 'alpha', 'x').presetId, 'id-2');
});

test('serialize/parse round-trips the Profiles store', () => {
  let store = addProfile(EMPTY, 'alpha');
  store = upsertTrainConfig(store, 'alpha', 'luna-hao8', { presetId: 'id-1', overrides: { theme: 'lava' } });
  assert.deepEqual(parseProfiles(serializeProfiles(store)), store);
});
