import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProfiles, serializeProfiles,
  addProfile, removeProfile, setActiveProfile, listProfiles, activeProfile,
  setDefaultPreset, addSpotlight, removeSpotlight,
  upsertTrainConfig, deleteTrainConfig, getTrainConfig, isEmptyTrainConfig,
  resolveTrainSettings, countPresetReferences, materializePreset,
  liveLinkPrefs, setLiveLinkPrefs, isSetupDone, markSetupDone, pruneOrphanedConfigs, restoreTrainConfigs,
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

test('a Config on the Profile default counts as a reference, and is materialized', () => {
  // The trap: resolveTrainSettings reads `config.presetId ?? profile.defaultPresetId`,
  // so a Config with a null reference still RENDERS through the default Preset.
  // Deleting that Preset clears the default in the same pass, so if the bake skips
  // those Configs their look vanishes from stream — the exact thing the delete
  // confirm promises cannot happen.
  const library = libWith('id-1', { theme: 'tron', height: '80' });
  let store = addProfile(EMPTY, 'alpha');
  store = setDefaultPreset(store, 'alpha', 'id-1');
  // Both carry an override so the auto-prune keeps them: a Config pointing at
  // the Profile default with nothing overridden holds nothing and is deleted.
  store = upsertTrainConfig(store, 'alpha', 'explicit', { presetId: 'id-1', overrides: { height: '60' } });
  store = upsertTrainConfig(store, 'alpha', 'inherits', { presetId: null, overrides: { height: '40' } });

  // Both trains render through id-1, so both must be counted.
  assert.deepEqual(countPresetReferences(store, 'id-1'), { configs: 2, defaults: 1 });
  assert.equal(resolveTrainSettings(library, store, 'alpha', 'inherits').settings.theme, 'tron');

  const after = materializePreset(store, library, 'id-1');
  // Nothing changes on stream: the inheriting train keeps tron and its own override.
  const resolved = resolveTrainSettings({}, after, 'alpha', 'inherits');
  assert.equal(resolved.settings.theme, 'tron');
  assert.equal(resolved.settings.height, '40', 'its own override still wins over the baked value');
  assert.equal(after.profiles.alpha.defaultPresetId, null, 'the dangling default is cleared');
  assert.equal(resolveTrainSettings({}, after, 'alpha', 'explicit').settings.theme, 'tron');
});

test('countPresetReferences ignores a Preset no Config reaches', () => {
  const store = upsertTrainConfig(
    setDefaultPreset(addProfile(EMPTY, 'alpha'), 'alpha', 'id-1'), 'alpha', 'x', { presetId: 'id-1' },
  );
  assert.deepEqual(countPresetReferences(store, 'id-other'), { configs: 0, defaults: 0 });
});

// Every Live Link preference, all defaulting to null — "the Overlay's own
// default, omit from the URL".
const DEFAULT_PREFS = {
  upcoming: null, uppos: null, upop: null, upcycle: null, upscroll: null, upstyle: null,
};

test('liveLinkPrefs round-trips the idle-card horizon, and defaults to no card', () => {
  let store = addProfile(EMPTY, 'alpha');
  assert.deepEqual(liveLinkPrefs(store, 'alpha'), DEFAULT_PREFS);
  store = setLiveLinkPrefs(store, 'alpha', { upcoming: '2w' });
  assert.deepEqual(liveLinkPrefs(store, 'ALPHA'), { ...DEFAULT_PREFS, upcoming: '2w' });
  store = setLiveLinkPrefs(store, 'alpha', { upcoming: null });
  assert.equal(liveLinkPrefs(store, 'alpha').upcoming, null);
  // A Profile written before the field existed reads as "no card", never a throw.
  const legacy = { active: 'beta', profiles: { beta: { spotlight: [], defaultPresetId: null, trains: {} } } };
  assert.deepEqual(liveLinkPrefs(legacy, 'beta'), DEFAULT_PREFS);
  assert.deepEqual(liveLinkPrefs(legacy, 'nobody'), DEFAULT_PREFS);
  assert.equal(setLiveLinkPrefs(legacy, 'beta', { upcoming: 'all' }).profiles.beta.liveLink.upcoming, 'all');
});

