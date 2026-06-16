import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig } from '../src/config.js';
import { extractSlug, buildOverlayQuery } from '../src/configurator.js';

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
  // Non-default params are emitted in the schema's canonical order.
  assert.equal(
    buildOverlayQuery({ event: 'x', mode: 'marquee', interval: '5', speed: '2' }),
    'event=x&mode=marquee&interval=5&speed=2',
  );
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
