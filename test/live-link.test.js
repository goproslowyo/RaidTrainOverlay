import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEAD_MS, encodeTrainMap, decodeTrainMap, resolveLiveTrain, effectiveQuery,
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
  assert.deepEqual(resolveLiveTrain([], NOW), { state: 'idle', train: null, upcoming: [] });
});

test('resolveLiveTrain picks the EARLIEST-started live train when two overlap', () => {
  const events = [
    summary('second', '2026-08-07T19:00:00Z', '2026-08-08T02:00:00Z'),
    summary('first', '2026-08-07T18:00:00Z', '2026-08-08T01:00:00Z'),
  ];
  assert.equal(resolveLiveTrain(events, NOW).train.slug, 'first');
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
