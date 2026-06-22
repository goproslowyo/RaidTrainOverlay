import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeManualEvent, normalizeHandle, parseLine, zonedWallClockToInstant, instantToZonedWallClock } from '../src/manual-lineup.js';
import { buildTrain } from '../src/lineup-engine.js';

const CFG = { event: 'x' };

test('makeManualEvent produces the normalized Event shape buildTrain consumes', () => {
  const model = { t: 'My Train', o: { n: 'host', i: 'a.png' }, z: 'UTC', s: '2026-06-27T18:00:00.000Z', d: [{ h: 'alice', d: 60 }] };
  const ev = makeManualEvent(model, new Date('2026-06-27T17:00:00Z'));
  assert.equal(ev.title, 'My Train');
  assert.deepEqual(ev.organiser, { displayName: 'host', image: 'a.png', link: '', timezone: 'UTC' });
  assert.equal(ev.slotDurationMins, 60);
  assert.equal(ev.slots.length, 1);
  assert.equal(ev.slots[0].occupied, true);
  assert.equal(ev.slots[0].broadcaster.displayName, 'alice');
  assert.equal(ev.slots[0].starttime.toISOString(), '2026-06-27T18:00:00.000Z'); // absolute instant from `s`
});

test('GCD base-slot expansion: a mixed-duration lineup expands to uniform slots', () => {
  // 120 + 60 + 90 → base = gcd = 30 → 4 + 2 + 3 = 9 slots.
  const model = { t: 'T', o: { n: 'h' }, z: 'UTC', s: '2026-06-27T18:00:00.000Z', d: [{ h: 'a', d: 120 }, { h: 'b', d: 60 }, { h: 'c', d: 90 }] };
  const ev = makeManualEvent(model, new Date());
  assert.equal(ev.slotDurationMins, 30);
  assert.equal(ev.slots.length, 9);
  // Slots are sequential, 30 min apart, in order.
  assert.equal(ev.slots[1].starttime.getTime() - ev.slots[0].starttime.getTime(), 30 * 60_000);
});

test('makeManualEvent emits NO broadcaster.id, so back-to-back sets merge into one Car by name', () => {
  const model = { t: 'T', o: { n: 'h' }, z: 'UTC', s: '2026-06-27T18:00:00.000Z', d: [{ h: 'alice', d: 120 }, { h: 'bob', d: 60 }] };
  const ev = makeManualEvent(model, new Date());
  // alice = 2 slots, bob = 1 → 3 raw slots, none carrying an id.
  assert.equal(ev.slots.length, 3);
  assert.ok(ev.slots.every((s) => s.broadcaster.id === undefined), 'manual slots carry no broadcaster.id');
  // buildTrain merges alice's two consecutive same-name slots into ONE car.
  const train = buildTrain(ev, new Date('2026-06-27T17:00:00Z'), CFG);
  assert.deepEqual(train.cars.map((c) => c.broadcaster.displayName), ['alice', 'bob']);
});

test('makeManualEvent snaps odd/degenerate durations to a 30-min grid so the slot count never explodes', () => {
  // 50m, 0, -30, NaN: a naive gcd of these would be tiny (1 or 10) → hundreds of slots.
  // Snapping each to the 30-min grid (min 30) keeps the base ≥ 30 and the count bounded.
  const model = { t: 'T', o: { n: 'h' }, z: 'UTC', s: '2026-06-27T18:00:00.000Z', d: [{ h: 'a', d: 50 }, { h: 'b', d: 0 }, { h: 'c', d: -30 }, { h: 'd', d: NaN }] };
  const ev = makeManualEvent(model, new Date());
  assert.ok(ev.slotDurationMins >= 30, `base slot ${ev.slotDurationMins} should be ≥ 30`);
  assert.ok(ev.slots.length <= 8, `slot count should stay bounded, got ${ev.slots.length}`);
  // 50→60 (2 slots at a 30 base), the three degenerate ones → 30 (1 slot each) = 5 total.
  assert.equal(ev.slots.length, 5);
});

test('makeManualEvent caps a DJ at 12 slots (matching the editor), so a hand-crafted big-duration link never diverges', () => {
  // base = gcd(720, 30) = 30 → DJ "a" would be 24 slots; capped to 12 so the overlay
  // renders what the editor (clampCount 1..12) shows for the same link.
  const model = { t: 'T', o: { n: 'h' }, z: 'UTC', s: '2026-06-27T18:00:00.000Z', d: [{ h: 'a', d: 720 }, { h: 'b', d: 30 }] };
  const ev = makeManualEvent(model, new Date());
  assert.equal(ev.slotDurationMins, 30);
  assert.equal(ev.slots.filter((s) => s.broadcaster.displayName === 'a').length, 12);
  assert.equal(ev.slots.length, 13); // 12 + 1
});

test('normalizeHandle strips @, twitch.tv URLs, and spaces', () => {
  assert.equal(normalizeHandle('@nikkid'), 'nikkid');
  assert.equal(normalizeHandle('https://twitch.tv/nikkid'), 'nikkid');
  assert.equal(normalizeHandle('https://www.twitch.tv/NikkiD/?x=1'), 'NikkiD');
  assert.equal(normalizeHandle('  spaced out  '), 'spaced');
  assert.equal(normalizeHandle(''), '');
});

test('parseLine reads a handle and an optional human duration suffix (default 60)', () => {
  assert.deepEqual(parseLine('nikkid'), { handle: 'nikkid', mins: 60 });
  assert.deepEqual(parseLine('nikkid 2h'), { handle: 'nikkid', mins: 120 });
  assert.deepEqual(parseLine('nikkid 90m'), { handle: 'nikkid', mins: 90 });
  assert.deepEqual(parseLine('nikkid 1h30'), { handle: 'nikkid', mins: 90 });
  assert.deepEqual(parseLine('nikkid 1.5h'), { handle: 'nikkid', mins: 90 });
  assert.deepEqual(parseLine('https://twitch.tv/basslines 3h'), { handle: 'basslines', mins: 180 });
  assert.equal(parseLine('   '), null);
});

test('zonedWallClockToInstant turns a wall clock in a zone into an absolute UTC instant, DST-aware', () => {
  // Summer (EDT = UTC-4): 8 PM New York → midnight UTC.
  assert.equal(zonedWallClockToInstant('2026-06-27T20:00', 'America/New_York'), '2026-06-28T00:00:00.000Z');
  // Winter (EST = UTC-5): 8 PM New York → 1 AM UTC. Different offset proves zone+DST awareness.
  assert.equal(zonedWallClockToInstant('2026-01-15T20:00', 'America/New_York'), '2026-01-16T01:00:00.000Z');
  // UTC is identity.
  assert.equal(zonedWallClockToInstant('2026-06-27T20:00', 'UTC'), '2026-06-27T20:00:00.000Z');
});

test('instantToZonedWallClock is the inverse — a wall clock round-trips through its zone', () => {
  for (const [wall, zone] of [['2026-06-27T20:00', 'America/New_York'], ['2026-01-15T08:30', 'Europe/Paris'], ['2026-06-27T20:00', 'UTC']]) {
    assert.equal(instantToZonedWallClock(zonedWallClockToInstant(wall, zone), zone), wall);
  }
});
