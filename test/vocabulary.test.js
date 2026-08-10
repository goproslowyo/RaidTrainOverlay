import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// #67: "marquee" named two unrelated things — the Train's continuous **Mode**
// (`mode=marquee`) and the **Upcoming card**'s one-line **Footprint**
// (`upstyle=ticker`). Both values are baked into copied OBS browser sources, so
// neither param was renamed; the words were. These guard the rule rather than
// the prose, so they belong here and not in a doc: the card's one-line variant
// is a Ticker, and only a Mode is ever a marquee.

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const lines = (rel, re) => read(rel).split('\n').filter((l) => re.test(l));

/**
 * Where the card's Ticker is described. Every one of these is about the card,
 * so "marquee" in any of them is the #67 mistake — with one escape hatch: the
 * literal `mode=marquee` names the Mode unambiguously and is always allowed.
 */
const TICKER_SITES = [
  // The whole module is the card; the Breather that hosts it is orchestrated in
  // overlay-shell.js / train-renderer.js, which are free to say marquee.
  ['src/upcoming-card.js', () => read('src/upcoming-card.js')],
  ['src/config.js (the card knobs)', () => lines('src/config.js', /upscroll|upstyle|ticker/).join('\n')],
  ['README.md (the param table)', () => lines('README.md', /^\| `(upstyle|upscroll)`/).join('\n')],
  ['DESIGN.md (the ticker variant)', () => lines('DESIGN.md', /ticker/i).join('\n')],
  ['.impeccable/design.json (motion tokens)', () => lines('.impeccable/design.json', /ticker/i).join('\n')],
  ['configurator.html (the ticker mock)', () => lines('configurator.html', /tick/i).join('\n')],
];

for (const [label, extract] of TICKER_SITES) {
  test(`${label} describes the Ticker without the word that names a Mode`, () => {
    const text = extract();
    assert.notEqual(text, '', 'the extraction matched nothing — the site moved');
    assert.doesNotMatch(text.replaceAll('mode=marquee', ''), /marquee/i, text);
  });
}

/** One glossary entry, from its bold term to the blank line that ends it. */
function entry(term) {
  const found = read('CONTEXT.md').split(/\n(?=\*\*)/).find((s) => s.startsWith(`**${term}**`));
  assert.ok(found, `CONTEXT.md has no **${term}** entry`);
  return found;
}

test('CONTEXT.md defines the Upcoming card, which Breather and Footprint both lean on', () => {
  const text = entry('Upcoming card');
  assert.match(text, /\*\*Upcoming\*\*/, 'must distinguish itself from the Train lifecycle state');
  assert.match(text, /\*\*Live Link\*\*/, 'must say whose card it is');
});

test('CONTEXT.md defines Footprint, naming both variants and disowning Mode', () => {
  const text = entry('Footprint');
  assert.match(text, /`card`/, 'the default variant is not named');
  assert.match(text, /`ticker`/, 'the one-line variant is not named');
  assert.match(text, /`upstyle`/, 'the param it maps to is not named');
  assert.match(text, /\*\*Mode\*\*/, 'must state its independence from Mode');
});

test('the Mode entry scopes itself to the Train', () => {
  const text = entry('Mode');
  assert.match(text, /\*\*Train\*\*/, 'Mode must say it governs the Train');
  assert.match(text, /\*\*Upcoming card\*\*/, 'Mode must say it does not govern the card');
});
