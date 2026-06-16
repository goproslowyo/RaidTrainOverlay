import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cacheKey, writeCache, readCache, loadEventResilient, nextPollDelayMs, startEventFeed,
} from '../src/event-feed.js';
import { makeEventPayload } from './fixtures/event-payload.js';

const MIN = 60_000;

/**
 * A controllable timer queue — the injected setTimer/clearTimer. `tick()` fires
 * the most recently scheduled (uncleared) timer and awaits its async body;
 * `lastMs()` reports the delay of the latest scheduled poll.
 */
function manualTimers() {
  const scheduled = [];
  let nextId = 1;
  return {
    setTimer(fn, ms) {
      const id = nextId++;
      scheduled.push({ id, fn, ms, ran: false, cleared: false });
      return id;
    },
    clearTimer(id) {
      const e = scheduled.find((s) => s.id === id);
      if (e) e.cleared = true;
    },
    lastMs() {
      return scheduled[scheduled.length - 1]?.ms;
    },
    async tick() {
      const e = [...scheduled].reverse().find((s) => !s.ran && !s.cleared);
      if (!e) throw new Error('no pending timer to tick');
      e.ran = true;
      await e.fn();
    },
  };
}

/** A fetchImpl that resolves ok with the given payload, counting calls. */
function okFetch(payload, counter = {}) {
  return async () => {
    counter.calls = (counter.calls ?? 0) + 1;
    return { ok: true, status: 200, json: async () => payload };
  };
}

/** A fetchImpl that always rejects (network down). */
function deadFetch(counter = {}) {
  return async () => {
    counter.calls = (counter.calls ?? 0) + 1;
    throw new Error('network down');
  };
}

/** A minimal Storage-like backed by a Map — the injected localStorage fake. */
function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

test('cacheKey namespaces by slug under a versioned prefix', () => {
  assert.equal(cacheKey('trainwreck-lucky-13'), 'raidtrainoverlay.cache.v2.trainwreck-lucky-13');
});

test('writeCache then readCache round-trips the raw payload + savedAt per slug', () => {
  const storage = fakeStorage();
  const payload = makeEventPayload();
  writeCache(storage, 'lucky-13', payload, 1700);
  assert.deepEqual(readCache(storage, 'lucky-13'), { payload, savedAt: 1700 });
});

test('readCache returns null for a slug that was never cached', () => {
  assert.equal(readCache(fakeStorage(), 'never-seen'), null);
});

test('readCache treats a corrupt cache blob as a miss, never throwing', () => {
  const storage = fakeStorage({ [cacheKey('lucky-13')]: '{not json' });
  assert.equal(readCache(storage, 'lucky-13'), null);
});

test('loadEventResilient fetches fresh, caches the raw payload, returns a normalized Event', async () => {
  const storage = fakeStorage();
  const payload = makeEventPayload();
  const result = await loadEventResilient('lucky-13', { fetchImpl: okFetch(payload), storage });

  assert.equal(result.fromCache, false);
  assert.equal(result.event.organiser.displayName, 'DJ Organiser');
  assert.equal(result.event.slots.length, 4);
  // The raw payload is cached for a future fallback.
  assert.deepEqual(readCache(storage, 'lucky-13').payload, payload);
});

test('loadEventResilient falls back to the warm cache when the live fetch fails', async () => {
  const storage = fakeStorage();
  const payload = makeEventPayload();
  await loadEventResilient('lucky-13', { fetchImpl: okFetch(payload), storage }); // prime cache

  const result = await loadEventResilient('lucky-13', { fetchImpl: deadFetch(), storage });
  assert.equal(result.fromCache, true);
  assert.equal(result.event.slots.length, 4);
  assert.match(result.error.message, /network down/); // the live failure is carried for logging
});

test('loadEventResilient rethrows when the fetch fails and the cache is cold', async () => {
  const storage = fakeStorage();
  await assert.rejects(
    loadEventResilient('never-seen', { fetchImpl: deadFetch(), storage }),
    /network down/,
  );
});

