import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import * as renderer from '../src/train-renderer.js';
import { renderTrain, breatherOpacityAt } from '../src/train-renderer.js';
import { stageClock, stageClockIsMonotonic } from '../src/stage-clock.js';
import { parseConfig, MAX_TRACK_FADE_SEC } from '../src/config.js';
import { DEFAULT_RESOLVE_MIN, annotateMySlots } from '../src/live-link-feed.js';
import { nextPollDelayMs } from '../src/backoff.js';
import { buildTrain } from '../src/lineup-engine.js';
import { normalizeEvent } from '../src/raidpal-client.js';
import { makeEventPayload } from './fixtures/event-payload.js';
import { loadAllThemes } from '../src/themes/registry.js';

// The art is fetched on demand (#89) and `renderTrain` stays synchronous, so a
// suite that renders must load first. One line; no assertion below changed.
await loadAllThemes();

// What a render hands BACK. The Stage choreography needs two facts from the
// renderer — which kind of empty stretch this Mode has, and the switch for the
// marquee Breather — and both ride the handle renderTrain already returns,
// bound to the Stage that render just built. They were module-level globals,
// which the preview paths never assigned, so "the last render's timing" was a
// promise only some render paths kept.
//
// These tests stop at the edge of layout. `linkedom` has no layout engine, so
// `getBoundingClientRect()` reads 0 and every derived duration is meaningless
// here — assert on the TAG and the handle's shape, never on the seconds. The
// numbers are the browser sweep's job.

const NOW = new Date('2026-06-16T19:30:00Z');
const TRAIN = buildTrain(normalizeEvent(makeEventPayload()), NOW, { event: 'trainwreck-lucky-13' });

/** A fresh scene with an empty head and one mount point. */
const scene = () =>
  parseHTML('<!doctype html><html><head></head><body><div id="train"></div></body></html>').document;

/** Render into a fresh scene and hand back both the handle and the mount. */
function render(config) {
  const page = scene();
  const container = page.getElementById('train');
  return { view: renderTrain(TRAIN, container, config), container };
}

/** A Live Link config with a card to put in a Breather. */
const WITH_CARD = { user: 'nightowl', upcoming: { kind: 'count', n: 3 }, upgap: 1 };

test('a Pass render hands its gap back tagged `pass`', () => {
  const { view } = render({ theme: 'classic', mode: 'pass' });
  assert.equal(view.timing.kind, 'pass');
  // The gap the card is choreographed into, in the shape gapSchedule takes.
  for (const key of ['periodSec', 'emptyFromSec', 'emptyToSec']) {
    assert.ok(key in view.timing, `the Pass gap carries ${key}`);
  }
});

test('a marquee render with a card to show hands its cycle back tagged `breather`', () => {
  const { view } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD });
  assert.equal(view.timing.kind, 'breather');
  for (const key of ['periodSec', 'emptyFromSec', 'emptyToSec']) {
    assert.ok(key in view.timing, `the Breather cycle carries ${key}`);
  }
});

test('a marquee render with the occasion opted out hands back `none`', () => {
  // upgap=0 keeps marquee's seamless crawl exactly as it is: no Breather, and
  // so no empty stretch for anything to be choreographed into.
  const { view } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, upgap: 0 });
  assert.equal(view.timing.kind, 'none');
});

test('an upcoming-only marquee source hands back `none`', () => {
  // That scene exists to show the card outright, so the Train never steps aside.
  const { view } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, uponly: true });
  assert.equal(view.timing.kind, 'none');
});

test('the preview paths hand back `none` rather than the previous render\'s timing', () => {
  // The hazard the globals carried: a preview render returned early without
  // assigning either of them, so the shell went on reading a Pass gap that
  // belonged to a Stage no longer on screen.
  const passing = render({ theme: 'classic', mode: 'pass' });
  assert.equal(passing.view.timing.kind, 'pass');

  assert.equal(render({ theme: 'classic', mode: 'pass', preview: true }).view.timing.kind, 'none');
  assert.equal(
    render({ theme: 'classic', mode: 'pass', preview: true, previewRoll: true }).view.timing.kind,
    'none',
  );
});

