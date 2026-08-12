import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEAD_MS, encodeTrainMap, decodeTrainMap, resolveLiveTrain, effectiveQuery, myWindows,
} from '../src/live-link.js';

const MIN = 60_000;
const NOW = new Date('2026-08-07T20:00:00Z');
const at = (iso) => new Date(iso);

const summary = (slug, start, end) => ({ slug, title: slug, starttime: at(start), endtime: at(end) });

// ---- trains= codec ----

test('encode/decodeTrainMap round-trips per-slug overrides and spotlight additions', () => {
  const map = {
    'luna-hao8': { overrides: { theme: 'lava', scale: '1.2' }, spotlight: ['Guest DJ'] },
    'other-train': { overrides: { mode: 'marquee' }, spotlight: [] },
  };
  const decoded = decodeTrainMap(encodeTrainMap(map));
  assert.deepEqual(decoded, map);
});

test('decodeTrainMap is defensive: garbage, oversize, wrong version, wrong shape → null', () => {
  assert.equal(decodeTrainMap('not-a-blob!'), null);
  assert.equal(decodeTrainMap(''), null);
  assert.equal(decodeTrainMap(null), null);
  assert.equal(decodeTrainMap('x'.repeat(9000)), null);
  // A valid blob of the wrong wire shape (a lineup, say) must not decode.
  assert.equal(decodeTrainMap(btoa(JSON.stringify({ v: 99, t: {} })).replace(/=+$/, '')), null);
  assert.equal(decodeTrainMap(btoa(JSON.stringify({ v: 1, t: [1, 2] })).replace(/=+$/, '')), null);
});

test('decodeTrainMap normalizes sparse wire entries to { overrides, spotlight }', () => {
  // Wire form omits empty o/sp; decode always yields both keys.
  const decoded = decodeTrainMap(encodeTrainMap({ 'luna-hao8': { overrides: {}, spotlight: [] } }));
  assert.deepEqual(decoded, { 'luna-hao8': { overrides: {}, spotlight: [] } });
});

test('decodeTrainMap drops non-string override values and non-string spotlight names', () => {
  const blob = encodeTrainMap({ ok: { overrides: { theme: 'lava' }, spotlight: ['A'] } });
  const tampered = JSON.parse(atob(blob.replace(/-/g, '+').replace(/_/g, '/')));
  tampered.t.ok.o.evil = { nested: true };
  tampered.t.ok.sp.push(42);
  const retampered = btoa(JSON.stringify(tampered)).replace(/=+$/, '');
  const decoded = decodeTrainMap(retampered);
  assert.deepEqual(decoded.ok.overrides, { theme: 'lava' });
  assert.deepEqual(decoded.ok.spotlight, ['A']);
});

// ---- resolution ----

test('resolveLiveTrain: a train containing now is live', () => {
  const events = [
    summary('past', '2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z'),
    summary('current', '2026-08-07T18:00:00Z', '2026-08-08T02:00:00Z'),
    summary('future', '2026-08-09T00:00:00Z', '2026-08-10T00:00:00Z'),
  ];
  const r = resolveLiveTrain(events, NOW);
  assert.equal(r.state, 'live');
  assert.equal(r.train.slug, 'current');
});

test('resolveLiveTrain: the next upcoming train within the lead window takes the full render', () => {
  const events = [summary('soon', '2026-08-07T20:45:00Z', '2026-08-08T02:00:00Z')];
  const r = resolveLiveTrain(events, NOW);
  assert.equal(r.state, 'lead');
  assert.equal(r.train.slug, 'soon');
  assert.equal(LEAD_MS, 60 * MIN);
});

test('resolveLiveTrain: beyond the lead window is idle, with the upcoming list exposed for the card', () => {
  const events = [
    summary('past', '2026-08-01T00:00:00Z', '2026-08-02T00:00:00Z'),
    summary('later', '2026-08-08T02:00:00Z', '2026-08-08T08:00:00Z'),
    summary('after', '2026-08-09T00:00:00Z', '2026-08-10T00:00:00Z'),
  ];
  const r = resolveLiveTrain(events, NOW);
  assert.equal(r.state, 'idle');
  assert.equal(r.train, null);
  assert.deepEqual(r.upcoming.map((e) => e.slug), ['later', 'after']);
});

test('resolveLiveTrain: no events at all is idle with an empty upcoming list', () => {
  assert.deepEqual(resolveLiveTrain([], NOW), {
    state: 'idle', train: null, upcoming: [], ahead: [],
  });
});

