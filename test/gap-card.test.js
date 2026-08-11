import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gapCardPlan } from '../src/gap-card.js';
import { breatherCycle } from '../src/gap-choreography.js';

// Every rule about whether the Upcoming card may take the Stage at all while a
// Train is running. These are settled product rules that used to live in the
// shell's inline wiring, where nothing could import them — so each guard gets
// its own case here, and dropping any one of them turns a test red.
//
// The plan is pure: no DOM, no clock, no storage. Whether the card LOOKS right
// on the canvas, and whether it truly never shares the Stage with a Train, stay
// the browser sweep's job.

/** A Live Link source with the card allowed in the pauses while a train runs. */
const LIVE = {
  user: 'nightowl',
  upcoming: { kind: 'count', n: 3 },
  upgap: true,
  uponly: false,
  upcycle: 12,
  upstyle: 'card',
  upscroll: 34,
};

/** A roomy Pass gap: a 15-minute interval, ~50s of traversal, default rail fades. */
const PASS = Object.freeze({
  kind: 'pass', periodSec: 900, emptyFromSec: 60, emptyToSec: 885,
});

/** The empty stretch a marquee cycle manufactures for itself. */
const BREATHER = Object.freeze({ kind: 'breather', ...breatherCycle({ upcycleSec: 12 }) });

/** The default ask: a running Pass, a Horizon of nine trains, the card allowed. */
const plan = (over = {}) => gapCardPlan({
  timing: PASS, horizonLength: 9, config: LIVE, ...over,
});

test('a roomy Pass gap with a Horizon to show puts the card on', () => {
  const p = plan();
  assert.equal(p.show, true);
  assert.ok(p.schedule.windows.length > 0, 'a plan that shows must say when');
  assert.equal(p.schedule.cycleSec, PASS.periodSec, 'the card shares the Pass period');
});

test('no Live Link login: nothing else knows there are other trains', () => {
  // The Horizon is a Live Link concept — resolving "next" needs a Profile — so
  // an ?event= or ?lineup= source has no between-Pass card at all.
  assert.deepEqual(plan({ config: { ...LIVE, user: '' } }), { show: false });
});

test('an upcoming-only source keeps to the one thing it exists to show', () => {
  // That scene shows the card outright; there is no Train to step aside for.
  assert.deepEqual(plan({ config: { ...LIVE, uponly: true } }), { show: false });
});

test('the opt-out (upgap=0) leaves the gap exactly as it was', () => {
  assert.deepEqual(plan({ config: { ...LIVE, upgap: false } }), { show: false });
});

test('no Occasion at all: without ?upcoming= the card never appears', () => {
  // The three-way is carried by two params: no `upcoming` is *never*, and only
  // then does `upgap` choose between the remaining two.
  assert.deepEqual(plan({ config: { ...LIVE, upcoming: null } }), { show: false });
});

test('nothing running: no Stage was built, so there is no gap to plan into', () => {
  // The shell has no render handle to read a timing off, and the card belongs
  // to a running train.
  assert.deepEqual(plan({ timing: null }), { show: false });
  assert.deepEqual(plan({ timing: undefined }), { show: false });
});

test('a render that hands back no empty stretch gets no card', () => {
  // `none` covers both preview paths and a marquee whose Breather is opted out.
  assert.deepEqual(plan({ timing: { kind: 'none' } }), { show: false });
});

test('an empty Horizon shows nothing rather than an empty slab', () => {
  assert.deepEqual(plan({ horizonLength: 0 }), { show: false });
});

test('a Breather holds exactly one Page; a Pass gap offers the whole count', () => {
  // A Breather's length is ours to choose, so it stays short and constant and
  // the rest of the Horizon rotates across successive Breathers. A Pass gap is
  // imposed on us, so the card uses as much of it as whole Pages allow.
  const nine = { horizonLength: 9 }; // three Pages of three
  assert.equal(plan({ ...nine, timing: BREATHER }).schedule.pages, 1);
  assert.equal(plan({ ...nine, timing: PASS }).schedule.pages, 3);
});

test('a Breather holds one Page however long the Horizon runs', () => {
  for (const horizonLength of [1, 4, 9, 40]) {
    assert.equal(plan({ horizonLength, timing: BREATHER }).schedule.pages, 1, `${horizonLength} trains`);
  }
});

test('a stretch too short for one whole Page sits out rather than flashing part of one', () => {
  // A 60-second Pass interval with a ~50s traversal: by the time the rails have
  // gone there is no room for a whole Page, so the card sits the gap out.
  const tight = { kind: 'pass', periodSec: 60, emptyFromSec: 52, emptyToSec: 58 };
  assert.deepEqual(plan({ timing: tight }), { show: false });
});

test('the plan reads its inputs and touches nothing', () => {
  const config = Object.freeze({ ...LIVE });
  const p = gapCardPlan({ timing: PASS, horizonLength: 9, config });
  assert.equal(p.show, true);
  assert.deepEqual(config, { ...LIVE }, 'the config came back unchanged');
  assert.deepEqual(
    gapCardPlan({ timing: PASS, horizonLength: 9, config }),
    p,
    'the same question twice gives the same answer',
  );
});

test('the scrolling view is planned in whole Laps, and sits out when one will not fit', () => {
  const config = { ...LIVE, upstyle: 'ticker', upscroll: 34 };
  assert.equal(plan({ config }).show, true);
  const slow = { ...config, upscroll: 120 };
  const tight = { kind: 'pass', periodSec: 180, emptyFromSec: 60, emptyToSec: 170 };
  assert.deepEqual(plan({ config: slow, timing: tight }), { show: false });
});
