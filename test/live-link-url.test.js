import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseSettings, buildLiveLinkQuery, buildTrainMap } from '../src/live-link-url.js';
import { createPreset } from '../src/preset-library.js';
import { addProfile, addSpotlight, setDefaultPreset, setLiveLinkPrefs, upsertTrainConfig } from '../src/profiles.js';
import { decodeTrainMap, effectiveQuery } from '../src/live-link.js';
import { parseConfig } from '../src/config.js';
import { SETTINGS_DEFAULTS } from '../src/settings-schema.js';

let n = 0;
const ids = () => `id-${++n}`;

/** A Profile with one Preset as its default, ready for the per-train cases. */
function fixture(presetSettings = { theme: 'synthwave', height: '90' }) {
  const created = createPreset({}, 'House', presetSettings, ids);
  let store = addProfile({ active: null, profiles: {} }, 'GoStreamCore');
  store = setDefaultPreset(store, 'gostreamcore', created.id);
  return { library: created.library, presetId: created.id, store };
}

test('baseSettings is the default Preset, and the Overlay defaults when there is none', () => {
  const { library, store } = fixture();
  assert.equal(baseSettings(library, store, 'gostreamcore').theme, 'synthwave');
  assert.equal(baseSettings(library, store, 'gostreamcore').height, '90');
  // Case-insensitive, like every other Profile lookup.
  assert.equal(baseSettings(library, store, 'GoStreamCore').theme, 'synthwave');
  // A Profile with no default Preset falls all the way back to the defaults.
  const bare = addProfile({ active: null, profiles: {} }, 'nobody');
  assert.deepEqual(baseSettings({}, bare, 'nobody'), SETTINGS_DEFAULTS);
});

test('a Config that matches the base contributes nothing to the blob', () => {
  const { library, presetId, store } = fixture();
  // Same Preset, no overrides, no extra Spotlights — the copy-once path.
  const s = upsertTrainConfig(store, 'gostreamcore', 'lucky-13', { presetId, overrides: {}, spotlight: [] });
  assert.deepEqual(buildTrainMap(library, s, 'gostreamcore'), {});
  const query = buildLiveLinkQuery(library, s, 'gostreamcore');
  assert.ok(!new URLSearchParams(query).has('trains'), 'no blob when nothing diverges');
});

test('only diverging Configs enter the blob, as raw query values', () => {
  const { library, presetId, store } = fixture();
  let s = upsertTrainConfig(store, 'gostreamcore', 'lucky-13', { presetId, overrides: { theme: 'tron' } });
  s = upsertTrainConfig(s, 'gostreamcore', 'plain-train', { presetId, overrides: {} });
  const map = buildTrainMap(library, s, 'gostreamcore');
  assert.deepEqual(Object.keys(map), ['lucky-13']);
  assert.deepEqual(map['lucky-13'].overrides, { theme: 'tron' });
});

test('an override to OFF survives as an explicit 0, not an absent param', () => {
  const { library, presetId, store } = fixture({ theme: 'classic', openslots: true });
  const s = upsertTrainConfig(store, 'gostreamcore', 'lucky-13', { presetId, overrides: { openslots: false } });
  const map = buildTrainMap(library, s, 'gostreamcore');
  assert.deepEqual(map['lucky-13'].overrides, { openslots: '0' });
  // ...and it really turns the setting off once the Overlay merges it.
  const query = buildLiveLinkQuery(library, s, 'gostreamcore');
  assert.equal(parseConfig(query).openslots, true, 'base has open slots on');
  assert.equal(parseConfig(effectiveQuery(query, map['lucky-13'])).openslots, false);
});

test('per-train Spotlights ride as additions only, deduped against the standing list', () => {
  const { library, presetId, store } = fixture();
  let s = addSpotlight(store, 'gostreamcore', 'DJ_Nova');
  s = upsertTrainConfig(s, 'gostreamcore', 'lucky-13', { presetId, spotlight: ['dj_nova', 'Guest_Kai'] });
  const map = buildTrainMap(library, s, 'gostreamcore');
  assert.deepEqual(map['lucky-13'].spotlight, ['Guest_Kai'], 'the standing name is not restated');

  const query = buildLiveLinkQuery(library, s, 'gostreamcore');
  assert.equal(new URLSearchParams(query).get('spotlight'), 'dj_nova');
  assert.deepEqual(parseConfig(effectiveQuery(query, map['lucky-13'])).spotlight, ['dj_nova', 'guest_kai']);
});

test('the query carries user, the base settings, the blob and the idle horizon', () => {
  const { library, presetId, store } = fixture();
  let s = setLiveLinkPrefs(store, 'gostreamcore', { upcoming: '2w' });
  s = upsertTrainConfig(s, 'gostreamcore', 'lucky-13', { presetId, overrides: { theme: 'tron' } });
  const config = parseConfig(buildLiveLinkQuery(library, s, 'gostreamcore'));
  assert.equal(config.user, 'gostreamcore');
  assert.equal(config.theme, 'synthwave');
  assert.equal(config.height, 90);
  assert.deepEqual(config.upcoming, { kind: 'weeks', n: 2 });
  assert.equal(config.event, null, 'a Live Link is never pinned to one Event');
  // The blob the Overlay decodes must be the map we encoded.
  assert.deepEqual(decodeTrainMap(config.trains)['lucky-13'].overrides, { theme: 'tron' });
});

test('no idle preference means no upcoming param — the card stays off', () => {
  const { library, store } = fixture();
  assert.ok(!new URLSearchParams(buildLiveLinkQuery(library, store, 'gostreamcore')).has('upcoming'));
});

test('an unknown or blank login has no Live Link', () => {
  const { library, store } = fixture();
  assert.equal(buildLiveLinkQuery(library, store, 'someone-else'), '');
  assert.equal(buildLiveLinkQuery(library, store, ''), '');
  assert.deepEqual(buildTrainMap(library, store, 'someone-else'), {});
});

test('a Config pointing at a DIFFERENT Preset diffs against the base, not against its own', () => {
  const { library, presetId, store } = fixture({ theme: 'synthwave' });
  const second = createPreset(library, 'Marquee', { theme: 'departures', mode: 'marquee' }, ids);
  const s = upsertTrainConfig(store, 'gostreamcore', 'lucky-13', { presetId: second.id });
  const map = buildTrainMap(second.library, s, 'gostreamcore');
  assert.deepEqual(map['lucky-13'].overrides, { theme: 'departures', mode: 'marquee' });
  assert.notEqual(presetId, second.id);
});
