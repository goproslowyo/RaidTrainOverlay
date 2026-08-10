import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gapSchedule, breatherCycle, BEAT_SEC, LEAD_SEC, CARD_FADE_SEC, CADENCE_SEC,
} from '../src/gap-choreography.js';

// The choreography is pure arithmetic — no DOM, no clock — so the whole rule
// set is pinned here. Whether the card LOOKS right on the canvas is the
// browser sweep's job; whether it may appear at all, how often, and for how
// long is decided entirely by this module.

// A 15-minute Pass interval with a ~50s traversal and the default rail fades:
// the roomy case from the approved prototype.
const roomy = {
  periodSec: 900,
  emptyFromSec: 60, // traversal done + rails faded out
  emptyToSec: 885, // rails begin fading back in
  pageCount: 3,
  upcycleSec: 12,
};

test('the approved constants are the ones the owner played', () => {
  assert.equal(BEAT_SEC, 3);
  assert.equal(LEAD_SEC, 3);
  assert.equal(CARD_FADE_SEC, 0.9);
  assert.equal(CADENCE_SEC, 180);
});

test('cadence scales with the gap: ~4 appearances in a 15-minute interval', () => {
  const s = gapSchedule(roomy);
  assert.equal(s.appearances, 4);
  assert.equal(s.windows.length, 4);
  assert.equal(s.rung, 'full');
});

test('a 5-minute interval still earns a single appearance', () => {
  const s = gapSchedule({ ...roomy, periodSec: 300, emptyToSec: 285 });
  assert.equal(s.appearances, 1);
  assert.equal(s.windows.length, 1);
});

test('a gap too short for one page sits the card out — deterministically, never a flash', () => {
  const s = gapSchedule({ ...roomy, periodSec: 60, emptyToSec: 62 });
  assert.equal(s.rung, 'sit-out');
  assert.deepEqual(s.windows, []);
  assert.equal(s.appearances, 0);
});

test('every window holds whole pages only — never a partial page', () => {
  for (const periodSec of [300, 420, 600, 900, 1200, 1800]) {
    const s = gapSchedule({ ...roomy, periodSec, emptyToSec: periodSec - 15 });
    if (s.rung === 'sit-out') continue;
    const holdSec = s.stintSec - 2 * CARD_FADE_SEC;
    const pages = holdSec / roomy.upcycleSec;
    assert.equal(pages, Math.round(pages), `period ${periodSec}: ${pages} pages is not whole`);
    assert.ok(pages >= 1, `period ${periodSec}: fewer than one page`);
  }
});

test('the degradation ladder caps pages before it drops appearances', () => {
  // A horizon long enough that a full rotation cannot fit in one appearance's
  // share, but each appearance still holds several whole pages.
  const s = gapSchedule({ ...roomy, pageCount: 24 });
  assert.equal(s.appearances, 4, 'the cadence is kept; it is the pages that give');
  assert.ok(s.pages < 24, 'a full 24-page rotation does not fit');
  assert.ok(s.pages > 1);
  assert.equal(s.rung, 'capped');
});

test('one page is the floor: a long list in a tight gap shows a single page', () => {
  const s = gapSchedule({
    ...roomy, periodSec: 120, emptyFromSec: 60, emptyToSec: 90, pageCount: 9,
  });
  assert.equal(s.pages, 1);
  assert.equal(s.rung, 'one-page');
  assert.equal(s.appearances, 1);
});

test('the card never starts before the beat, and is out a lead ahead of the rails', () => {
  const s = gapSchedule(roomy);
  const firstStart = (s.windows[0].fromPct / 100) * roomy.periodSec;
  const lastEnd = (s.windows.at(-1).toPct / 100) * roomy.periodSec;
  assert.ok(firstStart >= roomy.emptyFromSec + BEAT_SEC - 1e-9, 'first window respects the beat');
  assert.ok(lastEnd <= roomy.emptyToSec - LEAD_SEC + 1e-9, 'last window respects the lead');
});

test('windows never overlap and stay in order', () => {
  const s = gapSchedule({ ...roomy, periodSec: 1800, emptyToSec: 1785 });
  for (let i = 1; i < s.windows.length; i += 1) {
    assert.ok(s.windows[i].fromPct > s.windows[i - 1].toPct, `window ${i} overlaps its predecessor`);
  }
});

test('every window is expressed as a percentage of the cycle, in range', () => {
  const s = gapSchedule(roomy);
  for (const w of s.windows) {
    assert.ok(w.fromPct >= 0 && w.toPct <= 100);
    assert.ok(w.toPct > w.fromPct);
  }
  assert.equal(s.cycleSec, roomy.periodSec);
});

test('trackvis=always yields an identical schedule — one rule, not two', () => {
  // Keyed to the Pass period alone; rail state is not an input at all.
  const periodic = gapSchedule(roomy);
  const always = gapSchedule({ ...roomy, trackvis: 'always' });
  assert.deepEqual(always, periodic);
});

test('the opt-out yields no windows at all', () => {
  const s = gapSchedule({ ...roomy, enabled: false });
  assert.deepEqual(s.windows, []);
  assert.equal(s.rung, 'off');
});