test('resolveLiveTrain picks the EARLIEST-started live train when two overlap and no lineup is known', () => {
  const events = [
    summary('second', '2026-08-07T19:00:00Z', '2026-08-08T02:00:00Z'),
    summary('first', '2026-08-07T18:00:00Z', '2026-08-08T01:00:00Z'),
  ];
  assert.equal(resolveLiveTrain(events, NOW).train.slug, 'first');
});

// ---- my own slot windows ----

const ME = ['goproflowyo', 'GoProFlowYo'];

/** A normalized Event with a lineup; `names` occupy the slots at the given starts. */
const lineup = (endtime, slots, slotDurationMins = 60) => ({
  endtime: at(endtime),
  slotDurationMins,
  slots: slots.map(([start, name], order) => ({
    order,
    starttime: at(start),
    occupied: name != null,
    broadcaster: name == null ? null : { displayName: name },
  })),
});

test('myWindows: my slot runs until the next slot starts', () => {
  const event = lineup('2026-08-08T02:00:00Z', [
    ['2026-08-07T18:00:00Z', 'SomeoneElse'],
    ['2026-08-07T19:00:00Z', 'GoProFlowYo'],
    ['2026-08-07T20:00:00Z', 'Another'],
  ]);
  assert.deepEqual(myWindows(event, ME), [
    { from: at('2026-08-07T19:00:00Z'), to: at('2026-08-07T20:00:00Z') },
  ]);
});

test('myWindows: back-to-back slots merge into ONE window', () => {
  const event = lineup('2026-08-08T02:00:00Z', [
    ['2026-08-07T18:00:00Z', 'SomeoneElse'],
    ['2026-08-07T19:00:00Z', 'GoProFlowYo'],
    ['2026-08-07T20:00:00Z', 'goproflowyo'],
    ['2026-08-07T21:00:00Z', 'Another'],
  ]);
  assert.deepEqual(myWindows(event, ME), [
    { from: at('2026-08-07T19:00:00Z'), to: at('2026-08-07T21:00:00Z') },
  ]);
});

test('myWindows: the LAST slot runs its nominal duration, not to the end of the train', () => {
  // The train is billed until 02:00 but the lineup stops at 19:00 — playing the
  // last slot must not put the streamer on screen for another seven hours.
  const event = lineup('2026-08-08T02:00:00Z', [
    ['2026-08-07T18:00:00Z', 'SomeoneElse'],
    ['2026-08-07T19:00:00Z', 'GoProFlowYo'],
  ]);
  assert.deepEqual(myWindows(event, ME), [
    { from: at('2026-08-07T19:00:00Z'), to: at('2026-08-07T20:00:00Z') },
  ]);
});

test('myWindows: with no slot duration stated, the last slot falls back to the train end', () => {
  const event = { ...lineup('2026-08-08T02:00:00Z', [['2026-08-07T19:00:00Z', 'GoProFlowYo']]), slotDurationMins: 0 };
  assert.deepEqual(myWindows(event, ME), [
    { from: at('2026-08-07T19:00:00Z'), to: at('2026-08-08T02:00:00Z') },
  ]);
});

test('myWindows: a nominal duration never carries a slot past the end of its train', () => {
  const event = lineup('2026-08-07T19:30:00Z', [['2026-08-07T19:00:00Z', 'GoProFlowYo']]);
  assert.deepEqual(myWindows(event, ME), [
    { from: at('2026-08-07T19:00:00Z'), to: at('2026-08-07T19:30:00Z') },
  ]);
});

test('myWindows: two separate appearances stay two windows', () => {
  const event = lineup('2026-08-08T02:00:00Z', [
    ['2026-08-07T18:00:00Z', 'GoProFlowYo'],
    ['2026-08-07T19:00:00Z', 'SomeoneElse'],
    ['2026-08-07T20:00:00Z', 'GoProFlowYo'],
    ['2026-08-07T21:00:00Z', 'Another'],
  ]);
  assert.deepEqual(myWindows(event, ME), [
    { from: at('2026-08-07T18:00:00Z'), to: at('2026-08-07T19:00:00Z') },
    { from: at('2026-08-07T20:00:00Z'), to: at('2026-08-07T21:00:00Z') },
  ]);
});