test('the renderer never applies the Breather class during a render', () => {
  // The Stage must not commit to a Breather nothing asked for: the renderer can
  // only tell whether one is CONFIGURED, and whether there is actually a card to
  // put in it depends on the Horizon, which the shell owns. Applied here, it went
  // on during the render and could be switched straight back off moments later.
  const { container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD });
  const stage = container.querySelector('.rt-stage');
  assert.ok(stage, 'no Stage in the mount');
  assert.equal(stage.classList.contains('rt-stage--breather'), false);
  // The keyframes are still generated — only the caller decides when they run.
  assert.match(container.ownerDocument.getElementById('rt-train-mode-style').textContent, /rt-breather/);
});

test('the handle\'s Breather switch works the Stage that render just built', () => {
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD });
  const stage = container.querySelector('.rt-stage');
  view.setBreather(true);
  assert.equal(stage.classList.contains('rt-stage--breather'), true);
  view.setBreather(false);
  assert.equal(stage.classList.contains('rt-stage--breather'), false);
});

test('the Breather switch is inert on a render that has no Breather', () => {
  // A Pass gap is the Mode's own; nothing fades the Stage there. Neither does a
  // marquee whose streamer opted out.
  for (const config of [
    { theme: 'classic', mode: 'pass' },
    { theme: 'classic', mode: 'marquee', ...WITH_CARD, upgap: 0 },
  ]) {
    const { view, container } = render(config);
    view.setBreather(true);
    assert.equal(container.querySelector('.rt-stage').classList.contains('rt-stage--breather'), false);
  }
});

