import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES, SHIPPED_THEMES, THEME_KEYS, optionKeyFor } from '../src/themes/registry.js';
import { resolveTheme } from '../src/train-renderer.js';
import { parseConfig } from '../src/config.js';
import { THEME_OPTION_KEYS } from '../src/settings-schema.js';
import classic from '../src/themes/classic.js';
import flat from '../src/themes/flat.js';
import synthwave from '../src/themes/synthwave.js';
import ticket from '../src/themes/ticket.js';
import wood from '../src/themes/wood.js';
import comic from '../src/themes/comic.js';
import departures from '../src/themes/departures.js';
import paper from '../src/themes/paper.js';
import tron from '../src/themes/tron.js';
import pixel from '../src/themes/pixel.js';
import highvibes from '../src/themes/highvibes.js';
import jazz from '../src/themes/jazz.js';
import bullet from '../src/themes/bullet.js';
import lava from '../src/themes/lava.js';
import pride from '../src/themes/pride.js';
import starter from '../src/themes/starter/index.js';

// The roster used to be spelled out four times — the renderer's map, config's
// enum, settings-schema's option keys, and the pages' chips — with nothing
// holding the copies to each other. The failure mode was silent: a key in the
// enum but missing from the map is selectable, survives parseConfig, ships
// inside a copied OBS browser source, and paints classic. These pin each key to
// its OWN Theme, which is the only assertion that catches that.

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

/** The roster as a human wrote it out, module by module — the thing under test. */
const EXPECTED = [
  ['classic', classic], ['flat', flat], ['synthwave', synthwave], ['ticket', ticket],
  ['wood', wood], ['comic', comic], ['departures', departures], ['paper', paper],
  ['tron', tron], ['pixel', pixel], ['highvibes', highvibes], ['jazz', jazz],
  ['bullet', bullet], ['lava', lava], ['pride', pride], ['starter', starter],
];
const expected = Object.fromEntries(EXPECTED);

test('the registry maps every roster key to its own Theme module', () => {
  assert.deepEqual(Object.keys(THEMES), EXPECTED.map(([key]) => key));
  for (const [key, theme] of EXPECTED) {
    assert.equal(THEMES[key], theme, `${key} is not registered under its own module`);
  }
});

test('every registered Theme answers to the key it is registered under', () => {
  // A Theme declares its own `key`; a mis-keyed registration would otherwise be
  // invisible, since resolveTheme never consults it.
  for (const [key, theme] of Object.entries(THEMES)) {
    assert.equal(theme.key, key, `${key} is registered on a Theme that calls itself ${theme.key}`);
  }
});

test('SHIPPED_THEMES is the registry without the authoring reference', () => {
  // starter renders (the manual harness reaches it by key) but is not offered:
  // it is the authoring guide's reference Theme, not a roster Theme.
  assert.ok(THEMES.starter, 'starter must stay registered');
  assert.ok(!SHIPPED_THEMES.includes('starter'), 'starter must stay out of the roster');
  assert.deepEqual(SHIPPED_THEMES, Object.keys(THEMES).filter((key) => key !== 'starter'));
});

test('THEME_KEYS is the roster plus shuffle — the config enum, by construction', () => {
  assert.deepEqual(THEME_KEYS, [...SHIPPED_THEMES, 'shuffle']);
});

test('every roster key is selectable and paints its own Theme, never the fallback', () => {
  // The drift bug, pinned end to end: enum → parseConfig → resolveTheme.
  for (const key of SHIPPED_THEMES) {
    assert.equal(parseConfig(`?event=x&theme=${key}`).theme, key, `${key} is not in the enum`);
    assert.equal(resolveTheme(key), expected[key], `${key} does not resolve to its own Theme`);
    if (key !== 'classic') {
      assert.notEqual(resolveTheme(key), classic, `${key} silently paints classic`);
    }
  }
});

test('config.js takes the Theme enum from the registry instead of listing it again', () => {
  const src = read('src/config.js');
  assert.match(src, /import \{[^}]*THEME_KEYS[^}]*\} from '\.\/themes\/registry\.js';/);
  assert.match(src, /theme: oneOf\([\s\S]{0,240}?THEME_KEYS/, 'the enum still carries its own roster');
  // THEME_ALIASES belongs to the URL schema, not the roster, and stays put.
  assert.match(src, /const THEME_ALIASES = \{/);
});

test('THEME_OPTION_KEYS is the roster derived through optionKeyFor', () => {
  assert.equal(optionKeyFor('classic'), 'configurator.theme.classic');
  assert.deepEqual(THEME_OPTION_KEYS, Object.fromEntries(THEME_KEYS.map((key) => [key, optionKeyFor(key)])));
});

test('the Configurator\'s Theme grid has a swatch for every roster key', () => {
  // No build step, by design, so the page's swatch palettes stay hand-written.
  // A missing one is a silent omission — the grid falls back to classic's
  // palette under another Theme's name — so the test holds them honest instead.
  const grid = read('configurator.html').split('const THEME_SWATCHES = {')[1]?.split('};')[0];
  assert.ok(grid, 'the THEME_SWATCHES block moved');
  for (const key of THEME_KEYS) {
    assert.match(grid, new RegExp(`^\\s*${key}: \\[`, 'm'), `the Theme grid has no swatch for ${key}`);
  }
});

test('the preview gallery has a chip for every roster key', () => {
  const gallery = read('preview.html').split('const THEMES = [')[1]?.split('];')[0];
  assert.ok(gallery, 'the preview gallery moved');
  for (const key of THEME_KEYS) {
    assert.match(gallery, new RegExp(`\\['${key}',`), `the preview gallery has no chip for ${key}`);
  }
});