test('myWindows: a lineup that does not name me yields no windows', () => {
  const event = lineup('2026-08-08T02:00:00Z', [
    ['2026-08-07T18:00:00Z', 'SomeoneElse'],
    ['2026-08-07T19:00:00Z', null],
  ]);
  assert.deepEqual(myWindows(event, ME), []);
});

// ---- slot-aware resolution (the overnight-overlap bug) ----

// The reported case: an overnight train still running, my slot on it long over,
// and the train I actually play next departing in 15 minutes.
const OVERNIGHT = summary('overnight', '2026-08-07T03:00:00Z', '2026-08-08T00:00:00Z');
const MORNING = summary('morning', '2026-08-07T20:15:00Z', '2026-08-08T02:00:00Z');
const OVERLAP = [OVERNIGHT, MORNING];
// My slot on the overnight train ran 04:00–05:00 — sixteen hours ago.
const PLAYED_OUT = {
  overnight: [{ from: at('2026-08-07T04:00:00Z'), to: at('2026-08-07T05:00:00Z') }],
  morning: [{ from: at('2026-08-07T21:00:00Z'), to: at('2026-08-07T22:00:00Z') }],
};

test('resolveLiveTrain: a train whose slot of mine is over no longer holds the stage', () => {
  const r = resolveLiveTrain(OVERLAP, NOW, { windows: PLAYED_OUT });
  assert.notEqual(r.train?.slug, 'overnight');
});

test('resolveLiveTrain: the train I play next leads, even while another runs', () => {
  // NOW is 20:00; my morning slot starts 21:00 — inside the 60m lead window.
  const r = resolveLiveTrain(OVERLAP, NOW, { windows: PLAYED_OUT });
  assert.equal(r.state, 'lead');
  assert.equal(r.train.slug, 'morning');
});

test('resolveLiveTrain: once my slot starts, that train is live', () => {
  const r = resolveLiveTrain(OVERLAP, at('2026-08-07T21:30:00Z'), { windows: PLAYED_OUT });
  assert.equal(r.state, 'live');
  assert.equal(r.train.slug, 'morning');
});

test('resolveLiveTrain: a train that departed while another runs is NOT swallowed', () => {
  // The bug: at 20:30 `morning` has departed, so it left the old upcoming list,
  // while `overnight` held the stage — it was rendered nowhere and listed nowhere.
  const r = resolveLiveTrain(OVERLAP, at('2026-08-07T20:30:00Z'), { windows: PLAYED_OUT });
  assert.equal(r.train.slug, 'morning');
});

test('resolveLiveTrain: after my slot ends there is nothing to render, only the card', () => {
  const r = resolveLiveTrain(OVERLAP, at('2026-08-07T23:00:00Z'), { windows: PLAYED_OUT });
  assert.equal(r.state, 'idle');
  assert.equal(r.train, null);
});

test('resolveLiveTrain: a live train whose slot of mine is still hours off waits on the card', () => {
  // Overnight is running and I AM on it, but not for another four hours.
  const windows = { overnight: [{ from: at('2026-08-08T00:00:00Z'), to: at('2026-08-08T01:00:00Z') }] };
  const events = [summary('overnight', '2026-08-07T03:00:00Z', '2026-08-08T02:00:00Z')];
  const r = resolveLiveTrain(events, NOW, { windows });
  assert.equal(r.state, 'idle');
  assert.deepEqual(r.upcoming.map((e) => e.slug), ['overnight']);
});

test('resolveLiveTrain: a train I am definitively not on never takes the stage', () => {
  const events = [summary('notmine', '2026-08-07T18:00:00Z', '2026-08-08T02:00:00Z')];
  const r = resolveLiveTrain(events, NOW, { windows: { notmine: [] } });
  assert.equal(r.state, 'idle');
  assert.deepEqual(r.upcoming, []);
});

test('resolveLiveTrain: an unreadable lineup falls back to the whole-train window', () => {
  // `windows` present but with nothing for this slug = "we could not tell".
  const events = [summary('unknown', '2026-08-07T18:00:00Z', '2026-08-08T02:00:00Z')];
  const r = resolveLiveTrain(events, NOW, { windows: {} });
  assert.equal(r.state, 'live');
  assert.equal(r.train.slug, 'unknown');
});

test('resolveLiveTrain: leadMs is tunable', () => {
  const r = resolveLiveTrain(OVERLAP, NOW, { windows: PLAYED_OUT, leadMs: 30 * MIN });
  assert.equal(r.state, 'idle'); // my slot is 60m out, beyond a 30m lead
  assert.deepEqual(r.upcoming.map((e) => e.slug), ['morning']);
});