/**
 * A driven clock for the Stage. The Breather's phase is one clock read, and the
 * clock it has to read is the one `rt-breather` itself runs on — the Document's
 * monotonic timeline, reached as `performance.now()`. So that is what is driven
 * here, and `Date.now` is PINNED as a negative control: a build that seeded the
 * epoch from the wall clock sees no time pass at all through any of these
 * tests, reads full opacity, and applies no ramp.
 *
 * `stepWallClock` moves the pinned wall clock without moving the real one, which
 * is the NTP step, the resume from suspend and the manual clock change all at
 * once. Nothing the Stage does may notice.
 *
 * Both are globals, restored after each test. `linkedom`'s
 * `defaultView.performance` forwards to the global one — even a property
 * defined on the view writes through — so this seam cannot tell "this
 * Document's window" from "the ambient global". That half of the rule needs two
 * real windows with two `timeOrigin`s and is measured in a browser instead.
 *
 * The twin of this fixture lives in test/gap-card.test.js, driving the same two
 * globals for the card. Duplicated on purpose: a fixture that two suites share
 * is a third thing to keep in step, and the whole of what these two have in
 * common is nine lines of global-shadowing. Change one and look at the other.
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

// A marquee whose fades are long enough to name a moment INSIDE one. These are
// ordinary params: a 45s fade-out and a 60s Page make the Breather long enough
// that the crawl floors at its minimum, so the cycle is 60s of crawl, 45s of
// fading out, an empty stretch, then 12s of fading back in — 184.8s in all.
const LONG_FADES = { trackfadeout: 45, trackfadein: 12, upcycle: 60 };
const MID_FADE_OUT_MS = 90_000; // 30s into the 45s fade-out: two thirds down.

test('the Breather cycle carries the numbers the fades are measured in', () => {
  const { view } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  assert.deepEqual(
    { c: view.timing.cycleSec, w: view.timing.crawlSec, o: view.timing.fadeOutSec, i: view.timing.fadeInSec },
    { c: 184.8, w: 60, o: 45, i: 12 },
  );
});

test('breatherOpacityAt says what the Breather keyframe paints at a moment in the cycle', () => {
  // The keyframe is generated from four numbers; this reads the same four as a
  // value, and the two have to agree or the Stage eases back from the wrong
  // place. Both ends of every span, so a boundary cannot drift unnoticed.
  const { view } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const at = (sec) => Number(breatherOpacityAt(sec, view.timing).toFixed(6));
  assert.equal(at(0), 1, 'the cycle opens on the crawl, at full opacity');
  assert.equal(at(60), 1, 'the crawl is still whole at its last moment');
  assert.equal(at(90), 0.333333, 'two thirds down the fade-out');
  assert.equal(at(105), 0, 'the fade-out has finished: the Stage is clear');
  assert.equal(at(172.8), 0, 'still clear at the last moment before the fade-in');
  assert.equal(at(178.8), 0.5, 'halfway back up the fade-in');
  assert.equal(at(184.8), 1, 'the cycle has come round: full opacity again');
  assert.equal(at(184.8 + 90), 0.333333, 'and the second cycle reads like the first');
  // A negative reads as full opacity — and there is no floor doing that. There
  // used to be a `Math.max(0, elapsedSec)` here, and it was dead: `crawlSec` is
  // never below 60, so `elapsedSec % cycleSec` is <= 0 <= crawlSec for every
  // negative and the crawl branch answers 1 with or without it. Deleting it
  // left all 502 green, this line included — a test that named a line it did
  // not cover. What matters is what that 1 MEANS: full opacity is the answer
  // that applies no ramp at all, so on a wall clock this was the mechanism by
  // which #88 came back. The guard is the monotonic epoch, not the arithmetic.
  assert.equal(at(-50), 1, 'a negative elapsed reads as the crawl, which applies no ramp');
  assert.equal(at(-50), at(0), 'the negative branch and the top of the cycle are the same answer');
  assert.equal(breatherOpacityAt(90, undefined), 1, 'nothing at all is nothing to fade');
});

test('breatherOpacityAt is the generated `rt-breather` keyframe, not a second opinion', () => {
  // The docstring says it "mirrors the keyframe above and moves with it", and
  // until now that was a claim rather than a test: the cases above check the
  // function against hand-written constants, so a change to the GENERATED stops
  // left all 493 green while the Stage eased back from a phase the keyframe was
  // not painting. This reads the stops out of the sheet the browser gets,
  // reconstructs what a `linear` animation paints between them, and walks the
  // whole cycle against the function. Any stop that moves fails it.
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const css = container.ownerDocument.getElementById('rt-train-mode-style').textContent;
  // `@keyframes rt-breather {` and not `rt-breather-return {` — the space
  // before the brace is what separates them.
  const body = css.match(/@keyframes rt-breather \{([\s\S]*?)\n\s*\}/);
  assert.ok(body, 'no rt-breather keyframe in the generated sheet');
  const stops = [];
  for (const [, selectors, opacity] of body[1].matchAll(/([\d.%,\s]+?)\{\s*opacity:\s*([\d.]+);\s*\}/g)) {
    for (const pct of selectors.split(',')) stops.push([Number(pct.trim().replace('%', '')), Number(opacity)]);
  }
  stops.sort((a, b) => a[0] - b[0]);
  assert.deepEqual(stops.map(([pct]) => Number.isFinite(pct)), [true, true, true, true, true]);
  assert.equal(stops[0][0], 0, 'the keyframe list does not open at 0%');
  assert.equal(stops.at(-1)[0], 100, 'the keyframe list does not close at 100%');
  // The DURATION, which the stops cannot speak for: they are percentages, so
  // every one of them still lands where it should on an animation that runs for
  // the wrong length of time. Changing `${cycle.cycleSec}s` to `+ 1` survived
  // all 502 — and a duration one second long puts `breatherOpacityAt` at a
  // phase the animation is not at, compounding a second per cycle, which is
  // #88's snap coming back a little further into the fade each time round.
  assert.match(
    css,
    new RegExp(
      `\\.rt-stage--breather \\{ animation: rt-breather ${String(view.timing.cycleSec).replace('.', '\\.')}s linear infinite; \\}`,
    ),
    'the Breather runs for a different length of time than the phase rule is measured in',
  );

  /** What a `linear` keyframe list paints at `sec`, by interpolating its stops. */
  const painted = (sec) => {
    const pct = (sec / view.timing.cycleSec) * 100;
    for (let i = 1; i < stops.length; i += 1) {
      const [fromPct, fromOp] = stops[i - 1];
      const [toPct, toOp] = stops[i];
      if (pct > toPct) continue;
      if (toPct === fromPct) return toOp;
      return fromOp + ((pct - fromPct) / (toPct - fromPct)) * (toOp - fromOp);
    }
    return stops.at(-1)[1];
  };

  for (let tenths = 0; tenths <= view.timing.cycleSec * 10; tenths += 1) {
    const sec = tenths / 10;
    const drift = Math.abs(breatherOpacityAt(sec, view.timing) - painted(sec));
    assert.ok(drift < 1e-9, `the rule and the keyframe disagree by ${drift} at ${sec}s`);
  }
});

