import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseConfig } from '../src/config.js';
import { extractSlug, buildOverlayQuery } from '../src/configurator.js';
import { decodeLineup } from '../src/lineup-codec.js';

test('extractSlug returns a bare slug unchanged and rejects non-slug garbage', () => {
  assert.equal(extractSlug('trainwreck-lucky-13'), 'trainwreck-lucky-13');
  assert.equal(extractSlug('team-sugar-rush-raid-train-6phm'), 'team-sugar-rush-raid-train-6phm');
  // Surrounding whitespace is trimmed.
  assert.equal(extractSlug('  trainwreck-lucky-13  '), 'trainwreck-lucky-13');
  // A slug that merely contains the word "event" (no slash) is still a bare slug.
  assert.equal(extractSlug('my-event-2026'), 'my-event-2026');
  // Garbage → null.
  assert.equal(extractSlug(''), null);
  assert.equal(extractSlug('   '), null);
  assert.equal(extractSlug(null), null);
  assert.equal(extractSlug(undefined), null);
  assert.equal(extractSlug('not a slug!'), null);
  assert.equal(extractSlug('https://example.com/foo'), null);
});

test('extractSlug pulls the slug from pasted RaidPal URLs across their many shapes', () => {
  const slug = 'trainwreck-lucky-13';
  // The fixture shape, and the indexed-page shape with a locale segment.
  assert.equal(extractSlug(`https://raidpal.com/event/${slug}`), slug);
  assert.equal(extractSlug(`https://raidpal.com/en/event/${slug}`), slug);
  assert.equal(extractSlug(`https://raidpal.com/de/event/foo-bar`), 'foo-bar');
  // www / no-www / no-protocol.
  assert.equal(extractSlug(`https://www.raidpal.com/en/event/${slug}`), slug);
  assert.equal(extractSlug(`http://raidpal.com/en/event/${slug}`), slug);
  assert.equal(extractSlug(`raidpal.com/en/event/${slug}`), slug);
  // Trailing slash, query string, fragment.
  assert.equal(extractSlug(`https://raidpal.com/event/${slug}/`), slug);
  assert.equal(extractSlug(`https://raidpal.com/event/${slug}?utm=x`), slug);
  assert.equal(extractSlug(`https://raidpal.com/event/${slug}#lineup`), slug);
  // A pasted API URL works too (shares the event/<slug> tail).
  assert.equal(extractSlug(`https://api.raidpal.com/rest/event/${slug}`), slug);
  // A marker with no slug after it → null.
  assert.equal(extractSlug('https://raidpal.com/en/event/'), null);
});

test('buildOverlayQuery serializes a minimal Overlay URL from form state, omitting defaults', () => {
  // Just an event → minimal query.
  assert.equal(buildOverlayQuery({ event: 'trainwreck-lucky-13' }), 'event=trainwreck-lucky-13');
  // A form sitting entirely on defaults still serializes to just the event.
  assert.equal(buildOverlayQuery({
    event: 'x', mode: 'pass', interval: '15', speed: '1',
    openslots: false, spotlight: '', tz: '', scale: '1', height: '100',
  }), 'event=x');
  // Auto language (blank) intentionally omits lang; explicit English serializes.
  assert.equal(buildOverlayQuery({ event: 'x', lang: '' }), 'event=x');
  assert.equal(buildOverlayQuery({ event: 'x', lang: 'en' }), 'event=x&lang=en');
  // Non-default params are emitted in the schema's canonical order.
  assert.equal(
    buildOverlayQuery({ event: 'x', mode: 'marquee', interval: '5', speed: '2' }),
    'event=x&mode=marquee&interval=5&speed=2',
  );
  // track=always flows through; the periodic default is dropped by the round-trip.
  assert.equal(buildOverlayQuery({ event: 'x', track: 'always' }), 'event=x&track=always');
  assert.equal(buildOverlayQuery({ event: 'x', track: 'periodic' }), 'event=x');
  // Fade durations flow through; defaults (15/10) drop, out-of-range falls back.
  assert.equal(buildOverlayQuery({ event: 'x', track: 'periodic', trackfadein: '20', trackfadeout: '5' }),
    'event=x&trackfadein=20&trackfadeout=5');
  assert.equal(buildOverlayQuery({ event: 'x', trackfadein: '15', trackfadeout: '10' }), 'event=x');
  assert.equal(buildOverlayQuery({ event: 'x', trackfadein: '999' }), 'event=x');
  assert.equal(buildOverlayQuery({ event: 'x', openslots: true, height: '20' }), 'event=x&openslots=1&height=20');
  // No usable slug → empty query (the serializer emits nothing without an event).
  assert.equal(buildOverlayQuery({ event: '' }), '');
  assert.equal(buildOverlayQuery({}), '');
});