// ---- effective settings ----

test('effectiveQuery overlays a mapping entry onto the base query', () => {
  const q = effectiveQuery('user=goproflowyo&theme=neon&scale=1.2&trains=blob', {
    overrides: { theme: 'lava', mode: 'marquee' },
    spotlight: [],
  });
  const params = new URLSearchParams(q);
  assert.equal(params.get('theme'), 'lava'); // overridden
  assert.equal(params.get('scale'), '1.2'); // base flows through
  assert.equal(params.get('mode'), 'marquee');
});

test('effectiveQuery unions spotlight additions with the base spotlight', () => {
  const q = effectiveQuery('spotlight=Standing,Both', { overrides: {}, spotlight: ['Guest', 'both'] });
  assert.deepEqual(new URLSearchParams(q).get('spotlight'), 'Standing,Both,Guest');
});

test('effectiveQuery never lets a mapping smuggle source params', () => {
  const q = effectiveQuery('user=goproflowyo&theme=neon', {
    overrides: { event: 'hijack', lineup: 'blob', user: 'other', trains: 'blob2' },
    spotlight: [],
  });
  const params = new URLSearchParams(q);
  assert.equal(params.get('event'), null);
  assert.equal(params.get('lineup'), null);
  assert.equal(params.get('user'), 'goproflowyo');
  assert.equal(params.get('theme'), 'neon');
});

test('effectiveQuery with no mapping entry returns the base query as-is', () => {
  const base = 'user=goproflowyo&theme=neon';
  assert.equal(new URLSearchParams(effectiveQuery(base, null)).get('theme'), 'neon');
});

// ---- upcoming horizon + self-reload (#15) ----

import { filterUpcoming, shouldSelfReload, IDLE_RELOAD_MS } from '../src/live-link.js';

const UP = [
  summary('a', '2026-08-08T00:00:00Z', '2026-08-08T06:00:00Z'),   // +4h
  summary('b', '2026-08-12T00:00:00Z', '2026-08-12T06:00:00Z'),   // +4.2d
  summary('c', '2026-08-25T00:00:00Z', '2026-08-25T06:00:00Z'),   // +18d
  summary('d', '2026-10-01T00:00:00Z', '2026-10-01T06:00:00Z'),   // +55d
];

test('filterUpcoming: off (null spec) lists nothing — the overlay stays empty', () => {
  assert.deepEqual(filterUpcoming(UP, null, NOW), []);
});

test('filterUpcoming honors each horizon grammar: count, weeks, months, all', () => {
  assert.deepEqual(filterUpcoming(UP, { kind: 'count', n: 2 }, NOW).map((e) => e.slug), ['a', 'b']);
  assert.deepEqual(filterUpcoming(UP, { kind: 'weeks', n: 1 }, NOW).map((e) => e.slug), ['a', 'b']);
  assert.deepEqual(filterUpcoming(UP, { kind: 'months', n: 1 }, NOW).map((e) => e.slug), ['a', 'b', 'c']);
  assert.deepEqual(filterUpcoming(UP, { kind: 'all' }, NOW).map((e) => e.slug), ['a', 'b', 'c', 'd']);
});

test('shouldSelfReload: only when idle AND the page is over an hour old', () => {
  const loadedAt = NOW.getTime() - IDLE_RELOAD_MS - 1;
  assert.equal(shouldSelfReload({ loadedAt, now: NOW.getTime() }), true);
  assert.equal(shouldSelfReload({ loadedAt: NOW.getTime() - 10 * MIN, now: NOW.getTime() }), false);
  assert.equal(IDLE_RELOAD_MS, 60 * MIN);
});

// ---- whose slot is mine (the card shows when the streamer actually plays) ----

import { mySlot } from '../src/live-link.js';

const slot = (name, iso, occupied = true) => ({
  starttime: at(iso), occupied,
  broadcaster: occupied ? { displayName: name, image: '', live: false, id: 1 } : null,
});

