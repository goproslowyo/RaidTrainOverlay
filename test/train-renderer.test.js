import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme } from '../src/train-renderer.js';
import { THEMES } from '../src/themes/registry.js';
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

test('no render path defers work to requestAnimationFrame', async () => {
  // rAF only runs at a rendering opportunity, so in a document that is never painted
  // — a backgrounded tab, or an OBS browser source in an inactive scene — a queued
  // callback never fires. The post-attach pass (every Theme's fitAll, plus the lead
  // badge) once ran inside rAF, so there it never ran at all: names rendered unshrunk,
  // a too-wide name wrapped, and the extra line pushed the Train past its baseline.
  //
  // A hidden document is not observable from node, so the invariant is pinned at the
  // source. It covers EVERY render module, not just the renderer: each Theme owns its
  // own afterAttach body and could reintroduce the identical bug there. Comments and
  // strings are stripped first, so prose about rAF doesn't fail the build.
  const { readFile, readdir } = await import('node:fs/promises');
  const srcDir = new URL('../src/', import.meta.url);
  const files = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
      if (entry.isDirectory()) await walk(child);
      else if (entry.name.endsWith('.js')) files.push(child);
    }
  };
  await walk(srcDir);
  assert.ok(files.length > 20, 'the walk found the source tree');

  const offenders = [];
  for (const file of files) {
    const code = (await readFile(file, 'utf8'))
      .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
      .replace(/^\s*\/\/.*$/gm, '')        // line comments
      .replace(/`(?:\\[\s\S]|[^`\\])*`/g, '``'); // template literals (theme CSS)
    if (/\brequestAnimationFrame\s*\(/.test(code)) offenders.push(file.pathname.split('/src/')[1]);
  }
  assert.deepEqual(offenders, [], 'render code must not gate work behind rAF');
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

test('synthwave (outrun redesign) pins a constant baseline', () => {
  // The original synthwave stacked one .sw-time line per zone INSIDE the card, so
  // its floor had to grow with the tz block (a function foot). The outrun redesign
  // shows a single time line in a fixed HUD tag over each car, so its box no longer
  // varies with context — the baseline is the tyre bottom, a constant. (A Theme MAY
  // still declare foot as a function of { maxTimeLines }; the renderer resolves both
  // forms — see the contract test above.)
  assert.equal(typeof synthwave.foot, 'number', 'the outrun card is fixed-height');
  assert.ok(synthwave.foot > 0.5 && synthwave.foot <= 1.5, 'a plausible fraction of --rt-th');
});

test('classic contributes a stationary Track via buildTrack', () => {
  // The Track (rails/ties) is a per-Theme concern dispatched alongside build.
  // classic ships the steel Track here; the rest of the roster's
  // Tracks land with each Theme's port. The DOM the Track builds is verified headless.
  assert.equal(typeof classic.buildTrack, 'function');
});