test('buildOverlayQuery tolerates garbage and normalizes spotlight and timezones', () => {
  // Garbage numerics fall back to defaults → omitted.
  assert.equal(buildOverlayQuery({ event: 'x', interval: 'soon', speed: 'fast', height: '999' }), 'event=x');
  // Spotlight names are lowercased by the schema (space → '+', comma → '%2C').
  assert.equal(buildOverlayQuery({ event: 'x', spotlight: 'DJ Alpha, dj charlie' }),
    'event=x&spotlight=dj+alpha%2Cdj+charlie');
  // tz tokens are normalized to the canonical display tokens, capped at 3, garbage dropped.
  assert.equal(buildOverlayQuery({ event: 'x', tz: 'pt,et,gmt' }), 'event=x&tz=PT%2CET%2CGMT');
  assert.equal(buildOverlayQuery({ event: 'x', tz: 'PT,Bogus/Zone,ET' }), 'event=x&tz=PT%2CET');
});

test('buildOverlayQuery carries scale, omitting the default and dropping out-of-range', () => {
  // A real multiplier passes through; the default 1 is omitted (omit-defaults rule).
  assert.equal(buildOverlayQuery({ event: 'x', scale: '1.5' }), 'event=x&scale=1.5');
  assert.equal(buildOverlayQuery({ event: 'x', scale: '1' }), 'event=x');
  // Out of range / garbage / blank fall back to the default via the schema → omitted.
  assert.equal(buildOverlayQuery({ event: 'x', scale: '99' }), 'event=x');
  assert.equal(buildOverlayQuery({ event: 'x', scale: 'big' }), 'event=x');
  assert.equal(buildOverlayQuery({ event: 'x', scale: '' }), 'event=x');
});

test('buildOverlayQuery extracts the slug when the event field holds a pasted RaidPal URL', () => {
  assert.equal(
    buildOverlayQuery({ event: 'https://raidpal.com/en/event/trainwreck-lucky-13', mode: 'marquee' }),
    'event=trainwreck-lucky-13&mode=marquee',
  );
});

test('buildOverlayQuery includes the lifecycle params, omitting their defaults', () => {
  assert.equal(
    buildOverlayQuery({ event: 'x', hidefinished: true, enginedim: 'never' }),
    'event=x&hidefinished=1&enginedim=never',
  );
  // Defaults (off / over) are omitted by the serializer.
  assert.equal(buildOverlayQuery({ event: 'x', hidefinished: false, enginedim: 'over' }), 'event=x');
  // Round-trips back to the same config the form described.
  const fs = { event: 'x', hidefinished: true, enginedim: 'finished' };
  assert.deepEqual(
    parseConfig(buildOverlayQuery(fs)),
    parseConfig('event=x&hidefinished=1&enginedim=finished'),
  );
});

test('buildOverlayQuery omits the default Theme and falls back on unshipped keys', () => {
  // classic is the default → omitted, so the picker on its sole option stays minimal.
  assert.equal(buildOverlayQuery({ event: 'x', theme: 'classic' }), 'event=x');
  // A shipped non-default Theme is carried through the round-trip.
  assert.equal(buildOverlayQuery({ event: 'x', theme: 'synthwave' }), 'event=x&theme=synthwave');
  // An unknown Theme key falls back to classic via the schema and is omitted.
  assert.equal(buildOverlayQuery({ event: 'x', theme: 'banana' }), 'event=x');
  // The form's Theme flows through buildOverlayQuery's round-trip, not dropped en route.
  assert.deepEqual(parseConfig(buildOverlayQuery({ event: 'x', theme: 'classic' })).theme, 'classic');
});

