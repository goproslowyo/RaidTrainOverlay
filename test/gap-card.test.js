import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createGapCard, gapCardPlan, reseedsKeyframe } from '../src/gap-card.js';
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

// The phase rule on its own, before any of that: one predicate over the moment,
// which is the only part of the guarantee a DOM-free test can ask directly.

test('a render moves the epoch, whatever it built and whatever was already on', () => {
  // A render restarts `rt-pass` with the Stage it built, so the epoch moves for
  // it every time — including on a marquee Stage, and including when a Breather
  // was already standing from the Stage before.
  assert.equal(reseedsKeyframe({ rendered: true, timingKind: 'pass' }), true);
  assert.equal(reseedsKeyframe({ rendered: true, timingKind: 'breather' }), true);
  assert.equal(reseedsKeyframe({ rendered: true, timingKind: 'breather', breatherWasOn: true }), true);
  assert.equal(
    reseedsKeyframe({ rendered: true, timingKind: null }), true,
    'a render that built no Stage at all still re-seeded the one it replaced',
  );
});

test('a Horizon refresh under a Pass never moves the epoch', () => {
  // `rt-pass` runs on regardless of what the Horizon does. Moving the epoch here
  // is the divergence #85 measured: the card comes back timed against this
  // instant rather than against the Pass, and can then appear ON a Train.
  assert.equal(reseedsKeyframe({ rendered: false, timingKind: 'pass' }), false);
  assert.equal(reseedsKeyframe({ rendered: false, timingKind: 'pass', breatherWasOn: true }), false);
});

test('a Breather switched back on moves the epoch: it IS the card\'s period', () => {
  // `rt-stage--breather` carries the `rt-breather` keyframe, so the class
  // landing starts that period from 0%. The card's epoch moves with it or the
  // two are timed to moments ~2.4s apart (#85).
  assert.equal(reseedsKeyframe({ rendered: false, timingKind: 'breather', breatherWasOn: false }), true);
});

test('a Breather that kept running moves nothing', () => {
  // Nothing restarted: the shorter Horizon reaches the card through the
  // keyframe text, and the card stays where its Breather has got to.
  assert.equal(reseedsKeyframe({ rendered: false, timingKind: 'breather', breatherWasOn: true }), false);
});

test('the phase rule is pure, and an unknown moment moves no epoch', () => {
  // No DOM, no clock, no storage — and called on nothing at all it says no,
  // which is the safe answer: a wrong yes is what puts the card on a Train.
  assert.equal(reseedsKeyframe(), false);
  assert.equal(reseedsKeyframe({}), false);
  const moment = { rendered: false, timingKind: 'breather', breatherWasOn: false };
  assert.equal(reseedsKeyframe(moment), true);
  assert.deepEqual(moment, { rendered: false, timingKind: 'breather', breatherWasOn: false });
});

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

test('an emptied Horizon leaves the retiring card nothing to paint it with', (t) => {
  // Presence coming off the layer is the layer losing its ONLY source of
  // opacity, and every element's base is 1 — so with no base of its own the
  // layer paints the card it is retiring at FULL opacity over the live Train
  // for the whole of that dissolve. Measured in a browser as 0 -> 1 in one
  // frame and 460ms of card over a Train, at every empty-Horizon tick outside
  // a window (#90). What a DOM with no layout engine can hold honest is the
  // two halves that make it possible: there IS still a card on the layer when
  // presence goes, and the stylesheet that carries the keyframe carries the
  // base the layer falls back to. That the flash is gone is the browser's word.
  const { page, gap, layer } = overlay(t);

  gap.restart(handle(PASS), HORIZON);
  assert.ok(layer.querySelector('.rt-upcoming-card'), 'no card was mounted, so none can be revealed');

  gap.refresh([]); // one resolve tick with nothing to list

  assert.equal(layer.classList.contains(ON), false, 'presence outlived the Horizon it was for');
  assert.ok(
    layer.firstElementChild,
    'the card left instantly — then there is nothing on the layer to reveal, and no bug',
  );
  assert.match(
    gapSheet(page).unconditional,
    /#gap-card \{ opacity: 0; \}/,
    'the layer has no base of its own: dropping presence paints the retiring card over the Train',
  );
});

/**
 * Every top-level at-rule block in `css`, as `{ prelude, body, from, to }`.
 * Brace-matched rather than pattern-matched, because the thing being asked is
 * structural: which declarations a viewer gets unconditionally, and which are
 * behind a condition. Nested at-rules are stepped over with their parent.
 */
