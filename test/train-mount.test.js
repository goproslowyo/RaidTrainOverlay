import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { renderTrain } from '../src/train-renderer.js';
import { THEMES } from '../src/themes/registry.js';
import { buildTrain } from '../src/lineup-engine.js';
import { normalizeEvent } from '../src/raidpal-client.js';
import { makeEventPayload } from './fixtures/event-payload.js';

// Where a Train LANDS. The renderer takes its Document from the mount, and so
// does every Theme — the Stage, the Track, the Cars, and the Theme's own
// stylesheet all belong to the document the container came from. The failure
// this guards is silent: art painted into the global page while the Stage sits
// in the mount, which looks like a CSS bug and is an architecture one.
//
// These tests stop at the edge of layout. `linkedom` has no layout engine, so
// `getBoundingClientRect()` reads 0 and nothing here may assert on painted
// geometry — only on WHICH document each piece landed in.

const NOW = new Date('2026-06-16T19:30:00Z');
const TRAIN = buildTrain(normalizeEvent(makeEventPayload()), NOW, { event: 'trainwreck-lucky-13' });

/** A fresh scene with an empty head and one mount point. */
const scene = () =>
  parseHTML('<!doctype html><html><head></head><body><div id="train"></div></body></html>').document;

/**
 * Run `body` with a DECOY installed as the global `document` — the page any
 * lingering global reach would paint into. Node has no global document, so
 * without this the split would surface as a ReferenceError rather than as the
 * bug it actually is: a Train quietly cut in half across two documents.
 */
function withDecoyGlobal(body) {
  const decoy = scene();
  globalThis.document = decoy;
  try {
    return body(decoy);
  } finally {
    delete globalThis.document;
  }
}

test('a Train mounted into a constructed Document keeps its Theme stylesheet there', () => {
  withDecoyGlobal((decoy) => {
    const page = scene();
    renderTrain(TRAIN, page.getElementById('train'), { theme: 'classic' });

    // The Theme-agnostic shell (#69) and the Theme's own sheet, same document.
    assert.ok(page.getElementById('rt-train-style'), 'the base stylesheet missed the mount');
    assert.ok(page.getElementById('rt-theme-classic2-style'), "classic's stylesheet missed the mount");
    // ...and nothing at all in the page that merely happened to be global.
    assert.equal(decoy.head.children.length, 0, 'a stylesheet leaked into the global document');
    assert.equal(decoy.body.querySelectorAll('*').length, 1, 'art leaked into the global document');
  });
});

test('the whole Train — Stage, Track, and art — is built out of the mount document', () => {
  withDecoyGlobal(() => {
    const page = scene();
    const container = page.getElementById('train');
    renderTrain(TRAIN, container, { theme: 'classic' });

    const stage = container.querySelector('.rt-stage');
    assert.ok(stage, 'no Stage in the mount');
    assert.equal(stage.ownerDocument, page, 'the Stage belongs to another document');
    const track = stage.querySelector('.rt-track');
    assert.ok(track?.firstElementChild, 'the Track carries no Train');
    assert.equal(track.firstElementChild.ownerDocument, page, 'the Train belongs to another document');
    assert.equal(stage.querySelector('.rt-rails')?.ownerDocument, page, 'the Track art belongs to another document');
  });
});

test('every registered Theme paints into the mount document, never the global one', () => {
  // A per-Theme sweep, because the reach for the global document was written out
  // once per Theme module: one missed `ensureStyles`/`build`/`buildTrack` splits
  // that Theme alone, and only that Theme, with nothing anywhere saying why.
  for (const key of Object.keys(THEMES)) {
    withDecoyGlobal((decoy) => {
      const page = scene();
      const container = page.getElementById('train');
      renderTrain(TRAIN, container, { theme: key });

      assert.ok(page.head.querySelector('style'), `${key}: no stylesheet reached the mount`);
      assert.ok(container.querySelector('.rt-track')?.firstElementChild, `${key}: no art reached the mount`);
      assert.equal(decoy.head.children.length, 0, `${key}: a stylesheet leaked into the global document`);
      assert.equal(decoy.body.querySelectorAll('*').length, 1, `${key}: art leaked into the global document`);
    });
  }
});

test('both Modes build into the mount document', () => {
  // marquee measures the Train and appends copies; pass generates its own
  // keyframes. Both write a stylesheet, and both must write it to the mount.
  for (const mode of ['pass', 'marquee']) {
    withDecoyGlobal((decoy) => {
      const page = scene();
      renderTrain(TRAIN, page.getElementById('train'), { theme: 'classic', mode });
      assert.ok(page.getElementById('rt-train-mode-style'), `${mode}: the Mode keyframes missed the mount`);
      assert.equal(decoy.head.children.length, 0, `${mode}: a stylesheet leaked into the global document`);
    });
  }
});
