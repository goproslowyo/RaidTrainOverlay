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

// The feed asks its injected timer for two very different things: the resolve
// SCHEDULE (minutes away — the thing a test wants to drive by hand) and the
// polite PAUSE between consecutive lineup fetches (sub-second, an internal
// nicety no test cares about). Holding the pause hostage to a manual tick just
// deadlocks the read, so anything under a second runs on its own.
const PAUSE_CEILING_MS = 1000;

function manualTimers() {
  const scheduled = [];
  let nextId = 1;
  return {
    setTimer(fn, ms) {
      if (ms < PAUSE_CEILING_MS) return setTimeout(fn, 0);
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

// The fixture user's three trains, with the times their summaries carry and
// where the streamer's OWN slot sits on each. Resolution reads lineups now —
// it picks the train the streamer is playing, not merely one that is running —
// so a train a test expects to render has to actually name them in its lineup.
// `mine`/`mineTo` bound the streamer's own slot; `mineTo` is where the NEXT
// broadcaster takes over, which is what actually ends a turn.
const TRAINS = {
  'luna-hao8': {
    from: '2026-08-03T22:00:00Z', to: '2026-08-06T12:00:00Z',
    mine: '2026-08-04T22:00:00Z', mineTo: '2026-08-05T06:00:00Z',
  },
  'trainwreck-lucky-13': {
    from: '2026-08-10T18:00:00Z', to: '2026-08-10T22:00:00Z',
    mine: '2026-08-10T18:00:00Z', mineTo: '2026-08-10T19:00:00Z',
  },
  'my-own-train': {
    from: '2026-08-20T18:00:00Z', to: '2026-08-20T22:00:00Z',
    mine: '2026-08-20T18:00:00Z', mineTo: '2026-08-20T19:00:00Z',
  },
};

const slot = (starttime, name, order) => ({
  order, starttime, slot_occupied: true, user_timezone: 'UTC',
  broadcaster_display_name: name, broadcaster_image: '', broadcaster_live: false, broadcaster_id: `${name}-id`,
});

/** A lineup for one of the fixture trains, with the streamer's slot on it. */
const okEvent = (slug, title) => () => {
  const t = TRAINS[slug];
  const slots = [];
  if (t.mine !== t.from) slots.push(slot(t.from, 'DJ Alpha', slots.length));
  slots.push(slot(t.mine, 'GoProFlowYo', slots.length));
  slots.push(slot(t.mineTo, 'DJ Omega', slots.length));
  return {
    ok: true,
    status: 200,
    json: async () => makeEventPayload({ title, starttime: t.from, endtime: t.to, time_table: slots }),
  };
};

/** The slug an event URL addresses — for routes that answer any train. */
const slugOf = (url) => url.slice(url.lastIndexOf('/') + 1);

function harness({ query, clockMs, routes, log, storage }) {
  const timers = manualTimers();
  const calls = { switches: [], events: [], idles: [], horizons: [], errors: [] };
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
    onHorizon: (horizon) => calls.horizons.push(horizon),
    onError: (err) => calls.errors.push(err),
  });
  return { timers, calls, clock, feed };
}

test('a live train renders: onSwitch with its slug, then the lineup flows via onEvent', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo&theme=neon',
    clockMs: DURING_LUNA,
    routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('luna-hao8', 'LUNA') },
  });
  await feed.ready;
  assert.equal(calls.switches.length, 1);
  assert.equal(calls.switches[0].slug, 'luna-hao8');
  assert.equal(calls.events.length, 1);
  assert.equal(calls.events[0].title, 'LUNA');
  assert.deepEqual(calls.idles, []);
});

// The between-Pass card (#61) lists OTHER trains while one is live, so the
// horizon has to reach the live path — until now it only ever reached onIdle.
test('a live train also delivers the horizon: onHorizon lists the OTHER upcoming trains', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo',
    clockMs: DURING_LUNA,
    routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('luna-hao8', 'LUNA') },
  });
  await feed.ready;
  assert.equal(calls.switches.length, 1, 'the Train still renders');
  assert.ok(calls.horizons.length >= 1, 'the live path delivers a horizon');
  // luna is LIVE at this clock, so it is never in its own horizon.
  assert.deepEqual(
    calls.horizons.at(-1).upcoming.map((e) => e.slug),
    ['trainwreck-lucky-13', 'my-own-train'],
  );
  assert.deepEqual(calls.idles, [], 'a live train is not idle');
});

