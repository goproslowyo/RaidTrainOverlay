import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, THEME_LOADERS, isThemeLoaded, loadTheme, loadAllThemes,
} from '../src/themes/registry.js';
import { resolveTheme } from '../src/train-renderer.js';

/**
 * #89: the art is fetched on demand, and this file is the only place the
 * NOTHING-LOADED state exists.
 *
 * It has to be its own file. `node --test` gives each file its own process, and
 * a module graph is per-process: test/theme-registry.test.js loads the whole
 * roster at its top, and once it has, no trick inside that file gets a
 * `train-renderer` bound to an empty registry — a query-suffixed import makes a
 * fresh renderer, but its own static `from './themes/registry.js'` still
 * resolves to the populated instance. So the isolation is the file boundary,
 * and this file must never call `loadAllThemes` at the top.
 *
 * The tests below run in order and share one registry ON PURPOSE: the sequence
 * empty → one Theme loaded → all loaded is the lifecycle under test, and each
 * step is only meaningful after the one above it. `node --test` runs a file's
 * tests sequentially, which is what makes that legible rather than fragile.
 */

test('nothing is loaded until something asks — which is the entire saving', () => {
  // `config.js` and `settings-schema.js` import this registry for the roster's
  // KEYS. If merely importing it pulled the art, every page that wants sixteen
  // strings would pay 127 KB for pictures it never paints, which is the whole
  // of #89. This is that property, stated as an assertion.
  assert.deepEqual(Object.keys(THEMES), []);
  assert.equal(Object.keys(THEME_LOADERS).length, 16, 'the roster is still declared in full');
  assert.equal(isThemeLoaded('wood'), false);
});

test('resolveTheme is loud about a roster Theme whose art nobody loaded', () => {
  // #70's lesson: silently painting classic for a Theme the user actually chose
  // is invisible — it survives parseConfig, ships inside a copied OBS browser
  // source, and paints the wrong art with nothing anywhere saying why. Lazy
  // loading re-opens that failure along a NEW axis — not "the roster drifted"
  // but "the art had not arrived yet" — so the new axis gets a loud failure too.
  assert.throws(() => resolveTheme('wood'), /Theme "wood" has not been loaded/);
  assert.throws(() => resolveTheme('pride'), /has not been loaded/);
  // With nothing loaded at all there is not even a fallback to reach for, and
  // an unknown key cannot quietly succeed either.
  assert.throws(() => resolveTheme('banana'), /no Theme has been loaded/);
  assert.throws(() => resolveTheme(undefined), /no Theme has been loaded/);
});

test('a loaded Theme resolves as an ordinary lookup, and stays synchronous', async () => {
  const wood = await loadTheme('wood');
  assert.equal(isThemeLoaded('wood'), true);
  assert.equal(resolveTheme('wood'), wood, 'resolving is a lookup, not a fetch');
  assert.equal(wood.key, 'wood');
  // Its neighbours are still absent: loading one Theme loads ONE Theme.
  assert.equal(isThemeLoaded('tron'), false);
  assert.throws(() => resolveTheme('tron'), /has not been loaded/);
});

test('loadTheme is idempotent and shares one request between concurrent asks', async () => {
  const [a, b] = await Promise.all([loadTheme('tron'), loadTheme('tron')]);
  assert.equal(a, b, 'two concurrent asks must not be two imports');
  assert.equal(await loadTheme('tron'), a, 'a settled load is served from the map');
  assert.equal(resolveTheme('tron'), a);
});

test('an unknown key still falls back to classic rather than throwing', async () => {
  // A runtime condition, not a caller bug: a stale URL from an older release
  // names a Theme that no longer exists. That has always painted classic and
  // still must — the throw above is only for keys the roster DOES know.
  const classic = await loadTheme('banana');
  assert.equal(classic, THEMES.classic, 'an unknown key lands in classic\'s slot');
  assert.equal(isThemeLoaded('banana'), true, 'reported loaded, via classic');
  assert.equal(resolveTheme('banana'), THEMES.classic);
  assert.equal(resolveTheme(undefined), THEMES.classic);
  assert.equal(resolveTheme(''), THEMES.classic);
});

test('loadAllThemes restores the everything-is-here world a sweep wants', async () => {
  await loadAllThemes();
  assert.deepEqual(Object.keys(THEMES).sort(), Object.keys(THEME_LOADERS).sort());
  for (const key of Object.keys(THEME_LOADERS)) {
    assert.equal(resolveTheme(key).key, key, `${key} does not resolve to its own Theme`);
  }
});
