import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseSettings, buildLiveLink, buildLiveLinkQuery, buildTrainMap } from '../src/live-link-url.js';
import { MAX_BLOB_CHARS } from '../src/blob-codec.js';
import { SETTING_KEYS } from '../src/settings-schema.js';
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

// ── The encode-side blob cap (#33) ─────────────────────────────────────────
// MAX_BLOB_CHARS was enforced on decode only, so an oversized blob rode into
// OBS looking fine and reverted EVERY per-train override with no signal
// anywhere. These pin the crossing, not the byte counts: exact sizes move
// whenever a wire key or a default changes, but "20 materialized trains fit
// and 25 do not" is the behaviour the panel warning has to track.

/** Every settings field set away from its default — what materialize-then-delete leaves behind. */
const MATERIALIZED = {
  theme: 'tron', scale: '1.25', height: '90', enginedim: 'under', mode: 'marquee',
  interval: '20', speed: '1.5', track: 'always', trackfadein: '20', trackfadeout: '15',
  refresh: '30', openslots: true, hidefinished: true, tz: 'America/New_York', lang: 'de',
};

/** ~33 chars, the average the live RaidPal user endpoint returns. */
const realisticSlug = (i) => `${String(i).padStart(2, '0')}-super-mega-raid-train-marathon`;

/** A Profile on the Overlay defaults with `count` fully-materialized Configs. */
function materializedProfile(count) {
  let store = addProfile({ active: null, profiles: {} }, 'gostreamcore');
  for (let i = 0; i < count; i += 1) {
    store = upsertTrainConfig(store, 'gostreamcore', realisticSlug(i), {
      presetId: null, overrides: { ...MATERIALIZED }, spotlight: [],
    });
  }
  return store;
}

test('MATERIALIZED covers every settings field — the amplification case is the whole 15', () => {
  assert.equal(realisticSlug(0).length, 33);
  assert.deepEqual(Object.keys(MATERIALIZED).sort(), [...SETTING_KEYS].sort());
});

test('a blob that still fits reports no oversize, and the Overlay can read it back', () => {
  const link = buildLiveLink({}, materializedProfile(20), 'gostreamcore');
  assert.equal(link.trainCount, 20);
  assert.equal(link.oversize, false, '20 materialized trains fit under the cap');
  assert.ok(link.blobChars <= MAX_BLOB_CHARS, `${link.blobChars} <= ${MAX_BLOB_CHARS}`);
  const trains = new URLSearchParams(link.query).get('trains');
  assert.equal(Object.keys(decodeTrainMap(trains)).length, 20, 'round-trips');
});

test('an oversized blob is REPORTED, not silently truncated — the bug #33 fixes', () => {
  const link = buildLiveLink({}, materializedProfile(25), 'gostreamcore');
  assert.equal(link.trainCount, 25);
  assert.equal(link.oversize, true, '25 materialized trains cross the cap');
  assert.ok(link.blobChars > MAX_BLOB_CHARS, `${link.blobChars} > ${MAX_BLOB_CHARS}`);
  assert.equal(link.maxBlobChars, MAX_BLOB_CHARS, 'the panel can name the limit it broke');

  // What the flag is FOR: this URL's per-train settings are already dead.
  const trains = new URLSearchParams(link.query).get('trains');
  assert.equal(decodeTrainMap(trains), null, 'the Overlay cannot read it — hence the warning');
  // And it is handed over whole. Trimming to fit would drop some trains and
  // keep others: the same silent wrong-settings failure, one layer up.
  assert.equal(trains.length, link.blobChars, 'the blob is not truncated to fit');
});

test('buildLiveLinkQuery still returns the bare query, and a no-Live-Link Profile is not oversize', () => {
  const store = materializedProfile(25);
  assert.equal(buildLiveLinkQuery({}, store, 'gostreamcore'), buildLiveLink({}, store, 'gostreamcore').query);
  const none = buildLiveLink({}, store, 'someone-else');
  assert.deepEqual([none.query, none.trainCount, none.blobChars, none.oversize], ['', 0, 0, false]);
});

test('a Config pointing at a DIFFERENT Preset diffs against the base, not against its own', () => {
  const { library, presetId, store } = fixture({ theme: 'synthwave' });
  const second = createPreset(library, 'Marquee', { theme: 'departures', mode: 'marquee' }, ids);
  const s = upsertTrainConfig(store, 'gostreamcore', 'lucky-13', { presetId: second.id });
  const map = buildTrainMap(second.library, s, 'gostreamcore');
  assert.deepEqual(map['lucky-13'].overrides, { theme: 'departures', mode: 'marquee' });
  assert.notEqual(presetId, second.id);
});