test('the live Horizon is annotated like the between-trains one: cached lineups carry mySlotAt', async () => {
  // The live horizon must not be a less-informed second class: its rows say
  // when the streamer PLAYS, exactly as the Upcoming card's rows do.
  const lineup = (slotIso) => ({
    payload: makeEventPayload({
      time_table: [{
        starttime: slotIso, slot_occupied: true, broadcaster_display_name: 'GoProFlowYo',
        broadcaster_image: '', broadcaster_live: false, broadcaster_id: 7,
      }],
    }),
    savedAt: DURING_LUNA - 1000,
  });
  const storage = fakeStorage({
    [eventCacheKey('trainwreck-lucky-13')]: JSON.stringify(lineup('2026-08-10T21:00:00Z')),
    [eventCacheKey('my-own-train')]: JSON.stringify(lineup('2026-08-20T19:30:00Z')),
  });
  const { calls, feed } = harness({
    query: '?user=goproflowyo',
    clockMs: DURING_LUNA,
    routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('luna-hao8', 'LUNA') },
    storage,
  });
  await feed.ready;
  assert.deepEqual(
    calls.horizons.at(-1).upcoming.map((e) => e.mySlotAt?.toISOString() ?? null),
    ['2026-08-10T21:00:00.000Z', '2026-08-20T19:30:00.000Z'],
  );
});

test('the horizon stays fresh while the SAME train keeps running', async () => {
  // The re-resolve tick used to do nothing at all when the slug was unchanged,
  // so a card listing other trains would go stale over a long broadcast.
  const { calls, feed, timers } = harness({
    query: '?user=goproflowyo',
    clockMs: DURING_LUNA,
    routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('luna-hao8', 'LUNA') },
  });
  await feed.ready;
  const before = calls.horizons.length;
  await timers.tick();
  assert.equal(calls.switches.length, 1, 'the same train never re-switches');
  assert.ok(calls.horizons.length > before, 're-resolving re-delivers the horizon');
});

test('uponly: even a LIVE train resolves to the Upcoming card — never onSwitch, never an inner feed', async () => {
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
  assert.ok(calls.idles.length >= 1);
  // My luna turn is running at this clock, so it is not still ahead of me; the
  // card lists the trains that are. (A turn that had NOT started yet would be
  // listed — that is `ahead` rather than `upcoming`, and the whole point of the
  // distinction on a source that renders no Train.)
  assert.deepEqual(calls.idles.at(-1).upcoming.map((e) => e.slug), ['trainwreck-lucky-13', 'my-own-train']);
  // The inner LINEUP FEED never starts (no onSwitch/onEvent above). The event
  // traffic is one-shot reads: luna's lineup, to know where my turn on it sits,
  // then the card's slot lookups — which fail soft here (unrouted) and leave
  // those rows on their departure times.
  assert.deepEqual(log, [
    userUrl, eventUrl('luna-hao8'), eventUrl('trainwreck-lucky-13'), eventUrl('my-own-train'),
  ]);
});

test('the Upcoming card learns when the streamer actually plays: cached lineups annotate mySlotAt', async () => {
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
    routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('luna-hao8', 'LUNA') },
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
      routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('luna-hao8', 'LUNA') },
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
      routes: { [userUrl]: okUser, [eventUrl('luna-hao8')]: okEvent('luna-hao8', 'LUNA') },
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
    routes: { [userUrl]: okUser, [eventUrl('trainwreck-lucky-13')]: okEvent('trainwreck-lucky-13', 'Trainwreck') },
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
      [eventUrl('luna-hao8')]: okEvent('luna-hao8', 'LUNA'),
      [eventUrl('trainwreck-lucky-13')]: okEvent('trainwreck-lucky-13', 'Trainwreck'),
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
    const slug = slugOf(url);
    return okEvent(slug, slug)();
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

// ── Overlapping trains: the Overlay follows its streamer, not the clock ────
// The reported case. An overnight train runs into the afternoon; the streamer
// raided out of it before dawn and plays the next train at 07:00. The old rule
// gave the Stage to whichever train departed first and kept it there, so the
// overnight train held the screen all morning — and the 07:00 train, once it
// departed, was rendered nowhere and listed nowhere.

const OVERNIGHT_USER = () => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(makeUserPayload({
    events: [],
    events_joined: [
      {
        title: 'Overnight',
        starttime: '2026-08-11T20:00:00Z',
        endtime: '2026-08-12T21:00:00Z',
        raidpal_link: 'https://raidpal.com/en/event/overnight',
        api_link: 'https://api.raidpal.com/rest/event/overnight',
      },
      {
        title: 'Morning',
        starttime: '2026-08-12T14:00:00Z',
        endtime: '2026-08-12T20:00:00Z',
        raidpal_link: 'https://raidpal.com/en/event/morning',
        api_link: 'https://api.raidpal.com/rest/event/morning',
      },
    ],
  })),
});

/** A lineup naming the streamer for one slot only, the rest filled by others. */
const overlapLineup = (title, from, to, mine) => () => ({
  ok: true,
  status: 200,
  json: async () => makeEventPayload({
    title,
    starttime: from,
    endtime: to,
    time_table: [slot(from, 'DJ Alpha', 0), slot(mine, 'GoProFlowYo', 1)],
  }),
});

