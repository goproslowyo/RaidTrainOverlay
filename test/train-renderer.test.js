import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme, THEMES } from '../src/train-renderer.js';
import classic from '../src/themes/classic.js';
import highvibes from '../src/themes/highvibes.js';
import jazz from '../src/themes/jazz.js';
import bullet from '../src/themes/bullet.js';
import lava from '../src/themes/lava.js';
import synthwave from '../src/themes/synthwave.js';

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

test('the render path never defers work to requestAnimationFrame', async () => {
  // rAF does not fire in a document that is never painted — a backgrounded tab, or an
  // OBS browser source sitting in an inactive scene. The post-attach pass (every
  // Theme's fitAll shrink-to-fit, plus the lead badge) once ran inside rAF, so in
  // those documents it silently never ran at all: names rendered unshrunk, a name too
  // wide for its Car wrapped to a second line, and the extra line pushed the Train
  // past its baseline so height=100 clipped it. No unit test can observe a hidden
  // document, so the invariant is pinned at the source: the render path measures
  // layout (which is always available) and never waits for a frame.
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/train-renderer.js', import.meta.url), 'utf8');
  assert.ok(!source.includes('requestAnimationFrame('), 'train-renderer must not gate render work behind rAF');
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
    // A content-height Theme declares foot as a function of the render context
    // (see synthwave); the renderer evaluates it once maxTimeLines is known.
    const footAt = (maxTimeLines) => (typeof theme.foot === 'function' ? theme.foot({ maxTimeLines }) : theme.foot);
    assert.ok(['number', 'function'].includes(typeof theme.foot), `${key}: declares a foot (baseline)`);
    for (const lines of [1, 2, 3]) {
      const foot = footAt(lines);
      assert.equal(typeof foot, 'number', `${key}: foot resolves to a number at ${lines} time line(s)`);
      assert.ok(foot > 0.5 && foot <= 1.5, `${key}: foot ${foot} at ${lines} time line(s) is a plausible fraction of --rt-th`);
    }
    // A floor may only move DOWN as the time block grows — never up, and never
    // by so little that a stacked tz block hangs off the bottom edge again.
    assert.ok(footAt(3) >= footAt(1), `${key}: foot does not shrink as the time block grows`);
  }
});

test('a content-height Theme grows its baseline with the tz time block', () => {
  // synthwave stacks one .sw-time line per zone INSIDE the card, so its box — and
  // therefore its floor — grows with tz. A constant here left tz=PT,ET,GMT hanging
  // 40.8px off the bottom edge at height=100 (measured at 1920x1080, scale 1).
  assert.equal(typeof synthwave.foot, 'function', 'synthwave declares a context-dependent baseline');
  const one = synthwave.foot({ maxTimeLines: 1 });
  const three = synthwave.foot({ maxTimeLines: 3 });
  // Two extra pinned 14u lines in a 210u-tall design box.
  assert.ok(Math.abs((three - one) - (2 * 14) / 210) < 1e-9, 'two extra zones add exactly two line boxes');
  // Called bare (no context) it must still answer for the single-line case.
  assert.equal(synthwave.foot(), one);
});

test('classic contributes a stationary Track via buildTrack', () => {
  // The Track (rails/ties) is a per-Theme concern dispatched alongside build.
  // classic ships the steel Track here; the rest of the roster's
  // Tracks land with each Theme's port. The DOM the Track builds is verified headless.
  assert.equal(typeof classic.buildTrack, 'function');
});