test('nextPollDelayMs returns exactly the base interval at the jitter midpoint', () => {
  // rand 0.5 is the jitter midpoint → no jitter, so the delay is the base.
  assert.equal(nextPollDelayMs({ refreshMins: 15, consecutiveFailures: 0, rand: () => 0.5 }), 15 * MIN);
  assert.equal(nextPollDelayMs({ refreshMins: 30, consecutiveFailures: 0, rand: () => 0.5 }), 30 * MIN);
});

test('nextPollDelayMs jitters within ±15% at the rand extremes', () => {
  const base = 15 * MIN;
  // Delays are rounded to whole ms, so round the expected band edges too
  // (base * 1.15 isn't exactly representable in float).
  assert.equal(nextPollDelayMs({ refreshMins: 15, consecutiveFailures: 0, rand: () => 0 }), Math.round(base * 0.85));
  assert.equal(nextPollDelayMs({ refreshMins: 15, consecutiveFailures: 0, rand: () => 1 }), Math.round(base * 1.15));
});

test('nextPollDelayMs backs off as 2^failures, capped at 60 min', () => {
  const mid = (consecutiveFailures) =>
    nextPollDelayMs({ refreshMins: 15, consecutiveFailures, rand: () => 0.5 });
  assert.equal(mid(0), 15 * MIN); // base
  assert.equal(mid(1), 30 * MIN); // ×2
  assert.equal(mid(2), 60 * MIN); // ×4 = 60, the cap
  assert.equal(mid(3), 60 * MIN); // ×8 = 120 → capped
  assert.equal(mid(10), 60 * MIN); // stays capped
});

test('startEventFeed with refresh off fetches exactly once and emits once', async () => {
  const counter = {};
  const events = [];
  const feed = startEventFeed('lucky-13', { refresh: 0 }, {
    fetchImpl: okFetch(makeEventPayload(), counter),
    storage: fakeStorage(),
    onEvent: (e) => events.push(e),
  });
  await feed.ready;
  assert.equal(counter.calls, 1);
  assert.equal(events.length, 1);
  assert.equal(events[0].slots.length, 4);
});

test('startEventFeed renders from warm cache on first load when the network is down', async () => {
  // A prior session cached this slug; now the box reloads offline.
  const storage = fakeStorage();
  writeCache(storage, 'lucky-13', makeEventPayload());
  const events = [];
  const feed = startEventFeed('lucky-13', { refresh: 0 }, {
    fetchImpl: deadFetch(), storage, onEvent: (e) => events.push(e),
  });
  await feed.ready;
  assert.equal(events.length, 1); // the Train still renders from last-good
  assert.equal(events[0].slots.length, 4);
});

test('startEventFeed re-polls on the scheduled timer when refresh is on', async () => {
  const counter = {};
  const timers = manualTimers();
  const feed = startEventFeed('lucky-13', { refresh: 15 }, {
    fetchImpl: okFetch(makeEventPayload(), counter),
    storage: fakeStorage(),
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, rand: () => 0.5,
  });
  await feed.ready;
  assert.equal(counter.calls, 1);
  await timers.tick(); // fire the scheduled poll
  assert.equal(counter.calls, 2);
  await timers.tick();
  assert.equal(counter.calls, 3);
  feed.stop(); // no further polls scheduled
});

test('startEventFeed re-emits only when the lineup payload changes', async () => {
  const timers = manualTimers();
  let current = makeEventPayload();
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => current });
  const events = [];
  const feed = startEventFeed('lucky-13', { refresh: 15 }, {
    fetchImpl, storage: fakeStorage(),
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, rand: () => 0.5,
    onEvent: (e) => events.push(e),
  });
  await feed.ready;
  assert.equal(events.length, 1); // first load
  await timers.tick(); // identical payload → no re-emit
  assert.equal(events.length, 1);
  current = makeEventPayload({ title: 'Renamed &amp; Reordered' }); // a lineup edit
  await timers.tick();
  assert.equal(events.length, 2); // re-emit on change
});

