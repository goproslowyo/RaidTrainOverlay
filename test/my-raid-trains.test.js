import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FRESH_MS, userCacheKey, eventCacheKey,
  loadMyRaidTrains, loadEventDetails, refreshEventDetail,
} from '../src/my-raid-trains.js';
import { makeUserPayload } from './fixtures/user-payload.js';
import { makeEventPayload } from './fixtures/event-payload.js';

const HOUR = 60 * 60_000;
const NOW = Date.parse('2026-08-06T20:00:00Z');

/** A minimal Storage-like backed by a Map — the injected localStorage fake. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    get map() {
      return map;
    },
  };
}

/** A fetchImpl serving the RaidPal REST routes from a url → responder table, recording hits. */
function routedFetch(routes, log = []) {
  return async (url) => {
    log.push(url);
    const respond = routes[url];
    if (!respond) throw new Error(`network down: ${url}`);
    return respond();
  };
}

const userUrl = (login) => `https://api.raidpal.com/rest/user/${login}`;
const eventUrl = (slug) => `https://api.raidpal.com/rest/event/${slug}`;
const okJson = (payload) => () => ({ ok: true, status: 200, text: async () => JSON.stringify(payload), json: async () => payload });
const cacheEntry = (payload, savedAt) => JSON.stringify({ payload, savedAt });
/** Retry deps that make the backoff waits instant and deterministic in tests. */
const noWait = { sleep: async () => {}, rand: () => 0.5 };

// ---- cache namespace ----

test('cache keys live in their own Configurator-side namespace, per identity', () => {
  assert.equal(userCacheKey('GoProFlowYo'), 'raidtrainoverlay.myraidtrains.v1.user.goproflowyo');
  assert.equal(eventCacheKey('luna-hao8'), 'raidtrainoverlay.myraidtrains.v1.event.luna-hao8');
});

test('the default freshness window is ~6 hours', () => {
  assert.equal(FRESH_MS, 6 * HOUR);
});

// ---- loadMyRaidTrains ----

test('loadMyRaidTrains serves a fresh cache without touching the network', async () => {
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload(), NOW - HOUR),
  });
  const log = [];
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: routedFetch({}, log), storage, clock: () => NOW,
  });
  assert.equal(log.length, 0);
  assert.equal(r.fromCache, true);
  assert.equal(r.fresh, true);
  assert.equal(r.user.displayName, 'GoProFlowYo');
});

test('a cache hit reports NOTHING wrong — which is why the Live Link cannot trust it (#39)', async () => {
  // The premise the whole #39 fix rests on, pinned at the seam where it lives.
  // A six-hour-old snapshot comes back indistinguishable from a live read on
  // every field the Configurator used to check: no `error`, no stale marker,
  // and `fresh: true` — a claim about the CACHE being in date, not about the
  // data having been re-verified. `fromCache` is the only thing that gives it
  // away, so absence in this feed must never prune a train's overrides.
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload(), NOW - HOUR),
  });
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: routedFetch({}), storage, clock: () => NOW,
  });
  assert.equal(r.error, undefined, 'nothing signals a problem…');
  assert.equal(r.notFound, undefined, '…and nothing signals an empty profile…');
  assert.equal(r.fresh, true, '…and it even calls itself fresh');
  assert.equal(r.fromCache, true, 'only fromCache distinguishes it from a verified read');
});

test('loadMyRaidTrains fetches when the cache is stale, and re-caches at the injected clock', async () => {
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload({ display_name: 'Old' }), NOW - 7 * HOUR),
  });
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: routedFetch({ [userUrl('goproflowyo')]: okJson(makeUserPayload()) }),
    storage,
    clock: () => NOW,
  });
  assert.equal(r.fromCache, false);
  assert.equal(r.user.displayName, 'GoProFlowYo');
  const entry = JSON.parse(storage.getItem(userCacheKey('goproflowyo')));
  assert.equal(entry.savedAt, NOW);
});

test('loadMyRaidTrains with force fetches even when the cache is fresh — the manual refresh', async () => {
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload({ display_name: 'Old' }), NOW),
  });
  const log = [];
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: routedFetch({ [userUrl('goproflowyo')]: okJson(makeUserPayload()) }, log),
    storage,
    clock: () => NOW,
    force: true,
  });
  assert.equal(log.length, 1);
  assert.equal(r.user.displayName, 'GoProFlowYo');
});

test('loadMyRaidTrains falls back to the stale cache on a live failure — the list never blanks', async () => {
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload(), NOW - 30 * HOUR),
  });
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: routedFetch({}), storage, clock: () => NOW, ...noWait,
  });
  assert.equal(r.fromCache, true);
  assert.ok(r.error);
  assert.equal(r.user.events.length, 3);
});

test('loadMyRaidTrains rethrows a live failure when there is no cache to fall back on', async () => {
  await assert.rejects(
    loadMyRaidTrains('goproflowyo', { fetchImpl: routedFetch({}), storage: fakeStorage(), clock: () => NOW, ...noWait }),
    /network down/,
  );
});

