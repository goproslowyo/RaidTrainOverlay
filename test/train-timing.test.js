import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import * as renderer from '../src/train-renderer.js';
import { renderTrain } from '../src/train-renderer.js';
import { buildTrain } from '../src/lineup-engine.js';
import { normalizeEvent } from '../src/raidpal-client.js';
import { makeEventPayload } from './fixtures/event-payload.js';

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

test('the renderer publishes no timing as module state', () => {
  // The two nullable globals and their getters are gone, and so is the switch
  // that queried a container back out — the handle carries all three.
  assert.equal(renderer.currentPassGeometry, undefined);
  assert.equal(renderer.currentBreatherCycle, undefined);
  assert.equal(renderer.setBreather, undefined);
});