test('startEventFeed backs off on failing polls and resets cadence after a success', async () => {
  const timers = manualTimers();
  const storage = fakeStorage();
  const payload = makeEventPayload();
  let mode = 'ok';
  const fetchImpl = async () => {
    if (mode === 'dead') throw new Error('network down');
    return { ok: true, status: 200, json: async () => payload };
  };
  const onError = () => {};
  const feed = startEventFeed('lucky-13', { refresh: 15 }, {
    fetchImpl, storage,
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, rand: () => 0.5, onError,
  });
  await feed.ready;                 // success → cache primed; next delay = base
  assert.equal(timers.lastMs(), 15 * MIN);
  mode = 'dead';
  await timers.tick();              // warm fallback = failure #1 → 30 min
  assert.equal(timers.lastMs(), 30 * MIN);
  await timers.tick();              // failure #2 → 60 min
  assert.equal(timers.lastMs(), 60 * MIN);
  mode = 'ok';
  await timers.tick();              // success → reset → base again
  assert.equal(timers.lastMs(), 15 * MIN);
  feed.stop();
});

// ── cache-first within a freshness window (no API call on a recent reload) ──
test('loadEventResilient serves a fresh cache without fetching when within the window', async () => {
  const storage = fakeStorage();
  const payload = makeEventPayload();
  writeCache(storage, 'lucky-13', payload, 1_000_000);
  const counter = {};
  const r = await loadEventResilient('lucky-13', {
    fetchImpl: okFetch(makeEventPayload(), counter), storage,
    clock: () => 1_000_000 + 5 * MIN, freshMs: 15 * MIN, // 5 min old < 15 min window
  });
  assert.equal(counter.calls ?? 0, 0); // NO network call
  assert.equal(r.fromCache, true);
  assert.equal(r.fresh, true);
  assert.equal(r.event.slots.length, 4);
});

test('loadEventResilient fetches when the cached entry is older than the window', async () => {
  const storage = fakeStorage();
  writeCache(storage, 'lucky-13', makeEventPayload(), 1_000_000);
  const counter = {};
  const r = await loadEventResilient('lucky-13', {
    fetchImpl: okFetch(makeEventPayload(), counter), storage,
    clock: () => 1_000_000 + 20 * MIN, freshMs: 15 * MIN, // 20 min old > 15 min window
  });
  assert.equal(counter.calls, 1); // stale → fetched fresh
  assert.equal(r.fromCache, false);
});

test('loadEventResilient force-fetches even when the cache is fresh', async () => {
  const storage = fakeStorage();
  writeCache(storage, 'lucky-13', makeEventPayload(), 1_000_000);
  const counter = {};
  await loadEventResilient('lucky-13', {
    fetchImpl: okFetch(makeEventPayload(), counter), storage,
    clock: () => 1_000_000 + 1 * MIN, freshMs: 15 * MIN, force: true,
  });
  assert.equal(counter.calls, 1); // force bypasses the freshness window
});

test('startEventFeed initial load serves a fresh cache with no API call (refresh off → 15min window)', async () => {
  const storage = fakeStorage();
  writeCache(storage, 'lucky-13', makeEventPayload(), 1_000_000);
  const counter = {}, events = [];
  const feed = startEventFeed('lucky-13', { refresh: 0 }, {
    fetchImpl: okFetch(makeEventPayload(), counter), storage,
    clock: () => 1_000_000 + 5 * MIN, onEvent: (e) => events.push(e),
  });
  await feed.ready;
  assert.equal(counter.calls ?? 0, 0); // no API call on load
  assert.equal(events.length, 1);      // rendered from cache
});

test('startEventFeed serves cache on load but its scheduled poll force-fetches', async () => {
  const storage = fakeStorage();
  writeCache(storage, 'lucky-13', makeEventPayload(), 1_000_000);
  const counter = {}, timers = manualTimers();
  const feed = startEventFeed('lucky-13', { refresh: 15 }, {
    fetchImpl: okFetch(makeEventPayload(), counter), storage,
    clock: () => 1_000_000 + 1 * MIN, // cache is fresh
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, rand: () => 0.5,
  });
  await feed.ready;
  assert.equal(counter.calls ?? 0, 0); // initial load skipped the fetch (fresh cache)
  await timers.tick();                 // scheduled poll
  assert.equal(counter.calls, 1);      // poll forced a real fetch
  feed.stop();
});
