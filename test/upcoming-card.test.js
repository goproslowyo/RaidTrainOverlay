import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import {
  anchorStyle, cellThird, pageFadeMs, renderUpcomingCard,
} from '../src/upcoming-card.js';

// The anchor grammar is the pure part and gets unit coverage here. The DOM
// half is now reachable too: the module takes its Document from the mount, so
// a test can hand it one and read the painted panel back. What that buys is
// structure — which rows, in which order, with which text — and it stops at
// the edge of layout: no DOM implementation has a layout engine, so
// `offsetWidth` and `getBoundingClientRect()` read 0 here. The geometry lock
// in the card view, the **Cell** rule as painted, and everything measured
// (`pinLeadBadges`, `fitAll`, the scrolling view's copy count) stay with the
// headless browser sweep. A green suite is not evidence about the Cell rule.

const ANCHORS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

test('anchorStyle places each of the nine anchors on its own edge pair', () => {
  assert.match(anchorStyle('tl'), /top:24px/);
  assert.match(anchorStyle('tl'), /left:24px/);
  assert.match(anchorStyle('br'), /bottom:24px/);
  assert.match(anchorStyle('br'), /right:24px/);
  assert.match(anchorStyle('mc'), /top:50%/);
  assert.match(anchorStyle('mc'), /justify-content:center/);
  assert.match(anchorStyle('bc'), /bottom:24px/);
  assert.match(anchorStyle('bc'), /justify-content:center/);
});

// The cell rule: the scene is three columns and three rows, the nine anchors
// are its nine cells, and an item at one anchor must not bleed into another
// column or row. Both views of the card are budgeted by this one function, so
// these assertions are the rule's only guard outside a browser.

test('every anchor is ceilinged at one third of the scene, both axes', () => {
  for (const key of ANCHORS) {
    const css = anchorStyle(key);
    assert.match(css, /max-width:calc\(33\.3333vw - 48px\)/, key);
    assert.match(css, /max-height:calc\(33\.3333vh - 48px\)/, key);
  }
});