function atRuleBlocks(css) {
  const blocks = [];
  for (let i = 0; i < css.length; i += 1) {
    if (css[i] !== '@') continue;
    const open = css.indexOf('{', i);
    if (open === -1) break;
    let depth = 0;
    let end = open;
    for (; end < css.length; end += 1) {
      if (css[end] === '{') depth += 1;
      else if (css[end] === '}' && (depth -= 1) === 0) break;
    }
    blocks.push({ prelude: css.slice(i, open).trim(), body: css.slice(open + 1, end), from: i, to: end + 1 });
    i = end;
  }
  return blocks;
}

/**
 * The generated sheet, as three things a test can ask about: the whole of it,
 * the part EVERY viewer gets whatever their settings (`unconditional` — the
 * sheet with every at-rule block cut out), and the body of the reduced-motion
 * block. Comments are stripped first, because a comment that quotes a rule is
 * not that rule, and this module's comments quote both of the rules asserted
 * below.
 *
 * Two things this helper insists on rather than assumes, and both are here
 * because the first version assumed them and went vacuous under a mutant.
 *
 * It was `css.indexOf('@media (prefers-reduced-motion: reduce)')` with an
 * `at === -1` fallback, which made the split silently optional: spell the query
 * `prefers-reduced-motion:reduce` — legal CSS, and what any reformat produces —
 * and the search misses, the base half quietly becomes the WHOLE sheet, the
 * reduced half becomes empty, and every assertion downstream passes against the
 * very mutant it was written for. So the block is found by pattern and its
 * absence is a failure HERE, not a pass downstream.
 *
 * And "outside the reduced-motion block" is not the property that matters —
 * "outside every at-rule" is. Wrapping the base in `@media print { … }` clears
 * the first bar and still hands a normal viewer no base at all, which is #90
 * back. So the unconditional half is the sheet with ALL at-rule blocks removed,
 * not the text before one of them.
 */