test('the ticker holds whole scroll laps instead of whole pages', () => {
  const s = gapSchedule({ ...roomy, style: 'ticker', upscrollSec: 34 });
  const holdSec = s.stintSec - 2 * CARD_FADE_SEC;
  const laps = holdSec / 34;
  assert.equal(laps, Math.round(laps), 'a partial lap would cut a sentence in half');
  assert.ok(laps >= 1);
});

test('a ticker whose lap cannot fit sits out rather than truncating', () => {
  const s = gapSchedule({
    ...roomy, periodSec: 120, emptyToSec: 110, style: 'ticker', upscrollSec: 200,
  });
  assert.equal(s.rung, 'sit-out');
  assert.deepEqual(s.windows, []);
});

test('the ticker keeps the same cadence as the paged card', () => {
  const card = gapSchedule(roomy);
  const ticker = gapSchedule({ ...roomy, style: 'ticker', upscrollSec: 34 });
  assert.equal(ticker.appearances, card.appearances, 'the promise is style-independent');
});

test('the opt-out suppresses the ticker too', () => {
  const s = gapSchedule({ ...roomy, style: 'ticker', upscrollSec: 34, enabled: false });
  assert.deepEqual(s.windows, []);
  assert.equal(s.rung, 'off');
});

test('a slow ticker lap degrades to fewer appearances rather than a cut-off lap', () => {
  // 100s per lap in a gap that fits only one such lap: the cadence gives way,
  // the whole lap does not.
  const s = gapSchedule({
    ...roomy, periodSec: 300, emptyFromSec: 60, emptyToSec: 285, style: 'ticker', upscrollSec: 100,
  });
  assert.equal(s.appearances, 1);
  const laps = (s.stintSec - 2 * CARD_FADE_SEC) / 100;
  assert.equal(laps, 1);
});

// ---- marquee: the Breather ----------------------------------------------
// Marquee has no gap, so it manufactures one. The cycle it returns feeds the
// SAME gapSchedule as a Pass gap — one choreography, not two.

test('the Breather cycle lands its stage-clearings ~3 minutes apart', () => {
  const b = breatherCycle({ upcycleSec: 12 });
  // Breathers RECUR every cycleSec, so it is the cycle — not the crawl inside
  // it — that has to be the cadence, or they drift steadily further apart.
  assert.equal(b.cycleSec, CADENCE_SEC, 'one Breather per ~3 minutes');
  assert.ok(b.crawlSec > 0 && b.crawlSec < b.cycleSec);
  assert.ok(b.cycleSec - b.crawlSec < 60, 'a marquee absence stays brief');
});

test('a Breather too long for the cadence keeps a real crawl rather than going negative', () => {
  // A very slow ticker lap cannot be squeezed into the cadence; the crawl
  // floors instead of inverting.
  const b = breatherCycle({ style: 'ticker', upscrollSec: 300 });
  assert.ok(b.crawlSec >= 60, 'the Train always gets a decent run between Breathers');
  assert.ok(b.cycleSec > b.crawlSec);
  assert.equal(b.emptyToSec, b.cycleSec - b.fadeInSec);
});

test('a Breather holds exactly one page, however long the horizon is', () => {
  for (const pageCount of [1, 3, 9, 40]) {
    const b = breatherCycle({ upcycleSec: 12 });
    const s = gapSchedule({ ...b, pageCount: 1, upcycleSec: 12 });
    assert.equal(s.appearances, 1, `pageCount ${pageCount}: one appearance per Breather`);
    assert.equal(s.pages, 1, `pageCount ${pageCount}: exactly one page`);
  }
});

test('the Breather leaves room for the Track to fade out and back in', () => {
  const b = breatherCycle({ upcycleSec: 12, fadeOutSec: 10, fadeInSec: 15 });
  assert.equal(b.emptyFromSec, b.crawlSec + 10, 'the card waits for the Track to go');
  assert.equal(b.emptyToSec, b.cycleSec - 15, 'and is gone before it returns');
});

test('the opt-out means no Breather at all — the seamless crawl is untouched', () => {
  assert.equal(breatherCycle({ upcycleSec: 12, enabled: false }), null);
});

test('a ticker Breather holds one whole lap', () => {
  const b = breatherCycle({ style: 'ticker', upscrollSec: 34 });
  const s = gapSchedule({ ...b, pageCount: 1, style: 'ticker', upscrollSec: 34 });
  assert.equal(s.appearances, 1);
  assert.equal((s.stintSec - 2 * CARD_FADE_SEC) / 34, 1);
});

test('a Breather never rounds itself into a sit-out', () => {
  // The Breather sizes its own gap to hold exactly one unit, so the fit test
  // lands on a knife edge; awkward fade/cycle numbers must not tip it.
  for (const [fadeOutSec, fadeInSec, upcycleSec] of [[12.3, 17.7, 91], [10, 15, 12], [7.5, 9.25, 33]]) {
    const b = breatherCycle({ fadeOutSec, fadeInSec, upcycleSec });
    const s = gapSchedule({ ...b, pageCount: 1, upcycleSec });
    assert.notEqual(s.rung, 'sit-out', `${fadeOutSec}/${fadeInSec}/${upcycleSec}`);
    assert.equal(s.pages, 1);
    assert.equal(s.windows.length, 1);
  }
});