test('the cell comes from viewport units, never a measured scene', () => {
  // OBS browser sources (and our own tooling) report window.innerWidth as 0 in
  // places, so a JS-measured cell computes garbage exactly where it matters.
  for (const key of ANCHORS) {
    const css = anchorStyle(key);
    assert.match(css, /max-width:calc\(33\.3333vw/, key);
    assert.match(css, /max-height:calc\(33\.3333vh/, key);
  }
});

test('the pad comes out of the cell, so a bigger inset never widens the box', () => {
  assert.match(anchorStyle('tl', { pad: 40 }), /max-width:calc\(33\.3333vw - 80px\)/);
  assert.match(anchorStyle('tl', { pad: 40 }), /max-height:calc\(33\.3333vh - 80px\)/);
});

test('the minimum width yields to the cell on a narrow scene', () => {
  // A hard 340px floor is wider than a third of a 960-wide scene, which is
  // exactly the bleed the rule exists to prevent — so the floor is a min()
  // against the same budget, not a number that can out-vote it.
  for (const key of ANCHORS) {
    assert.match(anchorStyle(key), /min-width:min\(340px, 33\.3333vw - 48px\)/, key);
  }
});

test('centre anchors centre by transform, so the ceiling can bind', () => {
  // left:0;right:0 stretched the box edge to edge and left max-width with
  // nothing to do — that is how the scrolling view spanned whole screens.
  for (const key of ['tc', 'mc', 'bc']) {
    const css = anchorStyle(key);
    assert.doesNotMatch(css, /right:0/, key);
    assert.match(css, /left:50%/, key);
    assert.match(css, /transform:[^;]*translateX\(-50%\)/, key);
  }
  assert.match(anchorStyle('ml'), /transform:translateY\(-50%\)/);
  assert.match(anchorStyle('mc'), /transform:translateX\(-50%\) translateY\(-50%\)/);
  for (const key of ['tl', 'tr', 'bl', 'br']) {
    assert.doesNotMatch(anchorStyle(key), /transform:/, key);
  }
});

test('the cell third is stated once, and reads in whichever unit its surface uses', () => {
  // The Stage measures itself in viewport units — OBS reports innerWidth as 0,
  // so a measured cell computes garbage. The Configurator's preview stage is a
  // panel, not the viewport, so the same third reads as a percentage of it.
  assert.equal(cellThird('vw'), '33.3333vw');
  assert.equal(cellThird('vh'), '33.3333vh');
  assert.equal(cellThird('%'), '33.3333%');
});

test('the anchor grammar composes the third with a per-surface pad and floor', () => {
  // The preview's stage is not the viewport, so it passes the SAME third in its
  // own unit alongside its own pad and floor — the two scale-dependent parts.
  const css = anchorStyle('bl', {
    pad: 12, cell: { w: cellThird('%'), h: cellThird('%') }, floor: '210px',
  });
  assert.match(css, /max-width:calc\(33\.3333% - 24px\)/);
  assert.match(css, /max-height:calc\(33\.3333% - 24px\)/);
  assert.match(css, /min-width:min\(210px, 33\.3333% - 24px\)/);
});

test('anchorStyle falls back to bottom-centre for a missing key', () => {
  assert.equal(anchorStyle(undefined), anchorStyle('bc'));
});

test('the page-turn crossfade is a quarter of the cycle, capped', () => {
  // It takes the cycle LENGTH, not a config: the Configurator's preview turns
  // its own Page on its own clock, and the crossfade is the one part of that
  // both surfaces must agree on. Slow enough to read as a dissolve at the 12s
  // default, never most of the hold at the 20s end.
  assert.equal(pageFadeMs(3), 750, 'a quarter of the shortest hold the picker offers');
  assert.equal(pageFadeMs(4), 1000);
  assert.equal(pageFadeMs(4.4), 1100, 'the exact knee — at 4.4s the quarter meets the cap');
  assert.equal(pageFadeMs(12), 1100, 'the cap, or a page would spend its hold fading');
  assert.equal(pageFadeMs(20), 1100);
});

/**
 * The Cell third no longer lives in two places: the preview budget calls
 * `cellThird`, so that half of the rule cannot drift. What remains twinned by
 * design is the SKIN — the preview draws its own card in its own CSS, at its
 * own deliberately-oversize scale, and imports nothing for it. So this guard
 * survives as the weaker backstop it now is: the fill rules that make an
 * anchor's budget a real ceiling, and the eyebrow cap. Same shape as the
 * vocabulary test — grep the other site for what has to match.
 */
test('the Configurator preview fills its budget the same way this module does', () => {
  const preview = readFileSync(new URL('../configurator.html', import.meta.url), 'utf8');
  assert.match(preview, /cell: \{ w: cellThird\('%'\), h: cellThird\('%'\) \}/,
    'the preview must take its third from this module, not restate it');
  assert.doesNotMatch(preview, /33\.3333/,
    'the third is stated once, in this module — a copy here is the drift the export removes');
  assert.match(preview, /\.up \{[^}]*flex: 1 1 auto; min-width: 0;/,
    'both views must fill the budget rather than declare a width of their own');
  assert.match(preview, /\.up\.ticker \.lbl \{[^}]*max-width: 40%/,
    'the eyebrow must yield to the trains here too');
  assert.match(anchorStyle('bl'), /min-width:min\(340px/, 'the floor still yields via min()');
});

/**
 * The seam: the module resolves its Document from the container it is handed,
 * so a mount in a document that is not the global one paints correctly. This
 * is the one test that proves it — the card's own coverage arrives with the
 * tickets that need it.
 */
const CONFIG = { t: (key) => key, locale: 'en-US', uppos: 'bc', upcycle: 12, upstyle: 'card' };
const TRAINS = [
  { slug: 'first', title: 'House Is A Feeling', starttime: new Date('2026-08-14T20:00:00Z') },
  { slug: 'second', title: 'Trainwreck Lucky 13', starttime: new Date('2026-08-15T20:00:00Z') },
  { slug: 'third', title: 'Midnight Yard', starttime: new Date('2026-08-16T20:00:00Z') },
];

test('the card mounts into the Document its container came from, and lays a row per train', () => {
  const { document: page } = parseHTML('<!doctype html><html><head></head><body><div id="train"></div></body></html>');
  const container = page.getElementById('train');

  renderUpcomingCard(container, TRAINS, CONFIG);

  // The keyframes go into THAT document's head, not a global one.
  assert.ok(page.getElementById('rt-upcoming-style'), 'the stylesheet never reached the mount document');

  const card = container.querySelector('.rt-upcoming-card');
  assert.ok(card, 'no card view was painted into the mount');
  // The list is one grid of [time, name, UTC] cells per train, in order.
  const cells = [...card.lastElementChild.children];
  assert.equal(cells.length, TRAINS.length * 3);
  assert.deepEqual(
    cells.filter((_, i) => i % 3 === 1).map((cell) => cell.textContent),
    TRAINS.map((train) => train.title),
  );
});