test('a Breather switched off mid-fade-out eases the Stage back rather than cutting it', (t) => {
  // The one moment in the choreography that used to contradict the rule it is
  // built on: a Horizon that empties mid-Breather dropped the class outright and
  // the Stage jumped to full opacity in a single frame — measured as a 0.67 jump
  // in headless Chrome (#88). The Stage now comes back up at the Breather's own
  // fade-in rate from where it actually is.
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  view.setBreather(true);
  time.pass(MID_FADE_OUT_MS);
  view.setBreather(false);

  assert.equal(stage.classList.contains('rt-stage--breather'), false, 'the Breather is still running');
  assert.ok(stage.classList.contains('rt-stage--breather-return'), 'the Stage was cut back to full opacity');
  // Seeded by phase, not from zero: a third of the way up a 12s fade-in is 4s
  // in, so 8s of easing is left. Deliberately SHORTER than a natural return
  // from here, which would have spent the other 15s of the fade-out first —
  // the Breather is over, so there is nothing left to finish going down for.
  assert.equal(stage.style.animationDelay, '-4.000s');
});

test('the Breather\'s phase is read off a monotonic clock, never the wall clock', (t) => {
  // `rt-breather` runs on the document timeline, which is monotonic; `Date.now`
  // is the wall clock, and an OBS source runs for days past NTP steps (Windows
  // steps rather than slews once it is 128 ms out), manual clock changes and
  // resumes from suspend. Measured in headless Chrome on the wall-clock build,
  // driving the divergence at the moment the switch is thrown: -20s stepped the
  // Stage 0.4446 in one frame, +20s blinked it to black by 0.3332, +3600s by
  // 0.16685 — and -100s reproduced #88 EXACTLY at 0.66685, because a backward
  // step floors elapsed to 0, reads full opacity and applies no ramp at all.
  //
  // So: the wall clock is stepped back a hundred seconds between the switch on
  // and the switch off, and the Stage must not notice. (The whole file's clock
  // fixture pins `Date.now` for the same reason — see `clock` above.)
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  view.setBreather(true);
  time.pass(MID_FADE_OUT_MS);
  time.stepWallClock(-100_000);
  view.setBreather(false);

  assert.ok(stage.classList.contains('rt-stage--breather-return'), 'a wall-clock step restored #88');
  assert.equal(stage.style.animationDelay, '-4.000s', 'the seed moved with the wall clock');
});