test('loadMyRaidTrains reports an unknown login as notFound, leaving any cache intact', async () => {
  // A 204 is a definitive answer, not a failure — but the undocumented API
  // earns no trust: the last-good cache entry is kept, and the UI decides.
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload(), NOW - 30 * HOUR),
  });
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: routedFetch({ [userUrl('goproflowyo')]: () => ({ ok: true, status: 204, text: async () => '' }) }),
    storage,
    clock: () => NOW,
  });
  assert.equal(r.notFound, true);
  assert.equal(r.user, null);
  assert.ok(storage.getItem(userCacheKey('goproflowyo')));
});

test('loadMyRaidTrains treats a corrupt cache entry as missing', async () => {
  const storage = fakeStorage({ [userCacheKey('goproflowyo')]: '{not json' });
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: routedFetch({ [userUrl('goproflowyo')]: okJson(makeUserPayload()) }),
    storage,
    clock: () => NOW,
  });
  assert.equal(r.fromCache, false);
  assert.equal(r.user.displayName, 'GoProFlowYo');
});

// ---- loadEventDetails ----

const SUMMARIES = [{ slug: 'luna-hao8' }, { slug: 'trainwreck-lucky-13' }, { slug: 'my-own-train' }];

test('loadEventDetails fetches Events one at a time, in order, pausing between network fetches', async () => {
  const log = [];
  const pauses = [];
  const results = await loadEventDetails(SUMMARIES, {
    fetchImpl: routedFetch({
      [eventUrl('luna-hao8')]: okJson(makeEventPayload({ title: 'LUNA' })),
      [eventUrl('trainwreck-lucky-13')]: okJson(makeEventPayload()),
      [eventUrl('my-own-train')]: okJson(makeEventPayload({ title: 'My Own Train' })),
    }, log),
    storage: fakeStorage(),
    clock: () => NOW,
    pauseMs: 500,
    sleep: async (ms) => pauses.push(ms),
  });
  assert.deepEqual(log, [eventUrl('luna-hao8'), eventUrl('trainwreck-lucky-13'), eventUrl('my-own-train')]);
  // A pause between consecutive fetches — never before the first.
  assert.deepEqual(pauses, [500, 500]);
  assert.equal(results.length, 3);
  assert.equal(results[0].event.title, 'LUNA');
  assert.equal(results[0].slug, 'luna-hao8');
  assert.equal(results[0].fromCache, false);
});

test('loadEventDetails serves fresh-cached Events from cache — no fetch, no pause for them', async () => {
  const storage = fakeStorage({
    [eventCacheKey('luna-hao8')]: cacheEntry(makeEventPayload({ title: 'LUNA' }), NOW - HOUR),
    [eventCacheKey('my-own-train')]: cacheEntry(makeEventPayload({ title: 'My Own Train' }), NOW - HOUR),
  });
  const log = [];
  const pauses = [];
  const results = await loadEventDetails(SUMMARIES, {
    fetchImpl: routedFetch({ [eventUrl('trainwreck-lucky-13')]: okJson(makeEventPayload()) }, log),
    storage,
    clock: () => NOW,
    sleep: async (ms) => pauses.push(ms),
  });
  assert.deepEqual(log, [eventUrl('trainwreck-lucky-13')]);
  assert.deepEqual(pauses, []);
  assert.equal(results[0].fromCache, true);
  assert.equal(results[0].fresh, true);
  assert.equal(results[1].fromCache, false);
});

test('loadEventDetails isolates a failing Event: stale fallback + error, the rest still load', async () => {
  const storage = fakeStorage({
    [eventCacheKey('trainwreck-lucky-13')]: cacheEntry(makeEventPayload(), NOW - 30 * HOUR),
  });
  const results = await loadEventDetails(SUMMARIES, {
    fetchImpl: routedFetch({
      [eventUrl('luna-hao8')]: okJson(makeEventPayload({ title: 'LUNA' })),
      [eventUrl('my-own-train')]: okJson(makeEventPayload({ title: 'My Own Train' })),
    }),
    storage,
    clock: () => NOW,
    sleep: async () => {},
  });
  assert.equal(results[0].event.title, 'LUNA');
  // trainwreck's live fetch failed → stale cache + error, never a throw.
  assert.ok(results[1].error);
  assert.equal(results[1].fromCache, true);
  assert.ok(results[1].event);
  assert.equal(results[2].event.title, 'My Own Train');
});

test('loadEventDetails yields event: null (with the error) for a failing, never-cached Event', async () => {
  const results = await loadEventDetails([{ slug: 'luna-hao8' }], {
    fetchImpl: routedFetch({}),
    storage: fakeStorage(),
    clock: () => NOW,
    sleep: async () => {},
  });
  assert.equal(results[0].event, null);
  assert.ok(results[0].error);
});

// ---- refreshEventDetail ----

