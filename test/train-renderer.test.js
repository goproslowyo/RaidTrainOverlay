import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, THEMES } from '../src/train-renderer.js';
import classic from '../src/themes/classic.js';
import highvibes from '../src/themes/highvibes.js';
import jazz from '../src/themes/jazz.js';
import bullet from '../src/themes/bullet.js';
import lava from '../src/themes/lava.js';

// The Theme strategy interface: config.theme selects a Theme by key;
// everything else about a Theme stays inside the renderer. These tests pin the
// dispatch contract (DOM-free); the SVG art is verified headless on a live Event.

test('resolveTheme returns the Theme registered under its key', () => {
  assert.equal(resolveTheme('classic'), classic);
});

test('resolveTheme returns the four new Themes by their canonical keys', () => {
  // highvibes/jazz/bullet/lava ported from their MFA prototypes; each registers
  // under its canonical key (their friendly aliases resolve in config.js).
  assert.equal(resolveTheme('highvibes'), highvibes);
  assert.equal(resolveTheme('jazz'), jazz);
  assert.equal(resolveTheme('bullet'), bullet);
  assert.equal(resolveTheme('lava'), lava);
});

test('resolveTheme falls back to classic for unknown, unshipped, or missing keys', () => {
  // The tolerance contract mirrors config: a Theme that is not (yet) shipped
  // renders as the default rather than blanking the Overlay.
  assert.equal(resolveTheme(undefined), classic);
  assert.equal(resolveTheme('banana'), classic);
  assert.equal(resolveTheme('blueprint'), classic);
  assert.equal(resolveTheme(''), classic);
});

test('every registered Theme satisfies the renderer contract', () => {
  for (const [key, theme] of Object.entries(THEMES)) {
    assert.equal(theme.key, key, `${key}: key matches its registry slot`);
    assert.equal(typeof theme.ensureStyles, 'function', `${key}: has ensureStyles`);
    assert.equal(typeof theme.build, 'function', `${key}: has build`);
    // buildTrack is OPTIONAL: a Theme may contribute a stationary
    // Track, but the renderer tolerates its absence (theme.buildTrack?.()), so a
    // not-yet-ported Theme still renders its Train. Only assert the shape when present.
    if ('buildTrack' in theme) {
      assert.equal(typeof theme.buildTrack, 'function', `${key}: buildTrack, when present, is a function`);
    }
    // The BASELINE: every shipped Theme declares where its floor sits, as a
    // fraction of the Train height, so `height` drops the floor (not the layout
    // box) onto the bottom edge and the whole roster bottoms out identically.
    // A missing/NaN value silently falls back to 1 in the renderer — the exact
    // per-Theme drift issue #24 fixed — so assert it is present and sane. The
    // band is generous on purpose (a Theme whose art overhangs its box, like
    // departures' slung bogies, is legitimately > 1); it only catches a typo or
    // a value expressed in design units instead of a fraction.
    assert.equal(typeof theme.foot, 'number', `${key}: declares a numeric foot (baseline)`);
    assert.ok(theme.foot > 0.5 && theme.foot <= 1.25, `${key}: foot ${theme.foot} is a plausible fraction of --rt-th`);
  }
});

test('classic contributes a stationary Track via buildTrack', () => {
  // The Track (rails/ties) is a per-Theme concern dispatched alongside build.
  // classic ships the steel Track here; the rest of the roster's
  // Tracks land with each Theme's port. The DOM the Track builds is verified headless.
  assert.equal(typeof classic.buildTrack, 'function');
});
