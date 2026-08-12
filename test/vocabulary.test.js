import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// #67: "marquee" named two unrelated things — the Train's continuous **Mode**
// (`mode=marquee`) and the **Upcoming card**'s one-line **Footprint**
// (`upstyle=ticker`). Both values are baked into copied OBS browser sources, so
// neither param was renamed; the words were. #67 then canonised **Ticker** for
// the one-line variant, and the owner did not recognise the word — they say the
// **scrolling view**. These guard the rule rather than the prose, so they
// belong here and not in a doc: only a Mode is ever a marquee, and the card's
// two views are the card view and the scrolling view.

const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const lines = (rel, re) => read(rel).split('\n').filter((l) => re.test(l));

/**
 * Where the card's scrolling view is described. Every one of these is about the
 * card, so "marquee" in any of them is the #67 mistake — with one escape hatch:
 * the literal `mode=marquee` names the Mode unambiguously and is always
 * allowed.
 */
const SCROLLING_VIEW_SITES = [
  // The whole module is the card; the Breather that hosts it is orchestrated in
  // overlay-shell.js / train-renderer.js, which are free to say marquee.
  ['src/upcoming-card.js', () => read('src/upcoming-card.js')],
  ['src/config.js (the card knobs)', () => lines('src/config.js', /upscroll|upstyle|ticker/).join('\n')],
  ['README.md (the param table)', () => lines('README.md', /^\| `(upstyle|upscroll)`/).join('\n')],
  ['DESIGN.md (the scrolling view)', () => lines('DESIGN.md', /ticker|scrolling view/i).join('\n')],
  ['.impeccable/design.json (motion tokens)', () => lines('.impeccable/design.json', /ticker|scroll/i).join('\n')],
  ['configurator.html (the scrolling mock)', () => lines('configurator.html', /tick/i).join('\n')],
];