test('refreshEventDetail force-fetches one Event and rewrites its cache — the per-Event refresh', async () => {
  const storage = fakeStorage({
    [eventCacheKey('luna-hao8')]: cacheEntry(makeEventPayload({ title: 'Old LUNA' }), NOW),
  });
  const log = [];
  const r = await refreshEventDetail('luna-hao8', {
    fetchImpl: routedFetch({ [eventUrl('luna-hao8')]: okJson(makeEventPayload({ title: 'LUNA' })) }, log),
    storage,
    clock: () => NOW,
  });
  assert.equal(log.length, 1);
  assert.equal(r.event.title, 'LUNA');
  const entry = JSON.parse(storage.getItem(eventCacheKey('luna-hao8')));
  assert.equal(entry.payload.event.title, 'LUNA');
});

test('refreshEventDetail fails soft: stale fallback + error when the live fetch fails', async () => {
  const storage = fakeStorage({
    [eventCacheKey('luna-hao8')]: cacheEntry(makeEventPayload({ title: 'LUNA' }), NOW - 30 * HOUR),
  });
  const r = await refreshEventDetail('luna-hao8', {
    fetchImpl: routedFetch({}), storage, clock: () => NOW, ...noWait,
  });
  assert.equal(r.fromCache, true);
  assert.equal(r.event.title, 'LUNA');
  assert.ok(r.error);
});

// ---- retries (#47) ----

/**
 * A fetchImpl that fails the first `failures` calls with a network error, then
 * serves `routes`. The flaky RaidPal response this whole ticket is about.
 */
function flakyFetch(failures, routes, log = []) {
  let seen = 0;
  return async (url) => {
    log.push(url);
    seen += 1;
    if (seen <= failures) throw new Error(`network down: ${url}`);
    const respond = routes[url];
    if (!respond) throw new Error(`network down: ${url}`);
    return respond();
  };
}

test('loadMyRaidTrains retries a flaky read and comes back VERIFIED, not cached', async () => {
  // The point of #47. Before it, one bad response left `fromCache: true` with
  // an error, which goodFeedEvents() rejects — so the Live Link stopped pruning
  // (#39) and the store stopped cleaning up (#41) until the streamer noticed.
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload(), NOW - 30 * HOUR),
  });
  const log = [];
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: flakyFetch(2, { [userUrl('goproflowyo')]: okJson(makeUserPayload()) }, log),
    storage, clock: () => NOW, ...noWait,
  });
  assert.equal(log.length, 3); // two failures, then the good one
  assert.equal(r.fromCache, false); // ← a verified read
  assert.equal(r.error, undefined);
  assert.equal(r.user.displayName, 'GoProFlowYo');
  // And it re-cached, at the injected clock.
  assert.equal(JSON.parse(storage.getItem(userCacheKey('goproflowyo'))).savedAt, NOW);
});

test('loadMyRaidTrains stops at the attempt ceiling — a real outage must not hang the Configurator', async () => {
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload(), NOW - 30 * HOUR),
  });
  const log = [];
  const r = await loadMyRaidTrains('goproflowyo', {
    fetchImpl: routedFetch({}, log), storage, clock: () => NOW, ...noWait,
  });
  assert.equal(log.length, 3); // RETRY_ATTEMPTS, then give up to the cache
  assert.equal(r.fromCache, true);
  assert.ok(r.error);
});

test('loadMyRaidTrains does not retry a 204 — RaidPal answered', async () => {
  const log = [];
  const r = await loadMyRaidTrains('nosuchuser', {
    fetchImpl: routedFetch({ [userUrl('nosuchuser')]: () => ({ ok: true, status: 204, text: async () => '' }) }, log),
    storage: fakeStorage(), clock: () => NOW, ...noWait,
  });
  assert.equal(log.length, 1);
  assert.equal(r.notFound, true);
});

test('loadMyRaidTrains never reaches the network on a fresh cache, retries or not', async () => {
  const storage = fakeStorage({
    [userCacheKey('goproflowyo')]: cacheEntry(makeUserPayload(), NOW - HOUR),
  });
  const log = [];
  await loadMyRaidTrains('goproflowyo', { fetchImpl: routedFetch({}, log), storage, clock: () => NOW, ...noWait });
  assert.equal(log.length, 0);
});

test('refreshEventDetail retries the button the streamer is watching spin', async () => {
  const storage = fakeStorage();
  const log = [];
  const r = await refreshEventDetail('luna-hao8', {
    fetchImpl: flakyFetch(1, { [eventUrl('luna-hao8')]: okJson(makeEventPayload({ title: 'LUNA' })) }, log),
    storage, clock: () => NOW, ...noWait,
  });
  assert.equal(log.length, 2);
  assert.equal(r.fromCache, false);
  assert.equal(r.event.title, 'LUNA');
});

test('the sequential detail loop does NOT retry — N events must not multiply into a long spinner', async () => {
  // Deliberate asymmetry (see the module note): each card fails soft on its own
  // and carries its own Refresh, which does retry.
  const log = [];
  const results = await loadEventDetails(SUMMARIES, {
    fetchImpl: routedFetch({}, log), storage: fakeStorage(), clock: () => NOW, sleep: async () => {},
  });
  assert.equal(log.length, SUMMARIES.length); // one attempt each, not three
  assert.ok(results.every((r) => r.error && r.event === null));
});
