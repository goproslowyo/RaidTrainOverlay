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

// ── The unrunnable-train filter (#31) ──────────────────────────────────────
// Two grounds for dropping a Config from the blob: absent from a GOOD read,
// or a known end time in the past. Both rest on the Overlay resolving against
// the same user endpoint — an entry it can never match is unreachable, so
// dropping it changes nothing on stream. What must stay exact is the failure
// mode: a read that failed or came back stale is not evidence of anything and
// drops nothing at all.

const NOW = Date.parse('2026-08-10T12:00:00Z');
const ended = (event) => ({ ...event, endtime: new Date(NOW - 60_000) });
const feedEvent = (slug, endsAtMs) => ({ slug, endtime: new Date(endsAtMs) });

/** A Profile with one overriding Config per slug, each stamped with an end time. */
function scheduled(entries) {
  const { library, presetId, store } = fixture();
  let s = store;
  for (const [slug, endsAt] of Object.entries(entries)) {
    s = upsertTrainConfig(s, 'gostreamcore', slug, { presetId, overrides: { theme: 'tron' }, endsAt });
  }
  return { library, store: s };
}

test('the filter drops a train known to have ended and keeps the live and lead ones', () => {
  const { library, store } = scheduled({
    'ran-last-week': NOW - 7 * 86_400_000,
    'on-stage-now': NOW + 2 * 3_600_000, // live: started earlier, ends later
    'departs-in-an-hour': NOW + 3 * 3_600_000,
  });
  const map = buildTrainMap(library, store, 'gostreamcore', { now: NOW });
  assert.deepEqual(Object.keys(map).sort(), ['departs-in-an-hour', 'on-stage-now']);
});

test('a train absent from a GOOD read is dropped — ended, deleted or renamed alike', () => {
  const { library, store } = scheduled({ 'renamed-underneath-us': null, 'still-listed': NOW + 86_400_000 });
  // The endpoint returns only upcoming events, and the Overlay resolves
  // against that same endpoint — so a slug it doesn't list can never be
  // selected, whatever the reason. Carrying it is pure weight in the URL.
  const map = buildTrainMap(library, store, 'gostreamcore', {
    now: NOW, events: [feedEvent('still-listed', NOW + 86_400_000)], verified: true,
  });
  assert.deepEqual(Object.keys(map), ['still-listed']);
});

test('absence is read without a clock — the two grounds are independent', () => {
  const { library, store } = scheduled({ 'gone-from-the-feed': null, kept: null });
  const map = buildTrainMap(library, store, 'gostreamcore', {
    events: [feedEvent('kept', NOW)], verified: true,
  });
  assert.deepEqual(Object.keys(map), ['kept']);
});

test('a FAILED read drops nothing — one bad RaidPal day must not blank a Live Link', () => {
  const { library, store } = scheduled({ 'still-upcoming': NOW + 86_400_000, 'no-record-of': null });
  // The guard that matters most now that absence prunes. fetchUserPayload
  // returns null for any unexpected 200 body, and the page passes `null`
  // rather than `[]` for anything that failed or came back stale. Were a bad
  // read ever to arrive here as an empty array instead, EVERY Config would be
  // dropped and the streamer would copy a Live Link carrying nothing.
  const map = buildTrainMap(library, store, 'gostreamcore', { now: NOW, events: null });
  assert.deepEqual(Object.keys(map).sort(), ['no-record-of', 'still-upcoming']);
});

test('the feed outranks the stored end time, so a rescheduled train comes back', () => {
  const { library, store } = scheduled({ 'moved-later': NOW - 3_600_000 }); // stored as ended
  assert.deepEqual(Object.keys(buildTrainMap(library, store, 'gostreamcore', { now: NOW })), [],
    'on the stored evidence alone it is gone');
  const map = buildTrainMap(library, store, 'gostreamcore', {
    now: NOW, events: [feedEvent('moved-later', NOW + 86_400_000)],
  });
  assert.deepEqual(Object.keys(map), ['moved-later'], 'a good read saying otherwise wins');
  // ...and the reverse: the feed can end a train the store thought was upcoming.
  const { library: l2, store: s2 } = scheduled({ 'moved-earlier': NOW + 86_400_000 });
  assert.deepEqual(Object.keys(buildTrainMap(l2, s2, 'gostreamcore', {
    now: NOW, events: [ended(feedEvent('moved-earlier', 0))],
  })), []);
});

// ── Absence needs a VERIFIED read (#39) ────────────────────────────────────
// The two grounds do not need the same evidence. A recorded end time is a fact
// that does not decay; absence is an inference that does — it is only worth
// anything against a feed just checked with RaidPal.

test('a cache-served read cannot prune on absence, however healthy it looks', () => {
  const { library, store } = scheduled({ 'not-in-the-snapshot': null, listed: null });
  // loadMyRaidTrains serves a cache hit inside the 6h window as
  // `{ fromCache: true, fresh: true }` — no error, no stale flag — so the old
  // "ready && !stale && !error" test called it good. Nothing was verified
  // against RaidPal, and one degraded-but-well-formed response caches for six
  // hours. Absence in that snapshot must not blank a train's overrides.
  const map = buildTrainMap(library, store, 'gostreamcore', {
    now: NOW, events: [feedEvent('listed', NOW + 86_400_000)], verified: false,
  });
  assert.deepEqual(Object.keys(map).sort(), ['listed', 'not-in-the-snapshot']);
});

test('an unverified read still ends a train whose recorded end time has passed', () => {
  const { library, store } = scheduled({
    'ended-yesterday': NOW - 86_400_000, 'still-upcoming': NOW + 86_400_000,
  });
  const map = buildTrainMap(library, store, 'gostreamcore', {
    now: NOW, events: [feedEvent('still-upcoming', NOW + 86_400_000)], verified: false,
  });
  assert.deepEqual(Object.keys(map), ['still-upcoming'], 'ground 2 needs no live read');
});

test('verification defaults to OFF — a caller that has not thought about it prunes nothing', () => {
  const { library, store } = scheduled({ 'never-mentioned': null, listed: null });
  const map = buildTrainMap(library, store, 'gostreamcore', {
    now: NOW, events: [feedEvent('listed', NOW + 86_400_000)],
  });
  assert.deepEqual(Object.keys(map).sort(), ['listed', 'never-mentioned'],
    'fail closed: the caller must SAY the read was verified');
});

test('with no clock nothing is filtered — no evidence without a now', () => {
  const { library, store } = scheduled({ 'ran-last-week': NOW - 7 * 86_400_000 });
  assert.deepEqual(Object.keys(buildTrainMap(library, store, 'gostreamcore')), ['ran-last-week']);
});

test('the filter shrinks the blob and the coverage count reports what survived', () => {
  const { library, store } = scheduled({
    past1: NOW - 86_400_000, past2: NOW - 2 * 86_400_000, next1: NOW + 86_400_000,
  });
  const before = buildLiveLink(library, store, 'gostreamcore');
  const after = buildLiveLink(library, store, 'gostreamcore', { now: NOW });
  assert.equal(before.trainCount, 3);
  assert.equal(after.trainCount, 1, 'the panel says "covers 1", not "covers 3"');
  assert.ok(after.blobChars < before.blobChars, `${after.blobChars} < ${before.blobChars}`);
  assert.deepEqual(Object.keys(decodeTrainMap(new URLSearchParams(after.query).get('trains'))), ['next1']);
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
