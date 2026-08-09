import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startLiveLinkFeed, userCacheKey } from '../src/live-link-feed.js';
import { encodeTrainMap } from '../src/live-link.js';
import { cacheKey as eventCacheKey } from '../src/event-feed.js';
import { MAX_BLOB_CHARS } from '../src/blob-codec.js';
import { makeUserPayload } from './fixtures/user-payload.js';
import { makeEventPayload } from './fixtures/event-payload.js';

const HOUR = 60 * 60_000;
// The fixture's trains: luna 08-03→08-06, trainwreck 08-10, my-own-train 08-20.
const DURING_LUNA = Date.parse('2026-08-05T00:00:00Z');
const BETWEEN = Date.parse('2026-08-07T00:00:00Z'); // idle gap, trainwreck 3.75 days out
const LEAD_TRAINWRECK = Date.parse('2026-08-10T17:30:00Z'); // 30 min before trainwreck departs

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
    pending() {
      return scheduled.filter((s) => !s.ran && !s.cleared).length;
    },
    async tick() {
      const e = [...scheduled].reverse().find((s) => !s.ran && !s.cleared);
      if (!e) throw new Error('no pending timer to tick');
      e.ran = true;
      await e.fn();
    },
  };
}

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const userUrl = 'https://api.raidpal.com/rest/user/goproflowyo';
const eventUrl = (slug) => `https://api.raidpal.com/rest/event/${slug}`;

function routedFetch(routes, log = []) {
  return async (url) => {
    log.push(url);
    const respond = routes[url];
    if (!respond) throw new Error(`network down: ${url}`);
    return respond();
  };
}

const okUser = () => ({ ok: true, status: 200, text: async () => JSON.stringify(makeUserPayload()) });
const okEvent = (title) => () => ({ ok: true, status: 200, json: async () => makeEventPayload({ title }) });

function harness({ query, clockMs, routes, log, storage }) {
  const timers = manualTimers();
  const calls = { switches: [], events: [], idles: [], errors: [] };
  const clock = { ms: clockMs };
  const feed = startLiveLinkFeed(query, {
    fetchImpl: routedFetch(routes, log),
    storage: storage ?? fakeStorage(),
    clock: () => clock.ms,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    rand: () => 0.5,
    onSwitch: (slug, config) => calls.switches.push({ slug, config }),
    onEvent: (event) => calls.events.push(event),
    onIdle: (idle) => calls.idles.push(idle),
    onError: (err) => calls.errors.push(err),
  });
  return { timers, calls, clock, feed };
}

test('a live train renders: onSwitch with its slug, then the lineup flows via onEvent', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo&theme=neon',
    clockMs: DURING_LUNA,
    routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('LUNA') },
  });
  await feed.ready;
  assert.equal(calls.switches.length, 1);
  assert.equal(calls.switches[0].slug, 'luna-hao8');
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].title, 'LUNA');
  assert.deepEqual(calls.idles, []);
});

test('uponly: even a LIVE train resolves to the idle card — never onSwitch, never a lineup fetch', async () => {
  // The upcoming-only Live Link (a second URL for a separate OBS scene):
  // whatever resolveLiveTrain says, this source renders the upcoming card.
  const log = [];
  const { calls, feed } = harness({
    query: '?user=goproflowyo&uponly=1&upcoming=all',
    clockMs: DURING_LUNA,
    routes: { [userUrl]: okUser },
    log,
  });
  await feed.ready;
  assert.deepEqual(calls.switches, []);
  assert.deepEqual(calls.events, []);
  assert.equal(calls.idles.length, 1);
  // luna is LIVE at this clock, so it is not "upcoming" — the card lists the rest.
  assert.deepEqual(calls.idles[0].upcoming.map((e) => e.slug), ['trainwreck-lucky-13', 'my-own-train']);
  // The inner LINEUP FEED never starts (no onSwitch/onEvent above); the only
  // per-event traffic is the one-shot slot lookups, which fail soft here
  // (unrouted) and leave the rows on their departure times.
  assert.deepEqual(log, [userUrl, eventUrl('trainwreck-lucky-13'), eventUrl('my-own-train')]);
});