test('mySlot finds the occupied slot whose broadcaster matches any candidate name, case-insensitively', () => {
  const event = { slots: [slot('DJ Alpha', '2026-08-15T10:00:00Z'), slot('GoProFlowYo', '2026-08-16T06:00:00Z')] };
  assert.equal(mySlot(event, ['goproflowyo']).starttime.toISOString(), '2026-08-16T06:00:00.000Z');
  assert.equal(mySlot(event, ['GOPROFLOWYO', 'other']).starttime.toISOString(), '2026-08-16T06:00:00.000Z');
  // The display name may differ from the login — any candidate may match.
  assert.equal(mySlot(event, ['some_login', 'dj alpha']).starttime.toISOString(), '2026-08-15T10:00:00.000Z');
});

test('mySlot ignores open slots and returns null when the streamer is not in the lineup', () => {
  const event = { slots: [slot('GoProFlowYo', '2026-08-15T10:00:00Z', false), slot('DJ Alpha', '2026-08-15T11:00:00Z')] };
  assert.equal(mySlot(event, ['goproflowyo']), null, 'an OPEN slot is nobody\'s');
  assert.equal(mySlot(event, ['stranger']), null);
  // Fail-soft on absent data: no event, no slots, no candidates.
  assert.equal(mySlot(null, ['goproflowyo']), null);
  assert.equal(mySlot({}, ['goproflowyo']), null);
  assert.equal(mySlot(event, []), null);
  assert.equal(mySlot(event, [null, undefined]), null);
});

// ---- card paging (many upcoming trains must not grow the card) ----

import { visibleUpcoming, upcomingPages, CARD_MAX_ROWS } from '../src/live-link.js';

test('visibleUpcoming shows everything when it fits — no paging needed', () => {
  assert.equal(CARD_MAX_ROWS, 3);
  assert.deepEqual(visibleUpcoming(UP.slice(0, 2), 0).map((e) => e.slug), ['a', 'b']);
  assert.deepEqual(visibleUpcoming(UP.slice(0, 3), 7).map((e) => e.slug), ['a', 'b', 'c']);
});

test('visibleUpcoming pages by CARD_MAX_ROWS — never a wrapped window', () => {
  // PAGES, not a sliding window: sliding by one wraps the end of the list
  // around to the front (`7,8,1` then `8,1,2` with 8 trains), so a
  // chronological list stops reading chronologically twice per lap.
  assert.deepEqual(visibleUpcoming(UP, 0).map((e) => e.slug), ['a', 'b', 'c']);
  assert.deepEqual(visibleUpcoming(UP, 1).map((e) => e.slug), ['d']);
  // The offset wraps by page count: any integer is safe to feed back in forever.
  assert.deepEqual(visibleUpcoming(UP, 2).map((e) => e.slug), ['a', 'b', 'c']);
  assert.deepEqual(visibleUpcoming(UP, -1).map((e) => e.slug), ['d']);
});

test('visibleUpcoming with 8 trains: 3 chronological pages, every train shown once per lap', () => {
  const eight = Array.from({ length: 8 }, (_, i) => summary(`t${i + 1}`, `2026-08-1${i}T00:00:00Z`, `2026-08-1${i}T06:00:00Z`));
  assert.equal(upcomingPages(eight), 3);
  assert.deepEqual(visibleUpcoming(eight, 0).map((e) => e.slug), ['t1', 't2', 't3']);
  assert.deepEqual(visibleUpcoming(eight, 1).map((e) => e.slug), ['t4', 't5', 't6']);
  assert.deepEqual(visibleUpcoming(eight, 2).map((e) => e.slug), ['t7', 't8']);
});

test('upcomingPages is at least 1, even for an empty or short list', () => {
  assert.equal(upcomingPages([]), 1);
  assert.equal(upcomingPages(UP.slice(0, 2)), 1);
  assert.equal(upcomingPages(UP), 2);
});

// ---- upcomingRows: the Upcoming card's rows, for both surfaces ----
//
// The Overlay's card and the Configurator's Preview render the same rows
// through this one builder, so a change to how a departure reads lands on the
// stream and in the pane at once. Pinned to a fixed locale and zone here — the
// point of the parameters is that output does not depend on the machine.

import { upcomingRows } from '../src/live-link.js';

const ROW_OPTS = { locale: 'en-US', zone: 'America/Los_Angeles' };
const train = (title, start, extra = {}) => ({ slug: title, title, starttime: at(start), ...extra });