test('the return ramp is generated with the Breather it belongs to', () => {
  const { container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const css = container.ownerDocument.getElementById('rt-train-mode-style').textContent;
  // The BODY, not just the name. Reversed — `from { opacity: 1 } to { opacity:
  // 0 }` — the whole suite stayed green while the Stage jumped 0.333 up to
  // 0.667 in one frame and then faded away to nothing, which is worse than the
  // bug. The direction is the ramp.
  assert.match(
    css,
    /@keyframes rt-breather-return \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/,
    'the ramp must run from nothing UP to full opacity',
  );
  // Its own name, so swapping the classes starts a new animation instead of
  // re-timing the one that was already running.
  assert.match(css, /\.rt-stage--breather-return \{ animation: rt-breather-return 12s linear 1; \}/);
});

test('reduced motion suppresses the return ramp along with the Breather', () => {
  // The Breather does not fade under reduced motion, so a Stage that never
  // faded has nothing to be eased back from — and the ramp is one-shot, which
  // is exactly the shape of motion that setting exists to stop. Nothing in the
  // repo asserted this @media block at all.
  const { container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const base = container.ownerDocument.getElementById('rt-train-style').textContent;
  const reduced = base.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\n\s*\}/);
  assert.ok(reduced, 'the base sheet has no reduced-motion block');
  assert.match(
    reduced[1],
    /\.rt-stage--breather, \.rt-stage--breather-return \{ animation: none !important; \}/,
  );
  // `!important`, because the rule it has to beat is generated per render into
  // the OTHER sheet and lands after this one.
  assert.match(
    container.ownerDocument.getElementById('rt-train-mode-style').textContent,
    /\.rt-stage--breather-return \{ animation: /,
  );
});

test('a Breather switched off between its fades leaves the Stage plain', (t) => {
  // Full opacity is the only phase with nothing to ease: the Stage is already
  // where a return would put it, so it is not left carrying a ramp that would
  // paint a fade where there was none. (At NOTHING there is plenty to ease —
  // see the empty-stretch case below, which is the likelier one.)
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  view.setBreather(true);
  time.pass(30_000); // still crawling, at full opacity
  view.setBreather(false);

  assert.equal(stage.className, 'rt-stage', 'the Stage kept a ramp it had no fade to finish');
  assert.equal(stage.style.animationDelay, '');
});

test('a Breather barely into its fade-out is eased back too, not cut', (t) => {
  // The short-circuit is `opacity >= 1` and it has to be exactly that. Moved to
  // any threshold below full — `>= 0.5` passes the whole suite — every Stage
  // above the threshold is cut back instead, which is #88 again for the deepest
  // half of the fade. 4.5s into a 45s fade-out is 0.9, a tenth of the way down.
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  view.setBreather(true);
  time.pass(64_500);
  view.setBreather(false);

  assert.ok(stage.classList.contains('rt-stage--breather-return'), 'a Stage a tenth down was cut back');
  assert.equal(stage.style.animationDelay, '-10.800s');
});

test('a Breather switched off across its empty stretch comes back over the whole fade-in', (t) => {
  // The likeliest trigger of all at the defaults — 19.8s of the 44.8s in which
  // the switch can be thrown mid-Breather — and untested until now. The Stage
  // is at NOTHING here, so there is everything to ease: the ramp runs its full
  // length from a seed of zero, which is what the natural return would have
  // done from this phase too.
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  view.setBreather(true);
  time.pass(120_000); // 105s..172.8s is the empty stretch
  view.setBreather(false);

  assert.ok(stage.classList.contains('rt-stage--breather-return'), 'a clear Stage was snapped back to full');
  assert.equal(stage.style.animationDelay, '-0.000s');
});

test('a Breather switched off mid-fade-IN finishes exactly the fade it was in', (t) => {
  // The one phase where the ramp and a natural return are the same thing: the
  // Breather was already coming back, and what is left to run is what it had
  // left. Halfway up a 12s fade-in is 6s in, so 6s remain.
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  view.setBreather(true);
  time.pass(178_800);
  view.setBreather(false);

  assert.ok(stage.classList.contains('rt-stage--breather-return'));
  assert.equal(stage.style.animationDelay, '-6.000s');
});

test('a Breather switched on while it is already running changes nothing', (t) => {
  // #85's subject, on the renderer's side of the seam. Every resolve tick that
  // finds the Horizon still full asks for the Breather again. Without the
  // guard, the class is re-added — restarting a three-minute `rt-breather` from
  // 0% on a Stage mid-fade — and the epoch moves with it, so the phase becomes
  // whichever tick last fired. Dropping the guard leaves the other 492 green:
  // what catches it is switching OFF afterwards and finding the seed the epoch
  // it did not move still implies.
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  view.setBreather(true);
  time.pass(MID_FADE_OUT_MS);
  view.setBreather(true); // the resolve tick that changes nothing

  assert.ok(stage.classList.contains('rt-stage--breather'), 'the Breather was switched off by asking for it');
  assert.equal(stage.style.animationDelay, '', 'the re-entry wrote a seed onto a running Breather');
  view.setBreather(false);
  assert.equal(stage.style.animationDelay, '-4.000s', 'the epoch moved, so the Stage is at the wrong phase');
});

test('trackfadein=0 makes the return a cut, exactly as the natural return is there', (t) => {
  // 0 is a legal setting (boundedNumber(..., 0, 120, 15)) documented as "an
  // instant cut", and the Breather's own return is a cut at it — so the ramp
  // being one too is the setting working, not a hole in the fix. Recorded
  // rather than fixed, because easing here would be the one fade that setting
  // failed to switch off. Measured in headless Chrome: 0.4926 -> 1 in one
  // frame, against 0.00023 for the same Stage left to fade on its own.
  const { view, container } = render({
    theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES, trackfadein: 0,
  });
  const stage = container.querySelector('.rt-stage');
  const css = container.ownerDocument.getElementById('rt-train-mode-style').textContent;
  const time = clock(t);

  assert.equal(view.timing.fadeInSec, 0);
  assert.match(css, /\.rt-stage--breather-return \{ animation: rt-breather-return 0s linear 1; \}/);
  view.setBreather(true);
  time.pass(90_000); // two thirds down the fade-out
  view.setBreather(false);
  assert.ok(stage.classList.contains('rt-stage--breather-return'));
  assert.equal(stage.style.animationDelay, '-0.000s', 'a 0s ramp can only be seeded at zero');
});

test('a Breather that comes back mid-return takes the Stage back from it', (t) => {
  // The Horizon refills while the Stage is still easing up. The Breather's own
  // keyframe opens at full opacity — where that ramp was heading anyway — so it
  // takes over outright, and the seed it starts from is this moment.
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  view.setBreather(true);
  time.pass(MID_FADE_OUT_MS);
  view.setBreather(false);
  time.pass(2_000);
  view.setBreather(true);

  assert.ok(stage.classList.contains('rt-stage--breather'), 'the Breather never came back');
  assert.equal(stage.classList.contains('rt-stage--breather-return'), false, 'two keyframes are fighting over the Stage');
  assert.equal(stage.style.animationDelay, '', 'the Breather restarted part-way through a fade');

  // And the new epoch is this moment, not the old one: switching off again a
  // crawl later finds the Stage at full opacity, with nothing to ease.
  time.pass(30_000);
  view.setBreather(false);
  assert.equal(stage.className, 'rt-stage');
});

test('switching the Breather OFF when it is already off changes nothing', (t) => {
  // The mirror of the on-guard, and reachable on exactly the same cadence:
  // gap-card's `clear()` throws the switch off on every empty-Horizon tick, and
  // `restart` throws it off again on a handle swap. Deleting
  // `if (!classes.contains('rt-stage--breather')) return;` left all 502 green.
  // Without it a redundant off-call reads an epoch that has gone stale, lands
  // in a fade phase the Stage was never in, and ramps a Stage that never faded
  // up from nothing — the whole Stage flashing in out of thin air.
  const { view, container } = render({ theme: 'classic', mode: 'marquee', ...WITH_CARD, ...LONG_FADES });
  const stage = container.querySelector('.rt-stage');
  const time = clock(t);

  // Never switched on at all. The epoch is still 0, so an unguarded read would
  // put the Stage two thirds down a fade-out it was never in.
  time.pass(90_000);
  view.setBreather(false);
  assert.equal(stage.className, 'rt-stage', 'a Stage that never faded was handed a return ramp');
  assert.equal(stage.style.animationDelay, '');

  // And after a real Breather has already been let back up: the NEXT empty tick
  // must not re-seed the ramp from a phase the Stage left behind.
  view.setBreather(true);
  time.pass(120_000); // the empty stretch
  view.setBreather(false);
  assert.equal(stage.style.animationDelay, '-0.000s', 'the first return is the one that counts');
  time.pass(58_800); // the epoch now reads halfway up the fade-in
  view.setBreather(false);
  assert.equal(
    stage.style.animationDelay, '-0.000s',
    'a second off-call re-ramped the Stage from an epoch that had gone stale',
  );
});

test('the mid-ramp re-entry is out of reach, and the three facts that keep it there', async () => {
  // The known residual: a Horizon that empties and refills while the Stage is
  // still easing back takes the Breather over mid-ramp, which review measured
  // at 0.949 in one frame — larger than the cut #88 fixed. It is held out of
  // reach rather than handled, and it is held there by THREE facts in three
  // other modules. That was prose in a fourth, with nothing asserting any of
  // it: lower the resolve floor to a minute and the case becomes reachable
  // with the whole suite green.
  //
  // "Out of reach" rather than "unreachable", and the difference was settled by
  // a probe after two reviews disagreed about it. `filterUpcoming`
  // (src/live-link.js) is NOT monotone non-increasing in time: under a
  // `weeks`/`months` spec the horizon edge is `now + n·WEEK_MS`, so it advances
  // with `now` and admits more trains rather than fewer. And it is re-run per
  // EMIT, not per tick — src/overlay-shell.js's `onHorizon` calls it with a
  // fresh `new Date()` each time — so the two emits of one tick filter at two
  // different instants. Probed directly: one train sitting 500ms past a 2-week
  // edge filters to 0 rows at t and to 1 row 800ms later, which is an empty
  // Horizon refilling inside one tick and inside any ramp. It needs a train to
  // fall within the emit gap of the window edge, so it is vanishingly
  // improbable — but it is arithmetic, not impossibility, and the word for it
  // is not "unreachable".

  // FACT ONE: the resolve cadence, taken at its shortest — which is not the
  // nominal 15 minutes. `nextPollDelayMs` jitters ±15%, so the floor is 765s,
  // not 900. Asserting the nominal would pass green at a 800s ramp cap while
  // the real invariant (765 < 800) was already broken, so the jittered floor
  // is what the rule is held against — read out of backoff.js rather than
  // restated, since it is that curve the feed actually schedules on.
  const shortestTickSec = nextPollDelayMs({ refreshMins: DEFAULT_RESOLVE_MIN, rand: () => 0 }) / 1000;
  assert.ok(
    shortestTickSec > MAX_TRACK_FADE_SEC,
    `the shortest jittered gap between resolve ticks (${shortestTickSec}s) no longer clears a ${MAX_TRACK_FADE_SEC}s ramp`,
  );
  // A streamer's own `refresh` is the other way a tick could get short, and it
  // is floored to the same 15 rather than to anything of its own.
  assert.equal(parseConfig('refresh=1').refresh, DEFAULT_RESOLVE_MIN);
  assert.equal(parseConfig('refresh=99').refresh, 99, 'a longer cadence is a streamer\'s to choose');

  // FACT TWO: the ramp really is capped where the rule assumes — the cap is
  // accepted, one second past it is refused back to the default.
  assert.equal(parseConfig(`trackfadein=${MAX_TRACK_FADE_SEC}`).trackfadein, MAX_TRACK_FADE_SEC);
  assert.equal(parseConfig(`trackfadein=${MAX_TRACK_FADE_SEC + 1}`).trackfadein, 15);

  // FACT THREE, and the one nothing could see: the two facts above space out
  // successive resolve TICKS, but one tick paints TWICE — `annotateMySlots`
  // emits cache-first and then again once the lineups are refined. Those two
  // emits are milliseconds apart, well inside any ramp. What makes them
  // harmless is that the second is never a refill of an emptied card, because
  // the loop preserves its row count: one `out.push` per input row, on every
  // path through it. That is a property of a loop body rather than of a
  // constant, so it is the leg most likely to be lost in a refactor — and it
  // is the only one of the three that is not a number somebody would think
  // twice about changing.
  const rows = [
    { slug: 'trainwreck-lucky-13', starttime: new Date('2026-06-16T18:00:00Z') },
    { slug: 'house-is-a-feeling', starttime: new Date('2026-06-20T18:00:00Z') },
    { slug: 'midnight-express', starttime: new Date('2026-06-24T18:00:00Z') },
  ];
  const noCache = { getItem: () => null, setItem: () => {} };
  const names = ['DJ Alpha'];
  const rowCount = async (options) => (await annotateMySlots(rows, names, { storage: noCache, ...options })).length;

  // The first paint: no network at all, nothing cached, so no lineup is known.
  assert.equal(await rowCount({ cacheOnly: true }), rows.length, 'the cache-first emit dropped rows it could not annotate');
  // Every lineup read fails — a RaidPal outage must not empty the card either.
  assert.equal(
    await rowCount({ fetchImpl: () => Promise.reject(new Error('RaidPal is down')), setTimer: (fn) => fn() }),
    rows.length,
    'a failed lineup read dropped its row instead of falling back to the departure time',
  );
  // A malformed cached payload takes the same route, one layer in.
  assert.equal(
    await rowCount({ fetchImpl: async () => ({ ok: true, json: async () => ({ nonsense: true }) }), setTimer: (fn) => fn() }),
    rows.length,
    'a payload normalizeEvent throws on sank the row rather than the annotation',
  );
  // And the refining emit, where every lineup reads and every one names the
  // streamer: still the same rows, now annotated. Same count, richer content —
  // which is exactly why the double-emit cannot empty-then-refill.
  const refined = await annotateMySlots(rows, names, {
    storage: noCache,
    fetchImpl: async () => ({ ok: true, json: async () => makeEventPayload() }),
    setTimer: (fn) => fn(),
  });
  assert.equal(refined.length, rows.length, 'the refining emit changed the row count');
  assert.deepEqual(refined.map((t) => t.slug), rows.map((t) => t.slug), 'the refining emit reordered or replaced rows');
  assert.ok(refined.every((t) => t.mySlotAt instanceof Date), 'the refining emit found no slot to refine with, so it proves nothing');
});

test('the Stage clock is the Document\'s monotonic one wherever a Document has one', () => {
  // The `Date.now` fallback is genuinely unreachable in production — a
  // constructed Document has no `defaultView`, and its animations never tick,
  // so there is no timeline for the wall clock to disagree with. Replacing it
  // with a `throw` survives the whole suite, which is exactly the shape of
  // claim that should not be left as a comment. This says which branch each
  // kind of Document takes instead of pretending the fallback is covered.
  const page = scene();
  assert.equal(stageClockIsMonotonic(page), true, 'a mounted Document must not fall back to the wall clock');
  // The fallback, named and reached: no window, so no timeline.
  assert.equal(stageClockIsMonotonic({ defaultView: null }), false);
  assert.equal(stageClockIsMonotonic(null), false);

  // And each branch reads the clock it names rather than merely handing back a
  // number: `typeof … === 'number'` alone is satisfied by `() => 0`, so both
  // branches were coverable by a constant. Each read is bracketed by the clock
  // it claims to be, which no constant can sit inside.
  const wallBefore = Date.now();
  const fallbackRead = stageClock({ defaultView: null })();
  assert.ok(
    fallbackRead >= wallBefore && fallbackRead <= Date.now(),
    'the fallback branch is not reading the wall clock',
  );
  const monoBefore = performance.now();
  const monoRead = stageClock(page)();
  assert.ok(
    monoRead >= monoBefore && monoRead <= performance.now(),
    'the monotonic branch is not reading its Document\'s performance.now()',
  );
});

test('the renderer publishes no timing as module state', () => {
  // The two nullable globals and their getters are gone, and so is the switch
  // that queried a container back out — the handle carries all three.
  assert.equal(renderer.currentPassGeometry, undefined);
  assert.equal(renderer.currentBreatherCycle, undefined);
  assert.equal(renderer.setBreather, undefined);
});