test('liveLinkPrefs carries the idle-card knobs, merged per-key', () => {
  let store = addProfile(EMPTY, 'alpha');
  store = setLiveLinkPrefs(store, 'alpha', { upcoming: '3', uppos: 'tr', upop: '0.6' });
  store = setLiveLinkPrefs(store, 'alpha', { upstyle: 'ticker', upscroll: '44' });
  assert.deepEqual(liveLinkPrefs(store, 'alpha'), {
    upcoming: '3', uppos: 'tr', upop: '0.6', upcycle: null, upscroll: '44', upstyle: 'ticker',
  });
  // Clearing one knob leaves the others standing.
  store = setLiveLinkPrefs(store, 'alpha', { uppos: null });
  assert.equal(liveLinkPrefs(store, 'alpha').uppos, null);
  assert.equal(liveLinkPrefs(store, 'alpha').upstyle, 'ticker');
});

test('setup flag: unset for new and legacy Profiles, sticky once marked', () => {
  let store = addProfile(EMPTY, 'alpha');
  assert.equal(isSetupDone(store, 'alpha'), false);
  assert.equal(isSetupDone(store, 'nobody'), false);
  store = markSetupDone(store, 'ALPHA');
  assert.equal(isSetupDone(store, 'alpha'), true);
  assert.equal(isSetupDone(store, 'ALPHA'), true);
  // Marking an unknown Profile is a silent no-op, like every other write here.
  assert.deepEqual(markSetupDone(store, 'nobody'), store);
  // A legacy Profile without the field reads as not-set-up (the setup journey shows once).
  const legacy = { active: 'beta', profiles: { beta: { spotlight: [], defaultPresetId: null, trains: {} } } };
  assert.equal(isSetupDone(legacy, 'beta'), false);
  assert.equal(isSetupDone(markSetupDone(legacy, 'beta'), 'beta'), true);
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

// ---- auto-prune + endsAt (#31) ----

test('a Config left holding nothing is DELETED, not stored as an empty record', () => {
  let store = setDefaultPreset(addProfile(EMPTY, 'alpha'), 'alpha', 'id-1');
  store = upsertTrainConfig(store, 'alpha', 'luna-hao8', { presetId: 'id-1', overrides: { theme: 'lava' } });
  assert.ok(getTrainConfig(store, 'alpha', 'luna-hao8'), 'an override is something');

  // "Reset N overrides" — the exact case this exists for. The old behaviour
  // kept the record, which then rode the Live Link's blob carrying its
  // Preset's whole diff against the base.
  store = upsertTrainConfig(store, 'alpha', 'luna-hao8', { presetId: 'id-1', overrides: {} });
  assert.equal(getTrainConfig(store, 'alpha', 'luna-hao8'), null, 'nothing left to keep');
  assert.deepEqual(Object.keys(store.profiles.alpha.trains), []);
});

test('a Config is only empty when it holds none of the three things a streamer chooses', () => {
  let store = setDefaultPreset(addProfile(EMPTY, 'alpha'), 'alpha', 'id-1');
  // A per-train Spotlight is a choice, even with no overrides.
  store = upsertTrainConfig(store, 'alpha', 'spot', { presetId: 'id-1', spotlight: ['Guest'] });
  assert.ok(getTrainConfig(store, 'alpha', 'spot'));
  // So is pinning a train to a Preset that ISN'T the Profile default —
  // including pinning it to no Preset at all, which means built-in defaults.
  store = upsertTrainConfig(store, 'alpha', 'other', { presetId: 'id-2' });
  assert.ok(getTrainConfig(store, 'alpha', 'other'));
  store = upsertTrainConfig(store, 'alpha', 'bare', { presetId: null });
  assert.ok(getTrainConfig(store, 'alpha', 'bare'), 'null ≠ the id-1 default, so it is a choice');

  assert.equal(isEmptyTrainConfig({ presetId: 'id-1', overrides: {}, spotlight: [] }, 'id-1'), true);
  assert.equal(isEmptyTrainConfig({ presetId: null, overrides: {}, spotlight: [] }, null), true);
  assert.equal(isEmptyTrainConfig(null, null), true);
  // endsAt is observed fact, never a choice — a record holding only one is empty.
  assert.equal(isEmptyTrainConfig({ presetId: null, overrides: {}, spotlight: [], endsAt: 123 }, null), true);
});

test('endsAt is stored as epoch ms from a Date, a number or an ISO string; junk reads as null', () => {
  const when = Date.parse('2026-08-10T18:00:00Z');
  let store = addProfile(EMPTY, 'alpha');
  const put = (slug, endsAt) => {
    store = upsertTrainConfig(store, 'alpha', slug, { overrides: { theme: 'lava' }, endsAt });
    return getTrainConfig(store, 'alpha', slug).endsAt;
  };
  assert.equal(put('a', new Date(when)), when);
  assert.equal(put('b', when), when);
  assert.equal(put('c', '2026-08-10T18:00:00Z'), when);
  assert.equal(put('d', 'not a date'), null);
  assert.equal(put('e', undefined), null, 'a writer that never saw the feed records nothing');
});

test('a record written before endsAt existed parses and reads as no evidence', () => {
  const legacy = '{"active":"alpha","profiles":{"alpha":{"spotlight":[],"defaultPresetId":null,'
    + '"trains":{"luna-hao8":{"presetId":null,"overrides":{"theme":"lava"},"spotlight":[]}}}}}';
  const store = parseProfiles(legacy);
  assert.equal(getTrainConfig(store, 'alpha', 'luna-hao8').endsAt, undefined);
  assert.equal(getTrainConfig(store, 'alpha', 'luna-hao8').overrides.theme, 'lava');
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
  // beta's default IS id-1, so this Config needs an override to survive the
  // auto-prune — otherwise it holds nothing and is deleted rather than stored.
  store = upsertTrainConfig(store, 'beta', 'luna-hao8', { presetId: 'id-1', overrides: { theme: 'lava' } });
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

// ── #41: pruning Configs the streamer can no longer reach ────────────────────

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 7, 7, 12);

/** A Profile holding one Config per slug, each with the given endsAt. */
function withTrains(spec) {
  let store = addProfile(EMPTY, 'me');
  for (const [slug, endsAt] of Object.entries(spec)) {
    store = upsertTrainConfig(store, 'me', slug, { overrides: { scale: '120' }, endsAt });
  }
  return store;
}

const prunedSlugs = (result) => result.removed.map((r) => r.slug).sort();

test('prune drops a Config that is absent from the feed AND already over', () => {
  const store = withTrains({ 'gone-and-over': NOW - HOUR });
  const { store: after, removed } = pruneOrphanedConfigs(store, 'me', {
    events: [{ slug: 'still-listed' }], verified: true, now: NOW,
  });
  assert.deepEqual(prunedSlugs({ removed }), ['gone-and-over']);
  assert.equal(getTrainConfig(after, 'me', 'gone-and-over'), null);
});

test('prune keeps a Config still listed in the feed, however old its endsAt', () => {
  const store = withTrains({ 'listed-but-past': NOW - 10 * HOUR });
  const { store: after, removed } = pruneOrphanedConfigs(store, 'me', {
    events: [{ slug: 'listed-but-past' }], verified: true, now: NOW,
  });
  assert.deepEqual(removed, []);
  assert.ok(getTrainConfig(after, 'me', 'listed-but-past'));
});

test('an UPCOMING train that vanished is protected — a rename reads exactly like a delete', () => {
  // RaidPal has no stable event id, so a renamed upcoming train is absent under
  // its old slug. Deleting it would drop settings that are about to be needed.
  const store = withTrains({ 'renamed-upcoming': NOW + 48 * HOUR });
  const { store: after, removed } = pruneOrphanedConfigs(store, 'me', {
    events: [{ slug: 'something-else' }], verified: true, now: NOW,
  });
  assert.deepEqual(removed, []);
  assert.ok(getTrainConfig(after, 'me', 'renamed-upcoming'));
});

test('a Config with no endsAt is protected — undatable means unreasonable-about', () => {
  const store = withTrains({ 'no-end-time': null });
  const { removed } = pruneOrphanedConfigs(store, 'me', {
    events: [{ slug: 'other' }], verified: true, now: NOW,
  });
  assert.deepEqual(removed, []);
});

test('an EMPTY feed prunes nothing, even verified — absent events is not "all gone"', () => {
  // normalizeUser merges `wire.events ?? []`, so a payload arriving without the
  // key is indistinguishable from a streamer with nothing booked.
  const store = withTrains({ 'gone-and-over': NOW - HOUR });
  const { removed } = pruneOrphanedConfigs(store, 'me', { events: [], verified: true, now: NOW });
  assert.deepEqual(removed, []);
});

test('an UNVERIFIED read prunes nothing — a 6h cache hit is not evidence', () => {
  const store = withTrains({ 'gone-and-over': NOW - HOUR });
  const { removed } = pruneOrphanedConfigs(store, 'me', {
    events: [{ slug: 'other' }], verified: false, now: NOW,
  });
  assert.deepEqual(removed, []);
});

test('prune needs a clock, an array, and a known Profile — each missing one is a no-op', () => {
  const store = withTrains({ 'gone-and-over': NOW - HOUR });
  const base = { events: [{ slug: 'other' }], verified: true, now: NOW };
  assert.deepEqual(pruneOrphanedConfigs(store, 'me', { ...base, now: null }).removed, []);
  assert.deepEqual(pruneOrphanedConfigs(store, 'me', { ...base, events: null }).removed, []);
  assert.deepEqual(pruneOrphanedConfigs(store, 'nobody', base).removed, []);
  assert.deepEqual(pruneOrphanedConfigs(store, 'me', {}).removed, []);
});

test('prune leaves the original store untouched and only touches the named Profile', () => {
  let store = withTrains({ 'gone-and-over': NOW - HOUR });
  store = addProfile(store, 'someone-else');
  store = upsertTrainConfig(store, 'someone-else', 'gone-and-over', { overrides: { scale: '90' }, endsAt: NOW - HOUR });
  const { store: after } = pruneOrphanedConfigs(store, 'me', {
    events: [{ slug: 'other' }], verified: true, now: NOW,
  });
  assert.ok(getTrainConfig(store, 'me', 'gone-and-over'), 'input store must not be mutated');
  assert.ok(getTrainConfig(after, 'someone-else', 'gone-and-over'), 'the other Profile is untouched');
});

test('restoreTrainConfigs puts back exactly what the prune removed', () => {
  const store = withTrains({ 'gone-and-over': NOW - HOUR, 'also-over': NOW - 2 * HOUR });
  const before = getTrainConfig(store, 'me', 'gone-and-over');
  const { store: after, removed } = pruneOrphanedConfigs(store, 'me', {
    events: [{ slug: 'other' }], verified: true, now: NOW,
  });
  assert.equal(removed.length, 2);
  const back = restoreTrainConfigs(after, 'me', removed);
  assert.deepEqual(getTrainConfig(back, 'me', 'gone-and-over'), before);
  assert.deepEqual(prunedSlugs({ removed }), ['also-over', 'gone-and-over']);
});

test('restoreTrainConfigs is a no-op for an empty list and skips malformed entries', () => {
  const store = withTrains({ keeper: NOW + HOUR });
  assert.equal(restoreTrainConfigs(store, 'me', []), store);
  assert.equal(restoreTrainConfigs(store, 'me', null), store);
  const back = restoreTrainConfigs(store, 'me', [{ slug: '', config: {} }, { slug: 'x', config: null }]);
  assert.deepEqual(Object.keys(back.profiles.me.trains), ['keeper']);
});