test('the idle card learns when the streamer actually plays: cached lineups annotate mySlotAt', async () => {
  // The user payload's display name is 'GoProFlowYo'; seed both upcoming
  // events' lineups (the Overlay's own event cache) with a slot of theirs.
  const lineup = (slotIso) => ({
    payload: makeEventPayload({
      time_table: [{
        starttime: slotIso, slot_occupied: true, broadcaster_display_name: 'GoProFlowYo',
        broadcaster_image: '', broadcaster_live: false, broadcaster_id: 7,
      }],
    }),
    savedAt: BETWEEN - 1000,
  });
  const storage = fakeStorage({
    [eventCacheKey('trainwreck-lucky-13')]: JSON.stringify(lineup('2026-08-10T21:00:00Z')),
    [eventCacheKey('my-own-train')]: JSON.stringify(lineup('2026-08-20T19:30:00Z')),
  });
  const log = [];
  const { calls, feed } = harness({
    query: '?user=goproflowyo&uponly=1&upcoming=all',
    clockMs: BETWEEN,
    routes: { [userUrl]: okUser },
    log, storage,
  });
  await feed.ready;
  // Fresh caches → the FIRST paint already carries the slot times, no repaint.
  assert.equal(calls.idles.length, 1);
  assert.deepEqual(
    calls.idles[0].upcoming.map((e) => e.mySlotAt?.toISOString() ?? null),
    ['2026-08-10T21:00:00.000Z', '2026-08-20T19:30:00.000Z'],
  );
  assert.deepEqual(log, [userUrl], 'fresh lineup caches mean no per-event fetches');
});

test('a lineup the streamer is not on leaves mySlotAt absent — the row falls back to departure', async () => {
  const storage = fakeStorage({
    [eventCacheKey('trainwreck-lucky-13')]: JSON.stringify({ payload: makeEventPayload(), savedAt: BETWEEN - 1000 }),
    [eventCacheKey('my-own-train')]: JSON.stringify({ payload: makeEventPayload(), savedAt: BETWEEN - 1000 }),
  });
  const { calls, feed } = harness({
    query: '?user=goproflowyo&uponly=1&upcoming=all',
    clockMs: BETWEEN,
    routes: { [userUrl]: okUser },
    storage,
  });
  await feed.ready;
  assert.equal(calls.idles.length, 1);
  assert.deepEqual(calls.idles[0].upcoming.map((e) => e.mySlotAt ?? null), [null, null]);
});

test('the trains= mapping shapes the switched-to config; base params flow through', async () => {
  const trains = encodeTrainMap({ 'luna-hao8': { overrides: { theme: 'lava' }, spotlight: ['Guest'] } });
  const { calls, feed } = harness({
    query: `?user=goproflowyo&theme=synthwave&scale=1.2&trains=${trains}`,
    clockMs: DURING_LUNA,
    routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('LUNA') },
  });
  await feed.ready;
  const { config } = calls.switches[0];
  assert.equal(config.theme, 'lava'); // per-train override
  assert.equal(config.scale, 1.2); // base setting flows
  assert.deepEqual(config.spotlight, ['guest']); // parseConfig lowercases spotlight names (existing URL semantics)
});

// ── An unreadable trains= is audible (#33) ─────────────────────────────────
// The fallback to base settings is right — a corrupt blob must never stop the
// Overlay — but `?? {}` used to make it the quietest failure in the codebase:
// every train renders wrong and nothing anywhere says why.

/** Run `fn` with console.warn captured. */
async function capturingWarns(fn) {
  const warns = [];
  const original = console.warn;
  console.warn = (...args) => warns.push(args.join(' '));
  try {
    await fn();
  } finally {
    console.warn = original;
  }
  return warns;
}

test('an unreadable trains= warns on the console and falls back to the base settings', async () => {
  let calls;
  const warns = await capturingWarns(async () => {
    // Over MAX_BLOB_CHARS, so decodeJsonBlob rejects it on length alone — the
    // exact shape a Configurator with too many materialized Configs emits.
    const oversized = 'A'.repeat(MAX_BLOB_CHARS + 1);
    const h = harness({
      query: `?user=goproflowyo&theme=synthwave&trains=${oversized}`,
      clockMs: DURING_LUNA,
      routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('LUNA') },
    });
    await h.feed.ready;
    calls = h.calls;
  });
  assert.equal(warns.length, 1, 'exactly one warning, at startup — not once per tick');
  assert.match(warns[0], /RaidTrainOverlay: \?trains= could not be read/);
  assert.match(warns[0], new RegExp(String(MAX_BLOB_CHARS)), 'names the limit so it is actionable');
  // Still renders — with the base settings, which is the damage being reported.
  assert.equal(calls.switches.length, 1);
  assert.equal(calls.switches[0].config.theme, 'synthwave');
});