for (const [label, extract] of SCROLLING_VIEW_SITES) {
  test(`${label} describes the scrolling view without the word that names a Mode`, () => {
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

test('CONTEXT.md defines Footprint, naming both views and disowning Mode', () => {
  const text = entry('Footprint');
  assert.match(text, /\*\*card view\*\*/, 'the default view is not named');
  assert.match(text, /\*\*scrolling view\*\*/, 'the one-line view is not named');
  assert.match(text, /`upstyle`/, 'the param it maps to is not named');
  assert.match(text, /\*\*Mode\*\*/, 'must state its independence from Mode');
});

test('the Mode entry scopes itself to the Train', () => {
  const text = entry('Mode');
  assert.match(text, /\*\*Train\*\*/, 'Mode must say it governs the Train');
  assert.match(text, /\*\*Upcoming card\*\*/, 'Mode must say it does not govern the card');
});

test('Horizon is one concept measured three ways, not three features', () => {
  const text = entry('Horizon');
  for (const measure of ['`upcoming=3`', '`upcoming=2w`', '`upcoming=all`']) {
    assert.match(text, new RegExp(measure.replaceAll('`', '`')), `${measure} is not shown as a measure of the same thing`);
  }
  assert.match(text, /one concept/i, 'must say the three measures are one concept');
});

test('Page and Lap are the two views\' units of one whole thing', () => {
  assert.match(entry('Page'), /\*\*Horizon\*\*/, 'a Page must be a Page OF something');
  assert.match(entry('Lap'), /\*\*Horizon\*\*/, 'a Lap must be a Lap OF something');
  assert.match(entry('Lap'), /\*\*Page\*\*/, 'the gap choreography treats them as a matched pair');
});

test('Occasion names the when-axis and says which param carries it', () => {
  const text = entry('Occasion');
  assert.match(text, /`upgap`/, 'the param carrying the axis is not named');
  assert.match(text, /`upcoming`/, 'the never case is carried by upcoming, not upgap');
  assert.match(text, /\*\*Footprint\*\*/, 'must distinguish itself from the how-much-room axis');
});

test('Stage is defined — Track visibility and Breather both lean on it', () => {
  assert.match(entry('Stage'), /\*\*Breather\*\*/, 'a Breather is the thing that clears the Stage');
});

test('Turn is defined, and the Live Link says it is what it follows', () => {
  // The Overlay follows its streamer, not the timetable. Whenever that slips
  // back into "the live (or next) train" the overlap bug is describable again.
  const turn = entry('Turn');
  assert.match(turn, /\*\*Live Link\*\*/, 'a Turn must say whose unit it is');
  assert.match(turn, /\*\*Stage\*\*/, 'must say what ending a Turn does');
  assert.match(entry('Live Link'), /\*\*Turn\*\*/, 'the Live Link must say it follows the Turn');
});

test('Cell is defined — the rule confining the card to its anchor', () => {
  assert.match(entry('Cell'), /`uppos`/, 'the anchors the Cells belong to are not named');
});

test('"Ticker" survives only as a param value, never as a name for the view', () => {
  // The owner does not use the word. `upstyle=ticker` ships inside copied OBS
  // browser sources and cannot move; the words for it already have.
  const text = read('CONTEXT.md');
  for (const [line, i] of text.split('\n').map((l, n) => [l, n + 1])) {
    if (!/ticker/i.test(line)) continue;
    assert.match(
      line,
      /`upstyle=ticker`|`ticker`|"Ticker"|_Avoid_|only a param value/,
      `CONTEXT.md:${i} uses "ticker" as a word rather than as a param value:\n${line}`,
    );
  }
});

/**
 * The defect #67 existed to fix, made mechanical: a glossary that bolds a term
 * it never defines. Every bolded run that READS as a term reference — a
 * capitalised phrase of one to three plain words — must have an entry. Bolded
 * emphasis (lowercase, or a whole clause) is not a term and is left alone.
 */
test('CONTEXT.md bolds no term it does not define', () => {
  const text = read('CONTEXT.md');
  const defined = new Set();
  for (const m of text.matchAll(/^\*\*(.+?)\*\*/gm)) {
    const whole = m[1].trim();
    defined.add(whole.toLowerCase());
    for (const part of whole.split(' / ')) defined.add(part.trim().toLowerCase());
  }
  const TERMISH = /^[A-Z][A-Za-z-]*(?: [A-Za-z-]+){0,2}$/;
  const undefinedRefs = [];
  for (const m of text.matchAll(/\*\*(.+?)\*\*/g)) {
    const term = m[1].trim();
    if (!TERMISH.test(term)) continue; // emphasis, not a term reference
    const key = term.toLowerCase();
    if (defined.has(key) || defined.has(key.replace(/e?s$/, ''))) continue;
    undefinedRefs.push(term);
  }
  assert.deepEqual([...new Set(undefinedRefs)], [], 'bolded but never defined');
});

/**
 * The other half of the same check: the card's anatomy. #67 left four of these
 * used inside CONTEXT.md and defined nowhere, which is how the gap was found.
 */
test('CONTEXT.md defines the whole anatomy of the Upcoming card', () => {
  for (const term of [
    'Upcoming card', 'Horizon', 'Page', 'Lap', 'Footprint',
    'Card view', 'Scrolling view', 'Occasion', 'Cell', 'Stage',
  ]) entry(term);
});

/**
 * What closes the loop, and the half the bolded-run check above cannot see on
 * its own. #67's four defects — horizon, stage, page, lap — were BARE words in
 * other entries' prose, so nothing marked them as terms and nothing noticed
 * they had no entries.
 *
 * So: leaning on one of these words in another entry means bolding it, and
 * bolding it means defining it. Neither rule catches an undefined term alone;
 * together they do. Capitalised only — "the whole page" and a "backend-down
 * page" are the ordinary English words and none of this applies to them.
 */
test('CONTEXT.md bolds the card\'s terms wherever it leans on them', () => {
  const entries = read('CONTEXT.md').split(/\n(?=\*\*)/);
  const bare = [];
  for (const term of ['Horizon', 'Page', 'Lap', 'Occasion', 'Cell', 'Stage', 'Breather', 'Footprint']) {
    const loose = new RegExp(`(?<!\\*)\\b${term}s?\\b(?!\\*)`, 'g');
    for (const e of entries) {
      if (e.startsWith(`**${term}**`)) continue; // a term's own entry may say it bare
      // Bolded runs, inline code and the _Avoid_ line are not prose leaning.
      const prose = e.replace(/\*\*.+?\*\*/g, '').replace(/`[^`]*`/g, '').replace(/^_Avoid_:.*$/gm, '');
      for (const m of prose.matchAll(loose)) {
        bare.push(`${term} in ${e.slice(0, 30).replace(/\n/g, ' ')}… — "${prose.slice(Math.max(0, m.index - 30), m.index + 30).trim().replace(/\n/g, ' ')}"`);
      }
    }
  }
  assert.deepEqual(bare, [], 'used as a term but not bolded, so nothing requires it to be defined');
});
