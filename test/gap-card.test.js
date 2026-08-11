import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createGapCard, gapCardPlan } from '../src/gap-card.js';
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

// ---------------------------------------------------------------------------
// The apply half: the **Stage choreography** itself.
//
// These stop at the edge of layout — `linkedom` has no layout engine, so
// `offsetWidth` and `getBoundingClientRect()` read 0 and nothing here may
// assert on painted geometry. What they CAN hold honest is the structure the
// guarantee rests on: that the card gets a layer of its own beside the Train
// rather than inside it, that the presence keyframe is written once per module
// into the mount's own Document, that a `restart` re-seeds it and a `refresh`
// never does, and which Stage the **Breather** switch is worked on. Whether
// the card is truly never on screen with a Train — the phase rule as OBSERVED
// — stays the browser sweep's job.

/** The mount a real Overlay hands this module: overlay.html's #train. */
const scene = () => parseHTML(
  '<!doctype html><html><head></head><body><div id="train"></div></body></html>',
).document;

/** Enough config to mount the card as well as plan it. */
const MOUNTABLE = { ...LIVE, t: (key) => key, locale: 'en-US', uppos: 'bc' };

/** Trains for the Horizon — three Pages' worth, so the page count is visible. */
const HORIZON = Array.from({ length: 9 }, (_, i) => ({
  slug: `train-${i}`,
  title: `Night Run ${i}`,
  starttime: new Date(Date.UTC(2026, 7, 14 + i, 20, 0, 0)),
}));

/**
 * A stand-in for renderTrain's handle. The tagged timing and the Breather
 * switch travel together because both belong to the Stage that render built,
 * and this records every throw of the switch so a test can say which Stage was
 * worked and in which order.
 */
const handle = (timing) => {
  const breathers = [];
  return { timing, breathers, setBreather(on) { breathers.push(on); } };
};

/** The presence class: the card's whole appearance, as one opacity keyframe. */
const ON = 'rt-gap-card--on';

/**
 * A mounted Overlay: the Train's container and the choreographer beside it.
 *
 * Torn down with the idle call, because a standing card view pages on a real
 * interval and only retiring it stops the clock. Registered on the test rather
 * than called at the end, so a failing assertion reports instead of hanging the
 * runner on a timer nobody cleared.
 */
function overlay(t) {
  const page = scene();
  const container = page.getElementById('train');
  const gap = createGapCard({ container, config: MOUNTABLE });
  t.after(() => gap.restart(null, []));
  return { page, container, gap, layer: container.nextElementSibling };
}

test('the choreographer lays its own full-canvas layer beside the Train', () => {
  // Beside, never inside: the card's own render dissolves whatever else holds
  // its container, and inside #train that would be the Train. The layer is why
  // "never on stage together" can be a timing guarantee instead of a
  // mount-and-unmount one.
  const page = scene();
  const container = page.getElementById('train');

  createGapCard({ container, config: MOUNTABLE });

  const layer = container.nextElementSibling;
  assert.ok(layer, 'no layer was laid beside the Train');
  assert.equal(layer.parentNode, container.parentNode, 'the layer must be a sibling of the Train');
  assert.equal(layer, page.getElementById('gap-card'), 'the layer belongs to the mount Document');
  assert.match(layer.getAttribute('style'), /position:absolute/);
  assert.match(layer.getAttribute('style'), /inset:0/, 'the layer is the whole canvas');
  assert.match(layer.getAttribute('style'), /pointer-events:none/);
});

test('a restart mounts the card and writes one opacity keyframe on the Pass period', (t) => {
  const { page, gap, layer } = overlay(t);
  const view = handle(PASS);

  gap.restart(view, HORIZON);

  const style = page.getElementById('rt-gap-card-style');
  assert.ok(style, 'the generated stylesheet never reached the mount Document');
  assert.match(style.textContent, /@keyframes rt-gap-card/, 'presence is one generated keyframe');
  assert.match(
    style.textContent,
    new RegExp(`\\.rt-gap-card--on \\{ animation: rt-gap-card ${PASS.periodSec}s linear infinite`),
    'the card must share the Pass period, or it drifts off it',
  );
  assert.ok(layer.classList.contains(ON), 'the card was never switched on');
  assert.ok(layer.querySelector('.rt-upcoming-card'), 'the card never mounted onto the layer');
  assert.deepEqual(view.breathers, [true], 'the Breather is switched on for the card to appear in');
});

test('a restart with nothing to show clears the layer and lets the Train back up', (t) => {
  // An empty Horizon: a Breather here would be the Train vanishing for no
  // reason, so the empty stretch is suppressed along with the card.
  const { gap, layer } = overlay(t);
  const view = handle(BREATHER);

  gap.restart(view, []);

  assert.equal(layer.classList.contains(ON), false, 'nothing to show, yet the layer was switched on');
  assert.equal(layer.querySelector('.rt-upcoming-card'), null, 'a card was mounted with no Horizon');
  assert.deepEqual(view.breathers, [false], 'the Breather must be switched off, not left standing');
});

