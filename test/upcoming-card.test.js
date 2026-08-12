import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import {
  anchorStyle, cellThird, cellSpan, pageFadeMs, renderUpcomingCard, TYPE, MIN_TYPE_PX,
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

// The **Cell** places an anchor; `cellSpan` ceilings it. The owner relaxed the
// old "must not bleed into another column or row" once the card's type grew:
// the 3×3 grid is a suggested ANCHOR POINT, and a card may overflow into the
// neighbours it is next to. What survives is that a ceiling exists and depends
// on the anchor — which is what stops the scrolling view going back to
// spanning the whole screen from a corner. Both views are budgeted by this one
// function, so these assertions are the rule's only guard outside a browser.

test('a centre position may grow into the neighbour on each side; an edge into one', () => {
  // Three cells for a centre (a neighbour either way), two for an edge (one
  // neighbour, inward). Applied per axis, from that axis's own letter.
  assert.equal(cellSpan('c'), 3, 'horizontal centre');
  assert.equal(cellSpan('m'), 3, 'vertical middle');
  for (const edge of ['l', 'r', 't', 'b']) assert.equal(cellSpan(edge), 2, edge);
});

test('every anchor is ceilinged by its own span, both axes', () => {
  const wide = (n) => new RegExp(`max-width:calc\\(33\\.3333vw \\* ${n} - 48px\\)`);
  const tall = (n) => new RegExp(`max-height:calc\\(33\\.3333vh \\* ${n} - 48px\\)`);
  // A corner grows inward on both axes; the middle-centre may take everything.
  assert.match(anchorStyle('tl'), wide(2));
  assert.match(anchorStyle('tl'), tall(2));
  assert.match(anchorStyle('br'), wide(2));
  assert.match(anchorStyle('br'), tall(2));
  // Bottom-centre — the default — is free across the width and pinned in height.
  assert.match(anchorStyle('bc'), wide(3));
  assert.match(anchorStyle('bc'), tall(2));
  assert.match(anchorStyle('ml'), wide(2));
  assert.match(anchorStyle('ml'), tall(3));
  assert.match(anchorStyle('mc'), wide(3));
  assert.match(anchorStyle('mc'), tall(3));
});

test('no anchor is left without a ceiling on either axis', () => {
  // The relaxation is a bigger number, never the absence of one: an unbounded
  // scrolling view spanning the whole screen from every anchor is the bug this
  // budget was introduced to close, and it must stay closed.
  for (const key of ANCHORS) {
    const css = anchorStyle(key);
    assert.match(css, /max-width:calc\(33\.3333vw \* [23] - 48px\)/, key);
    assert.match(css, /max-height:calc\(33\.3333vh \* [23] - 48px\)/, key);
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

test('the pad comes out of the budget, so a bigger inset never widens the box', () => {
  // Even a 3-cell span stops short of the screen edge rather than touching it.
  assert.match(anchorStyle('tl', { pad: 40 }), /max-width:calc\(33\.3333vw \* 2 - 80px\)/);
  assert.match(anchorStyle('tl', { pad: 40 }), /max-height:calc\(33\.3333vh \* 2 - 80px\)/);
  assert.match(anchorStyle('mc', { pad: 40 }), /max-width:calc\(33\.3333vw \* 3 - 80px\)/);
});

test('the minimum width yields to the budget on a narrow scene', () => {
  // A hard 340px floor is wider than a third of a 960-wide scene, so a floor
  // that could out-vote the ceiling would put the panel off the edge — the
  // floor is a min() against the same budget, not a number that beats it.
  for (const key of ANCHORS) {
    const span = ['l', 'r'].includes(key[1]) ? 2 : 3;
    assert.match(
      anchorStyle(key),
      new RegExp(`min-width:min\\(340px, calc\\(33\\.3333vw \\* ${span} - 48px\\)\\)`),
      key,
    );
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
  // The span is the grammar's, not the surface's, so the preview shows the same
  // overflow into neighbours the Stage will.
  const css = anchorStyle('bl', {
    pad: 12, cell: { w: cellThird('%'), h: cellThird('%') }, floor: '210px',
  });
  assert.match(css, /max-width:calc\(33\.3333% \* 2 - 24px\)/);
  assert.match(css, /max-height:calc\(33\.3333% \* 2 - 24px\)/);
  assert.match(css, /min-width:min\(210px, calc\(33\.3333% \* 2 - 24px\)\)/);
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
  assert.match(preview, /max-width:\$\{oneCellWidth\(PREVIEW_BUDGET\)\}/,
    'the mock scrolling view must take its one-Cell cap from this module — without it '
    + 'the preview spreads across its whole stage while the Overlay holds one Cell, '
    + 'which is the one thing a Preview may never misstate');
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

/**
 * The type scale. This is the one part of the card's appearance a DOM-only
 * runner CAN see: font-size is authored as an inline style, so it survives
 * into the painted node without a cascade or a layout engine. What these
 * guard is the FLOOR and the RANKING — the two properties the owner's report
 * was about ("legible on a monitor, not from across a room"), and the two a
 * later tweak to one role can silently break.
 *
 * They deliberately do not assert a specific px value in the abstract; TYPE is
 * the statement, and the painted-node tests below are what tie the statement
 * to the panel. A test that only re-typed the numbers would pass a card that
 * never applied them.
 */
const ROLES = [...Object.entries(TYPE.card), ...Object.entries(TYPE.scrolling)];

test('no role in either view falls below the stream-distance floor', () => {
  // An OBS source can be scaled DOWN in a scene, and the smallest role is the
  // first thing to stop reading when it is. There is no fallback below this.
  for (const [role, px] of ROLES) {
    assert.ok(px >= MIN_TYPE_PX, `${role} is ${px}px, under the ${MIN_TYPE_PX}px floor`);
  }
});

test('each view is a ranked scale, not five independent numbers', () => {
  // The panel reads because the roles are ordered: the name is what you are
  // there to read, the departure time supports it, the UTC anchor is a
  // footnote. Bumping one role and leaving the others behind flattens that.
  for (const [view, scale] of Object.entries(TYPE)) {
    assert.ok(scale.name > scale.when, `${view}: the name must outrank its departure time`);
    assert.ok(scale.when > scale.utc, `${view}: the departure time must outrank the UTC anchor`);
    assert.ok(scale.eyebrow >= scale.utc, `${view}: the eyebrow must not sink below the footnote`);
  }
});

/** Every `font-size:Npx` an element's inline style declares, as numbers. */
const sizesIn = (el) => [...el.style.cssText.matchAll(/font-size:\s*([\d.]+)px/g)]
  .map((m) => Number(m[1]));

test('the painted card view carries the scale it declares', () => {
  const { document: page } = parseHTML('<!doctype html><html><head></head><body><div id="train"></div></body></html>');
  const container = page.getElementById('train');
  renderUpcomingCard(container, TRAINS, CONFIG);

  const card = container.querySelector('.rt-upcoming-card');
  const [head, list] = card.children;
  assert.deepEqual(sizesIn(head.firstElementChild), [TYPE.card.eyebrow], 'the eyebrow');
  const [when, name, utc] = [...list.children];
  assert.deepEqual(sizesIn(when), [TYPE.card.when], 'the departure time');
  assert.deepEqual(sizesIn(name), [TYPE.card.name], 'the train name');
  assert.deepEqual(sizesIn(utc), [TYPE.card.utc], 'the UTC anchor');
});

test('the painted scrolling view carries its own, tighter scale', () => {
  // The scrolling view is one line inside the same cell, so it runs a notch
  // below the card view — and its eyebrow stays put, because the 1709px
  // breakpoint in this module's stylesheet is calibrated to that exact width.
  const { document: page } = parseHTML('<!doctype html><html><head></head><body><div id="train"></div></body></html>');
  const container = page.getElementById('train');
  renderUpcomingCard(container, TRAINS, { ...CONFIG, upstyle: 'ticker' });

  const panel = container.querySelector('.rt-upcoming-ticker');
  // The one-line footprint keeps ONE Cell even though its anchor may now span
  // three: its content is longer than any screen, so an unceilinged panel does
  // not grow to fit — it becomes a bar across the whole scene at every anchor.
  assert.match(panel.style.cssText, /max-width:calc\(33\.3333vw - 48px\)/,
    'the scrolling view must not inherit the relaxed, neighbour-spanning ceiling');
  assert.deepEqual(sizesIn(panel.querySelector('.rt-upcoming-ticker-label')),
    [TYPE.scrolling.eyebrow], 'the eyebrow');
  const entry = panel.querySelector('.rt-upcoming-ticker-run span span');
  assert.deepEqual(sizesIn(entry), [TYPE.scrolling.name], 'the entry, which the name inherits');
  const [when, , utc] = [...entry.children];
  assert.equal(Number(when.style.fontSize.replace('px', '')), TYPE.scrolling.when, 'the departure time');
  assert.equal(Number(utc.style.fontSize.replace('px', '')), TYPE.scrolling.utc, 'the UTC anchor');
});