test('buildOverlayQuery carries refresh, flooring and dropping via the schema round-trip', () => {
  // A real cadence above the floor passes through.
  assert.equal(buildOverlayQuery({ event: 'x', refresh: '30' }), 'event=x&refresh=30');
  // Below the floor is clamped to 15 by the schema.
  assert.equal(buildOverlayQuery({ event: 'x', refresh: '5' }), 'event=x&refresh=15');
  // Off / blank / garbage → omitted (fetch-once default).
  assert.equal(buildOverlayQuery({ event: 'x', refresh: '0' }), 'event=x');
  assert.equal(buildOverlayQuery({ event: 'x', refresh: '' }), 'event=x');
  assert.equal(buildOverlayQuery({ event: 'x', refresh: 'often' }), 'event=x');
});

test('buildOverlayQuery output round-trips through parseConfig, reproducing the form state', () => {
  // The Configurator↔Overlay contract: the query a DJ copies parses back to the
  // exact config the form described (the acceptance criterion, pinned here).
  const formState = {
    event: 'trainwreck-lucky-13', mode: 'marquee', interval: '5', speed: '2', scale: '1.5',
    openslots: true, spotlight: 'DJ Alpha, dj charlie', tz: 'pt,et', height: '20',
  };
  const fromForm = parseConfig(buildOverlayQuery(formState));
  // The same config expressed as a hand-written query the Overlay would receive.
  const fromUrl = parseConfig(
    'event=trainwreck-lucky-13&mode=marquee&interval=5&speed=2&scale=1.5&openslots=1&spotlight=dj alpha,dj charlie&tz=pt,et&height=20',
  );
  assert.deepEqual(fromForm, fromUrl);
});

test('buildOverlayQuery in manual mode emits a decodable ?lineup= and carries the same knobs', () => {
  const q = buildOverlayQuery({
    source: 'manual',
    manual: {
      title: 'Sat Bass Train', organiser: '@djhost',
      zone: 'UTC', startISO: '2026-06-27T20:00', slotMins: 60,
      djs: [{ handle: '@nikkid', slots: 2 }, { handle: 'https://twitch.tv/basslines', slots: 1 }],
    },
    theme: 'tron', mode: 'marquee',
  });
  const cfg = parseConfig(q);
  assert.equal(cfg.event, null, 'no event in manual mode');
  assert.ok(cfg.lineup, 'a lineup blob is emitted');
  assert.equal(cfg.theme, 'tron');     // knobs shared
  assert.equal(cfg.mode, 'marquee');
  const model = decodeLineup(cfg.lineup);
  assert.equal(model.t, 'Sat Bass Train');
  assert.deepEqual(model.o, { n: 'djhost' }); // @ stripped; no avatar field (handle-only organiser)
  assert.deepEqual(model.d, [{ h: 'nikkid', d: 120 }, { h: 'basslines', d: 60 }]); // handles cleaned
  assert.equal(model.s, '2026-06-27T20:00:00.000Z'); // UTC wall clock → same instant
});

test('buildOverlayQuery manual mode with no usable DJs emits neither lineup nor event', () => {
  assert.equal(buildOverlayQuery({ source: 'manual', manual: { djs: [] }, theme: 'tron' }), 'theme=tron');
  assert.equal(buildOverlayQuery({ source: 'manual', manual: { djs: [{ handle: '   ', slots: 1 }] } }), '');
});

// The "when the card appears" three-way. Its three positions map onto the URL
// as: card absent / card + upgap=0 / card alone.
test('the three-way maps onto the URL in all three positions', () => {
  const off = buildOverlayQuery({ user: 'goproflowyo' });
  assert.ok(!off.includes('upcoming'), 'Never: no card at all');
  assert.ok(!off.includes('upgap'));

  const betweenOnly = buildOverlayQuery({ user: 'goproflowyo', upcoming: '3', upgap: '0' });
  assert.ok(betweenOnly.includes('upcoming=3'));
  assert.ok(betweenOnly.includes('upgap=0'), 'Between trains only: the occasion is opted out');

  const both = buildOverlayQuery({ user: 'goproflowyo', upcoming: '3' });
  assert.ok(both.includes('upcoming=3'));
  assert.ok(!both.includes('upgap'), 'the default never bloats the URL');
});