test('an absent trains= is silent — no blob is not a broken blob', async () => {
  const warns = await capturingWarns(async () => {
    const { feed } = harness({
      query: '?user=goproflowyo&theme=synthwave',
      clockMs: DURING_LUNA,
      routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('LUNA') },
    });
    await feed.ready;
  });
  assert.deepEqual(warns, []);
});

test('no live train and none within lead: onIdle with the upcoming list, no inner feed', async () => {
  const log = [];
  const { calls, feed } = harness({
    query: '?user=goproflowyo',
    clockMs: BETWEEN,
    routes: { [userUrl]: okUser },
    log,
  });
  await feed.ready;
  assert.deepEqual(calls.switches, []);
  assert.equal(calls.idles.length, 1);
  assert.deepEqual(calls.idles[0].upcoming.map((e) => e.slug), ['trainwreck-lucky-13', 'my-own-train']);
  // The only per-event traffic is the card's one-shot slot lookups (which
  // fail soft here, unrouted) — never a started lineup feed.
  assert.deepEqual(log, [userUrl, eventUrl('trainwreck-lucky-13'), eventUrl('my-own-train')]);
});

test('a train departing within the lead window takes the full render', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo',
    clockMs: LEAD_TRAINWRECK,
    routes: { [userUrl]: okUser, [eventUrl('trainwreck-lucky-13')]: okEvent('Trainwreck') },
  });
  await feed.ready;
  assert.equal(calls.switches[0]?.slug, 'trainwreck-lucky-13');
});

test('the re-resolve tick rolls train-to-train unattended', async () => {
  const { calls, feed, timers, clock } = harness({
    query: '?user=goproflowyo',
    clockMs: DURING_LUNA,
    routes: {
      [userUrl]: okUser,
      [eventUrl('luna-hao8')]: okEvent('LUNA'),
      [eventUrl('trainwreck-lucky-13')]: okEvent('Trainwreck'),
    },
  });
  await feed.ready;
  assert.equal(calls.switches.length, 1);
  // Luna ends; the next resolve tick lands 30 min before trainwreck departs.
  clock.ms = LEAD_TRAINWRECK;
  await timers.tick();
  assert.equal(calls.switches.length, 2);
  assert.equal(calls.switches[1].slug, 'trainwreck-lucky-13');
});

test('a user fetch failure falls back to the cached user payload — the promise never blanks', async () => {
  const timers = manualTimers();
  const storage = fakeStorage();
  const calls = { switches: [], errors: [] };
  let networkUp = true;
  const fetchImpl = async (url) => {
    if (url === userUrl) {
      if (!networkUp) throw new Error('network down');
      return okUser();
    }
    return okEvent('LUNA')();
  };
  const clock = { ms: DURING_LUNA };
  const feed = startLiveLinkFeed('?user=goproflowyo', {
    fetchImpl, storage,
    clock: () => clock.ms,
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, rand: () => 0.5,
    onSwitch: (slug) => calls.switches.push(slug),
    onEvent: () => {}, onIdle: () => {},
    onError: (err) => calls.errors.push(err),
  });
  await feed.ready;
  assert.deepEqual(calls.switches, ['luna-hao8']);
  // RaidPal goes down; the next tick resolves from the cached user payload.
  networkUp = false;
  clock.ms = LEAD_TRAINWRECK;
  await timers.tick();
  assert.deepEqual(calls.switches, ['luna-hao8', 'trainwreck-lucky-13']);
  assert.ok(calls.errors.length >= 1);
  assert.ok(storage.getItem(userCacheKey('goproflowyo')));
});

test('an unknown login reports the error and idles with nothing upcoming', async () => {
  const { calls, feed } = harness({
    query: '?user=nobody',
    clockMs: BETWEEN,
    routes: { 'https://api.raidpal.com/rest/user/nobody': () => ({ ok: true, status: 204, text: async () => '' }) },
  });
  await feed.ready;
  assert.deepEqual(calls.switches, []);
  assert.equal(calls.idles.length, 1);
  assert.deepEqual(calls.idles[0].upcoming, []);
  assert.equal(calls.errors.length, 1);
  assert.match(String(calls.errors[0]), /nobody/);
});

test('stop() cancels the pending resolve tick', async () => {
  const { feed, timers } = harness({
    query: '?user=goproflowyo',
    clockMs: BETWEEN,
    routes: { [userUrl]: okUser },
  });
  await feed.ready;
  assert.equal(timers.pending(), 1);
  feed.stop();
  assert.equal(timers.pending(), 0);
});