test('a restart re-seeds the presence keyframe; a refresh never touches it', (t) => {
  // This is the phase rule as an interface: only a render restarts the Train's
  // own keyframe, so only a restart may re-seed the card's. A Horizon change
  // reaches the running animation through the keyframe TEXT, which CSS re-reads
  // in place.
  const { page, gap, layer } = overlay(t);

  gap.restart(handle(PASS), HORIZON);

  // Count re-seeds from here: taking the class off and putting it back is what
  // starts the animation over.
  const tokens = layer.classList;
  const real = tokens.remove.bind(tokens);
  let reseeds = 0;
  tokens.remove = (...names) => { reseeds += names.filter((n) => n === ON).length; return real(...names); };
  const before = page.getElementById('rt-gap-card-style').textContent;

  gap.refresh(HORIZON.slice(0, 2)); // three Pages down to one

  assert.equal(reseeds, 0, 'a refresh restarted the animation — the card can now land on a Train');
  assert.ok(layer.classList.contains(ON), 'the refresh left the card switched off');
  assert.notEqual(
    page.getElementById('rt-gap-card-style').textContent, before,
    'the shorter Horizon never reached the keyframe',
  );

  gap.restart(handle(PASS), HORIZON);

  assert.equal(reseeds, 1, 'a restart must re-seed, or the card falls out of phase with the new Pass');
  assert.ok(layer.classList.contains(ON), 'the restart left the card switched off');
});

test('nothing running: the Stage still on screen is let back up before it is dropped', (t) => {
  // Idle arrives with the previous render still painted. The Breather switch
  // is bound to THAT Stage, so it has to be thrown before the handle goes.
  const { gap, layer } = overlay(t);
  const view = handle(BREATHER);
  gap.restart(view, HORIZON);
  assert.deepEqual(view.breathers, [true]);

  gap.restart(null, []); // the idle call: nothing is running any more

  assert.deepEqual(view.breathers, [true, false], 'the outgoing Stage was left in its Breather');
  assert.equal(layer.classList.contains(ON), false, 'the card outlived the Train it belonged to');
});

test('a refresh that brings the card back starts it in phase with the Pass, not from zero', (t) => {
  // The Horizon is routinely empty at render time and arrives moments later, so
  // a refresh does have to be able to switch presence ON. Starting the keyframe
  // where it is by now — from the render the Train's own keyframe started at —
  // is the only way to do that without landing the card on a Train.
  const { gap, layer } = overlay(t);
  // The wall clock is the only way to say how far into the Pass we are, so the
  // test drives it: five minutes pass between the render and the Horizon.
  const realNow = Date.now;
  t.after(() => { Date.now = realNow; });
  let clock = realNow();
  Date.now = () => clock;

  gap.restart(handle(PASS), []);
  assert.equal(layer.classList.contains(ON), false, 'an empty Horizon put the card on');
  clock += 300_000;

  gap.refresh(HORIZON);

  assert.ok(layer.classList.contains(ON), 'the card never came back when its Horizon arrived');
  assert.equal(
    layer.style.animationDelay, '-300.000s',
    'presence started from 0%, which is the Pass the Train is five minutes into',
  );
});

/** A driven wall clock: the seed is a clock read, so a test has to own the clock. */
function clock(t) {
  const real = Date.now;
  t.after(() => { Date.now = real; });
  let at = real();
  Date.now = () => at;
  return { pass: (ms) => { at += ms; } };
}

test('a Horizon that empties and refills under a Pass keeps the render as the epoch', (t) => {
  // `rt-pass` runs on regardless of what the Horizon does, so the period never
  // restarted and the card's seed must not move: it comes back exactly as far
  // into the Pass as the Train is.
  const { gap, layer } = overlay(t);
  const time = clock(t);

  gap.restart(handle(PASS), HORIZON);
  time.pass(60_000);
  gap.refresh([]); // one resolve tick with nothing to list
  time.pass(30_000);
  gap.refresh(HORIZON); // and the next has the Horizon back

  assert.ok(layer.classList.contains(ON), 'the card never came back when its Horizon returned');
  assert.equal(
    layer.style.animationDelay, '-90.000s',
    'the card was re-seeded on a period that never restarted — it can now land on a Train',
  );
});

test('a returning Breather re-seeds the card, because it re-seeds the card\'s period', (t) => {
  // The other way the rule bites, and the reason it is written as "the period it
  // is timed against" rather than "a render". On marquee the card shares the
  // BREATHER, and `rt-stage--breather` carries that keyframe — so switching the
  // Breather back on restarts the period from 0%. Hold the card at the old
  // epoch and the two are timed to different moments (measured in a browser at
  // ~2.4s apart, #85), which puts the card on screen over a Train that has not
  // finished fading out.
  const { gap, layer } = overlay(t);
  const time = clock(t);
  const view = handle(BREATHER);

  gap.restart(view, HORIZON);
  time.pass(40_000);
  gap.refresh([]);
  assert.deepEqual(view.breathers.slice(), [true, false], 'the Breather outlived the card it was made for');
  time.pass(20_000);
  gap.refresh(HORIZON);

  assert.deepEqual(
    view.breathers.slice(), [true, false, true],
    'the Breather never came back for the card',
  );
  assert.ok(layer.classList.contains(ON), 'the card never came back when its Horizon returned');
  assert.equal(
    layer.style.animationDelay, '-0.000s',
    'the card kept the old epoch while its Breather started over',
  );
});

test('a Horizon change that never empties leaves the Breather, and the card, alone', (t) => {
  // Nothing restarted, so nothing re-seeds: the shorter Horizon reaches the
  // running card through the keyframe text alone.
  const { gap, layer } = overlay(t);
  const time = clock(t);
  const view = handle(BREATHER);

  gap.restart(view, HORIZON);
  time.pass(40_000);
  gap.refresh(HORIZON.slice(0, 2));

  // The switch is thrown ON again, which `classList.toggle` makes a no-op on a
  // class already there — so the keyframe underneath never restarts. What would
  // restart it is an OFF in between, and there is none.
  assert.equal(
    view.breathers.filter((on) => on === false).length, 0,
    'the Breather was let go for a mere Horizon change, restarting the card\'s period',
  );
  assert.equal(
    layer.style.animationDelay, '',
    'the card was re-seeded although its Breather ran straight through',
  );
});