function gapSheet(page) {
  const css = (page.getElementById('rt-gap-card-style')?.textContent ?? '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks = atRuleBlocks(css);
  const reduced = blocks.find((b) => /prefers-reduced-motion/.test(b.prelude));
  assert.ok(reduced, 'the generated sheet has no reduced-motion block at all — the accommodation is gone');
  let unconditional = css;
  for (const block of [...blocks].reverse()) {
    unconditional = unconditional.slice(0, block.from) + unconditional.slice(block.to);
  }
  return { css, unconditional, reduced: reduced.body };
}

test('the layer\'s base is unconditional, and never outranks the presence keyframe', (t) => {
  // A family of mutants, opposite in effect and every one of them green until
  // now, because the rule was asserted by a substring match on the whole sheet
  // — which can say a declaration is PRESENT and nothing about where it landed
  // or how loud it is. Chrome measured each; the suite saw none of them.
  //
  // PUT THE BASE BEHIND A CONDITION and every viewer outside that condition
  // loses it, so the retiring card flashes at opacity 1 over the live Train
  // again (#90) — Chrome reads presence-off at 1.000, identical to the control
  // with no base at all. Two spellings of the same mutant got through: inside
  // the reduced-motion block, and inside `@media print`. Hence `unconditional`
  // means outside EVERY at-rule, not outside one named one.
  //
  // MAKE THE BASE `!important` and the failure inverts: a CSS animation
  // outranks a normal author declaration whatever its specificity, which is the
  // only reason an id rule may sit under a class's keyframe — but `!important`
  // outranks the animation too. The layer is pinned at 0 forever and the
  // Upcoming card NEVER APPEARS AGAIN (Chrome: mid-window opacity 1.000 -> 0).
  // That is the larger of the two, and its guard was spelling-bound: it
  // required a literal space in `#gap-card {`, so adding the minifier spelling
  // `#gap-card{opacity:0!important}` alongside the shipped base sailed through.
  // Nothing in this sheet may be `!important` — that is the rule, so that is
  // what is asserted, rather than one hand-spelled instance of breaking it.
  const { page, gap } = overlay(t);
  gap.restart(handle(PASS), HORIZON);
  const sheet = gapSheet(page);

  assert.match(
    sheet.unconditional, /#gap-card \{ opacity: 0; \}/,
    'the base is behind a condition: every viewer outside it gets the #90 flash back',
  );
  assert.doesNotMatch(
    sheet.reduced, /#gap-card\b/,
    'the reduced-motion block is carrying the layer base, which belongs to every viewer',
  );
  assert.doesNotMatch(
    sheet.css, /!\s*important/i,
    'an !important declaration here outranks the presence keyframe: the card would never appear again',
  );
  // And presence really is a keyframe, so the cascade fact above is the one
  // that matters: nothing else on the layer sets opacity back up.
  assert.match(sheet.unconditional, /\.rt-gap-card--on \{ animation: rt-gap-card /);
});

test('reduced motion drops the card\'s pulse instead of parking it on the Train', (t) => {
  // The accommodation itself, which nothing asserted: every guard on this sheet
  // said what must NOT be in the reduced-motion block, and none said the block
  // must exist or what it must do. Delete it outright and the whole suite stays
  // green while Chrome, run with --force-prefers-reduced-motion, reads the card
  // at 1.000 where the shipped build reads 0.000 — the card pulsing in and out
  // over a live stream for the one viewer who asked it not to. (The renderer's
  // own reduced-motion coverage is a DIFFERENT stylesheet and does not reach
  // here.) `gapSheet` now fails outright on a sheet with no such block; this
  // says what the block has to contain.
  const { page, gap } = overlay(t);
  gap.restart(handle(PASS), HORIZON);
  const sheet = gapSheet(page);

  assert.match(
    sheet.reduced, /\.rt-gap-card--on\s*\{/,
    'the reduced-motion block does not address the presence class, so it changes nothing',
  );
  assert.match(
    sheet.reduced, /animation:\s*none/,
    'the pulse survives reduced motion: the whole occasion IS the motion',
  );
  assert.match(
    sheet.reduced, /opacity:\s*0/,
    'the animation is dropped without saying where the layer rests: the card parks over the Train',
  );
});

test('the layer gets its base before it can ever be holding a card', (t) => {
  // `setGapStyle` runs only when the plan shows, so the base does not exist
  // until the first showing apply — and until it does, the layer is at the 1
  // every element has. What makes that harmless is only that `setGapStyle` runs
  // BEFORE `renderUpcomingCard`, one statement apart in `apply`. Swap the two
  // and there is a moment with a card on a layer that has no base yet. Nothing
  // named or tested that precedence.
  const { page, gap, layer } = overlay(t);
  const order = [];
  const headAppend = page.head.appendChild.bind(page.head);
  page.head.appendChild = (node) => {
    if (node.id === 'rt-gap-card-style') order.push('base');
    return headAppend(node);
  };
  const layerAppend = layer.appendChild.bind(layer);
  layer.appendChild = (node) => { order.push('card'); return layerAppend(node); };

  gap.restart(handle(PASS), HORIZON);

  assert.ok(order.includes('base'), 'the base sheet never reached the Document');
  assert.ok(order.includes('card'), 'no card was mounted, so there is no order to check');
  assert.ok(
    order.indexOf('base') < order.indexOf('card'),
    'a card was put on the layer before the layer had a base: it paints at full opacity until the sheet lands',
  );
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
  // Five minutes pass between the render and the Horizon, on the clock
  // `rt-gap-card` is actually timed by — see the fixture below.
  const time = clock(t);

  gap.restart(handle(PASS), []);
  assert.equal(layer.classList.contains(ON), false, 'an empty Horizon put the card on');
  time.pass(300_000);

  gap.refresh(HORIZON);

  assert.ok(layer.classList.contains(ON), 'the card never came back when its Horizon arrived');
  assert.equal(
    layer.style.animationDelay, '-300.000s',
    'presence started from 0%, which is the Pass the Train is five minutes into',
  );
});

/**
 * A driven clock for the card. The seed is a clock read, so a test has to own
 * the clock — and the one it has to own is the one `rt-gap-card` itself runs
 * on. That keyframe is timed by the **document timeline**, which is monotonic
 * and reached as `performance.now()`; the value this module writes is an
 * `animation-delay` on it. So the monotonic clock is what `pass` moves, and
 * `Date.now` is PINNED as a negative control: a build that seeded `seededAt`
 * from the wall clock sees no time pass at all through any test in this file,
 * writes a delay of `-0.000s`, and starts the card at the top of a cycle the
 * Pass is minutes into.
 *
 * `stepWallClock` moves the pinned wall clock without moving the real one,
 * which is the NTP step, the resume from suspend and the manual clock change
 * all at once. Nothing the card does may notice. Measured in headless Chrome on
 * the wall-clock build, skew driven at the moment the Horizon refills, as the
 * share of the Train's time on stage that the card was painted over it: in
 * phase 0.0%, a -100s step 18.0%, a suspend-resume of -1h 50.7%, +140s 50.3%.
 *
 * Both are globals, restored after each test. `linkedom`'s
 * `defaultView.performance` forwards to the global one — even a property
 * defined on the view writes through — so this seam cannot tell "this
 * Document's window" from "the ambient global". That half of the rule needs two
 * real windows with two `timeOrigin`s and is measured in a browser instead.
 *
 * The twin of this fixture lives in test/train-timing.test.js, driving the same
 * two globals for the Breather. Duplicated on purpose: a fixture that two
 * suites share is a third thing to keep in step, and the whole of what these
 * two have in common is nine lines of global-shadowing. Change one and look at
 * the other.
 */
function clock(t) {
  // `performance.now` lives on the prototype and is not assignable, so it is
  // shadowed with an own property and the shadow deleted afterwards.
  const realDateNow = Date.now;
  let at = performance.now();
  let wall = realDateNow();
  t.after(() => { delete performance.now; Date.now = realDateNow; });
  Object.defineProperty(performance, 'now', { value: () => at, configurable: true, writable: true });
  Date.now = () => wall;
  return {
    // Only the monotonic clock moves. That is what makes the pin a control
    // rather than decoration: read the wall clock and every `pass` below is
    // worth nothing.
    pass: (ms) => { at += ms; },
    stepWallClock: (ms) => { wall += ms; },
  };
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

test('the card\'s phase is read off a monotonic clock, never the wall clock', (t) => {
  // The same defect as #88, in the module where it matters more. The value this
  // writes is an `animation-delay` on `rt-gap-card`, which runs on the document
  // timeline — monotonic. The wall clock is not: an OBS source runs for days
  // past NTP steps (Windows steps rather than slews once it is 128 ms out),
  // manual clock changes and resumes from suspend.
  //
  // Measured in headless Chrome on the wall-clock build, skew driven at the
  // moment the Horizon refills, reported as the share of the Train's time on
  // stage that the card was painted over it — at the shipped defaults, a 900s
  // Pass with the Train on stage across [885,900) and [0,60):
  //
  //   in phase (control)   0.0%    delay -330.046s against a correct -330.000s
  //   -100s step          18.0%    delay -230.034s
  //   -1h  (suspend)      50.7%    delay 0s — floored, and 330s out of phase
  //   +140s step          50.3%    delay -147.533s against a correct -7.500s
  //   -30s over 20s, 60s Pass    100.0%, at full opacity
  //
  // So: the wall clock is stepped back a hundred seconds between the render and
  // the Horizon arriving, and the card must not notice. The re-phase window is
  // long — the seed moves only on a render or a returning Breather, while the
  // re-phase fires whenever an emptied Horizon refills, and under `pass` those
  // can be hours apart.
  const { gap, layer } = overlay(t);
  const time = clock(t);

  gap.restart(handle(PASS), HORIZON);
  time.pass(330_000);
  gap.refresh([]);            // the Horizon empties: presence comes off
  time.stepWallClock(-100_000);
  gap.refresh(HORIZON);       // and refills: the card re-phases against the Pass

  assert.ok(layer.classList.contains(ON), 'the card never came back when its Horizon returned');
  assert.equal(
    layer.style.animationDelay, '-330.000s',
    'the seed moved with the wall clock: the card is now timed to a Pass that never happened',
  );
});

test('a forward wall-clock step cannot move the card off the Pass either', (t) => {
  // The other direction, and the one that measured worst: +140s wrote
  // -147.533s where -7.500s was correct, which put a card window over the
  // traversing Train for 50.3% of its time on stage. A floor cannot help here —
  // the value is positive and plausible, just wrong.
  const { gap, layer } = overlay(t);
  const time = clock(t);

  gap.restart(handle(PASS), HORIZON);
  time.pass(7_500);
  gap.refresh([]);
  time.stepWallClock(140_000);
  gap.refresh(HORIZON);

  assert.equal(layer.style.animationDelay, '-7.500s', 'a forward step dragged the card off the Pass');
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