const OVERLAP_ROUTES = {
  'https://api.raidpal.com/rest/user/goproflowyo': OVERNIGHT_USER,
  // My slot on the overnight train ran 22:00–23:00 the night before.
  [eventUrl('overnight')]: overlapLineup('Overnight', '2026-08-11T20:00:00Z', '2026-08-12T21:00:00Z', '2026-08-11T22:00:00Z'),
  // My slot on the morning train runs 15:00–20:00, an hour after it departs.
  [eventUrl('morning')]: overlapLineup('Morning', '2026-08-12T14:00:00Z', '2026-08-12T20:00:00Z', '2026-08-12T15:00:00Z'),
};

test('overlap: a train I already raided out of does not hold the Stage', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo&upcoming=all',
    clockMs: Date.parse('2026-08-12T13:00:00Z'), // overnight running, my slot 14h gone
    routes: OVERLAP_ROUTES,
  });
  await feed.ready;
  assert.deepEqual(calls.switches, [], 'nothing renders — I am not playing on anything');
  assert.equal(calls.idles.length, 1);
  assert.deepEqual(calls.idles[0].upcoming.map((e) => e.slug), ['morning']);
});

test('overlap: the train I play next leads, while the overnight one still runs', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo&upcoming=all',
    clockMs: Date.parse('2026-08-12T14:30:00Z'), // 30 min before my morning slot
    routes: OVERLAP_ROUTES,
  });
  await feed.ready;
  assert.deepEqual(calls.switches.map((s) => s.slug), ['morning']);
});

test('overlap: a train that departed under a running one is never swallowed', async () => {
  // The bug's second half: at 16:00 `morning` had departed (so the old
  // `starttime > now` horizon dropped it) while `overnight` held the Stage.
  const { calls, feed } = harness({
    query: '?user=goproflowyo&upcoming=all',
    clockMs: Date.parse('2026-08-12T16:00:00Z'),
    routes: OVERLAP_ROUTES,
  });
  await feed.ready;
  assert.deepEqual(calls.switches.map((s) => s.slug), ['morning'], 'the train I am ON renders');
});

test('overlap: once my slot ends the Overlay clears, even though the train runs on', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo&upcoming=all',
    clockMs: Date.parse('2026-08-12T20:30:00Z'), // my morning slot ended at 20:00
    routes: OVERLAP_ROUTES,
  });
  await feed.ready;
  assert.deepEqual(calls.switches, []);
  assert.equal(calls.idles.length, 1);
  assert.deepEqual(calls.idles[0].upcoming, [], 'nothing left ahead');
});

test('wholetrain=1 restores the old rule: the earliest-started running train wins', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo&wholetrain=1',
    clockMs: Date.parse('2026-08-12T16:00:00Z'),
    routes: OVERLAP_ROUTES,
  });
  await feed.ready;
  assert.deepEqual(calls.switches.map((s) => s.slug), ['overnight']);
});

test('lead= tunes how early the Train rolls in ahead of my slot', async () => {
  // My morning slot starts 15:00. At 13:30 a 60m lead is not enough...
  const early = harness({
    query: '?user=goproflowyo&upcoming=all',
    clockMs: Date.parse('2026-08-12T13:30:00Z'),
    routes: OVERLAP_ROUTES,
  });
  await early.feed.ready;
  assert.deepEqual(early.calls.switches, []);
  // ...but a 120m lead is.
  const wide = harness({
    query: '?user=goproflowyo&upcoming=all&lead=120',
    clockMs: Date.parse('2026-08-12T13:30:00Z'),
    routes: OVERLAP_ROUTES,
  });
  await wide.feed.ready;
  assert.deepEqual(wide.calls.switches.map((s) => s.slug), ['morning']);
});

// The upcoming-only source (?uponly=1) is a whole OBS scene made of the card,
// so a train missing from its Horizon is missing from the screen entirely.
// v0.12.0 skipped reading lineups here — "a source that never renders the Train
// has no use for knowing which train it would have rendered" — which was true
// about the Stage and false about the card: without windows, a train that has
// DEPARTED is the live train, and the live train is the one row the Horizon
// leaves out. A streamer whose turn is at teatime on a train that left at dawn
// saw an empty card all day.

test('uponly: a train running now, with my turn later today, is still on the card', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo&uponly=1&upcoming=all',
    clockMs: Date.parse('2026-08-12T14:30:00Z'), // morning departed at 14:00; my turn is 15:00
    routes: OVERLAP_ROUTES,
  });
  await feed.ready;
  assert.deepEqual(calls.switches, [], 'uponly never renders the Train');
  assert.equal(calls.idles.length >= 1, true);
  assert.deepEqual(calls.idles.at(-1).upcoming.map((e) => e.title), ['Morning']);
});

test('uponly: the card orders by when I PLAY, not by when the trains depart', async () => {
  const { calls, feed } = harness({
    query: '?user=goproflowyo&uponly=1&upcoming=all',
    clockMs: Date.parse('2026-08-12T13:00:00Z'),
    routes: OVERLAP_ROUTES,
  });
  await feed.ready;
  // The overnight train is still running but my turn on it is long over, so it
  // is not ahead of anything; only the morning train is still to come.
  assert.deepEqual(calls.idles.at(-1).upcoming.map((e) => e.title), ['Morning']);
});