test('upcomingRows renders one instant as its zoned time and its UTC anchor', () => {
  // 20:00 UTC is 13:00 the same day in Los Angeles, so both readings agree on
  // the day and the anchor is a bare clock time.
  const [row] = upcomingRows([train('House Is A Feeling', '2026-08-07T20:00:00Z')], ROW_OPTS);
  assert.equal(row.title, 'House Is A Feeling');
  // Every numeric field 2-digit and the zone NAMED — a bare clock on stream is
  // ambiguous, and the constant width keeps the time column from drifting.
  assert.match(row.when, /^Fri, Aug 07, 01:00\sPM PDT$/);
  assert.equal(row.utc, '20:00 UTC');
});

test('upcomingRows reads the instant in the zone it is given, not the machine\'s', () => {
  const trains = [train('Sunday Slow Burn', '2026-08-07T20:00:00Z')];
  const [pacific] = upcomingRows(trains, ROW_OPTS);
  const [tokyo] = upcomingRows(trains, { locale: 'en-US', zone: 'Asia/Tokyo' });
  assert.match(tokyo.when, /^Sat, Aug 08, 05:00\sAM GMT\+9$/);
  assert.notEqual(tokyo.when, pacific.when);
  // Same instant, so the same UTC clock time either way — that is what the
  // anchor is for. Tokyo's reading has already crossed into Saturday, so its
  // anchor also says which day it means; Pacific's has not, so it does not.
  assert.equal(tokyo.utc, 'Fri 20:00 UTC');
  assert.equal(pacific.utc, '20:00 UTC');
});

test('upcomingRows names the weekday on the UTC anchor only when UTC lands on another day', () => {
  // 21:30 Friday in Los Angeles is already Saturday in UTC, so the anchor says
  // which Saturday it means; the same-day row above carries no weekday.
  const [crossing] = upcomingRows([train('Trainwreck Lucky 13', '2026-08-08T04:30:00Z')], ROW_OPTS);
  assert.match(crossing.when, /^Fri, Aug 07, 09:30\sPM PDT$/);
  assert.equal(crossing.utc, 'Sat 04:30 UTC');
  const [sameDay] = upcomingRows([train('House Is A Feeling', '2026-08-07T20:00:00Z')], ROW_OPTS);
  assert.equal(sameDay.utc, '20:00 UTC');
});

test('upcomingRows says when the streamer PLAYS: mySlotAt wins over the train\'s departure', () => {
  // The card answers "when am I on", so the streamer's own slot start — the
  // annotation the Live Link feed makes from the Event's lineup — beats the
  // train's departure wherever it is known.
  const departs = '2026-08-07T20:00:00Z';
  const [mine] = upcomingRows([train('Sunday Slow Burn', departs, { mySlotAt: at('2026-08-07T23:00:00Z') })], ROW_OPTS);
  assert.equal(mine.utc, '23:00 UTC');
  assert.match(mine.when, /^Fri, Aug 07, 04:00\sPM PDT$/);
  // Unknown slot (the lineup has not loaded, or the streamer is not on it) →
  // the departure, unchanged.
  const [fallback] = upcomingRows([train('Sunday Slow Burn', departs)], ROW_OPTS);
  assert.equal(fallback.utc, '20:00 UTC');
});

test('upcomingRows is a pure mapping: one row per train, in order, nothing mutated', () => {
  const trains = [train('a', '2026-08-07T20:00:00Z'), train('b', '2026-08-09T06:00:00Z')];
  const before = JSON.stringify(trains);
  const rows = upcomingRows(trains, ROW_OPTS);
  assert.deepEqual(rows.map((r) => r.title), ['a', 'b']);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['title', 'utc', 'when']);
  assert.deepEqual(upcomingRows([], ROW_OPTS), []);
  assert.equal(JSON.stringify(trains), before);
});

test("upcomingRows with no zone reads the machine's own clock — the fallback the card documents", () => {
  // The one rule the zone-explicit tests above cannot state: a falsy `zone`
  // means the machine's zone, for the UTC anchor's weekday as much as for the
  // zoned reading. Asserted as an equivalence, not a literal, so it holds
  // wherever the suite runs — no process.env.TZ, no zone-pinned expectations.
  const trains = [train('same-day', '2026-08-07T20:00:00Z'), train('crosses-midnight', '2026-08-08T04:30:00Z')];
  const machine = Intl.DateTimeFormat().resolvedOptions().timeZone;
  assert.deepEqual(
    upcomingRows(trains, { locale: 'en-US' }),
    upcomingRows(trains, { locale: 'en-US', zone: machine }),
  );
  // And with no options at all — the `= {}` default, which nothing else reaches.
  assert.deepEqual(upcomingRows(trains), upcomingRows(trains, {}));
});