test('upgap only ever rides with a Live Link', () => {
  const q = buildOverlayQuery({ source: 'event', event: 'trainwreck-lucky-13', upgap: '0' });
  assert.ok(!q.includes('upgap'), 'without a Live Link there is no other-trains card to gate');
});

/**
 * WHAT THIS TEST DOES NOT COVER. A URL row is a read-only box, a Preview
 * anchor and a copy button that must never disagree (#87: the anchor opened
 * the settings from before the last edit). The row is built and written inside
 * configurator.html's inline `<script type="module">`, which no test can
 * import, so nothing here observes a live `href`, a live input value or what
 * the copy action actually produces. Those three were compared by hand in a
 * browser. This is a source-text guard of the SHAPE only — that one function
 * emits both faces from one URL, that one function writes both, and that no
 * caller can address either face alone — in the same idiom as the greps in
 * test/upcoming-card.test.js. It is a fence around the fix, not proof of it.
 */
test('one place writes a URL row, so its Preview anchor cannot lag its box', () => {
  const page = readFileSync(new URL('../configurator.html', import.meta.url), 'utf8');
  const body = (name) => {
    const m = page.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}`));
    assert.ok(m, `${name} is declared in configurator.html`);
    return m[0];
  };

  // The anchor knows which box it stands beside. Before #87 it carried nothing
  // to be found by, which is why the edit paths could only reach the box.
  assert.match(body('previewLinkHtml'), /data-preview-for="\$\{inputId\}"/,
    'the Preview anchor must carry the id of the input it belongs to');

  // Both faces come from ONE url argument at render time.
  const row = body('urlRowHtml');
  assert.match(row, /<input type="text" id="\$\{inputId\}"[^>]*value="\$\{esc\(url\)\}"/,
    'urlRowHtml emits the box from its url argument');
  assert.match(row, /previewLinkHtml\(inputId, url/,
    'urlRowHtml emits the anchor from the SAME url argument');

  // ...and nowhere else. Every call outside the declaration is urlRowHtml's.
  for (const [, args] of page.matchAll(/(?<!function )previewLinkHtml\(([^)]*)\)/g)) {
    assert.match(args, /^inputId, url\b/,
      'the Preview anchor is only ever emitted by urlRowHtml, beside its own box');
  }

  // One way to say: this row now shows this URL — and it writes both faces.
  const setter = body('setUrlRow');
  assert.match(setter, /input\.value = url/, 'setUrlRow writes the box');
  assert.match(setter, /\.href = url/, 'setUrlRow writes the anchor');

  // No caller may reach a row's input on its own, and no view may hand-roll a
  // row's markup — either would let one face move without the other.
  assert.doesNotMatch(page, /\$\('#ll-(?:uponly-)?url'\)/,
    'a row is written through setUrlRow, never by looking its input up alone');
  assert.doesNotMatch(page, /<input[^>]*id="ll-(?:uponly-)?url"/,
    'a row is rendered through urlRowHtml, never as loose input markup');

  // Both affected rows are built by the row builder. (The One-off row is out
  // of scope: it carries a copy button and no Preview anchor.)
  for (const id of ['ll-url', 'll-uponly-url']) {
    assert.ok(page.includes(`urlRowHtml('${id}'`), `${id} is built by urlRowHtml`);
  }

  // Both in-place edit paths refresh BOTH rows: the upcoming-trains URL is the
  // Live Link with ?uponly=1 riding along, so every edit moves both.
  for (const name of ['refreshSimpleChrome', 'writeUpcomingPref']) {
    const path = body(name);
    assert.match(path, /setUrlRow\('ll-url', liveLinkUrl\(\)\)/, `${name} refreshes the Live Link row`);
    assert.match(path, /setUrlRow\('ll-uponly-url', upOnlyUrl\(\)\)/, `${name} refreshes the upcoming-trains row`);
  }
});
