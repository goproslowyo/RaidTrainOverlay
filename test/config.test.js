import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseConfig, serializeConfig, resolveZone } from '../src/config.js';

test('parseConfig extracts the event slug from a query string', () => {
  const config = parseConfig('?event=trainwreck-lucky-13');
  assert.equal(config.event, 'trainwreck-lucky-13');
});

test('parseConfig returns a null event when the param is absent', () => {
  assert.equal(parseConfig('').event, null);
  assert.equal(parseConfig('?mode=pass').event, null);
});

test('parseConfig treats an empty event value as absent', () => {
  assert.equal(parseConfig('?event=').event, null);
  assert.equal(parseConfig('?event=%20%20').event, null);
});

test('parseConfig accepts a query string without a leading question mark', () => {
  assert.equal(parseConfig('event=trainwreck-lucky-13').event, 'trainwreck-lucky-13');
});

test('parseConfig ignores unknown and malformed params', () => {
  const config = parseConfig('?event=trainwreck-lucky-13&bogus=1&%%%');
  assert.equal(config.event, 'trainwreck-lucky-13');
  assert.deepEqual(Object.keys(config), [
    'event', 'lineup', 'lang', 'mode', 'interval', 'speed', 'track', 'trackfadein', 'trackfadeout', 'scale',
    'openslots', 'spotlight', 'tz', 'height', 'hidefinished', 'enginedim', 'refresh', 'theme',
  ]);
});

test('parseConfig carries a manual lineup blob raw, and defaults it to null', () => {
  assert.equal(parseConfig('?lineup=eyJhYmMiOjF9').lineup, 'eyJhYmMiOjF9');
  assert.equal(parseConfig('?event=x').lineup, null);
  assert.equal(parseConfig('').lineup, null);
});

test('serializeConfig emits lineup= only when there is no event (event wins; mutually exclusive)', () => {
  // lineup-only → emitted, right after where event would be.
  assert.equal(serializeConfig(parseConfig('?lineup=ABC123')), 'lineup=ABC123');
  // both present (a hand-crafted URL) → event wins, lineup dropped.
  const both = serializeConfig(parseConfig('?event=foo&lineup=ABC123'));
  assert.ok(both.includes('event=foo') && !both.includes('lineup'), both);
  // round-trips: serialize∘parse preserves a lineup-driven config.
  assert.equal(parseConfig(serializeConfig(parseConfig('?lineup=ABC123&theme=tron'))).lineup, 'ABC123');
});

test('parseConfig defaults mode to pass and accepts marquee case-insensitively', () => {
  assert.equal(parseConfig('?event=x').mode, 'pass');
  assert.equal(parseConfig('?event=x&mode=marquee').mode, 'marquee');
  assert.equal(parseConfig('?event=x&mode=MARQUEE').mode, 'marquee');
  // Garbage falls back to the default, silently (tolerance contract).
  assert.equal(parseConfig('?event=x&mode=banana').mode, 'pass');
});

test('parseConfig parses Pass interval minutes with default 15 and garbage fallback', () => {
  assert.equal(parseConfig('?event=x&interval=5').interval, 5);
  assert.equal(parseConfig('?event=x&interval=2.5').interval, 2.5);
  assert.equal(parseConfig('?event=x').interval, 15);
  assert.equal(parseConfig('?event=x&interval=0').interval, 15);
  assert.equal(parseConfig('?event=x&interval=-3').interval, 15);
  assert.equal(parseConfig('?event=x&interval=soon').interval, 15);
});

test('parseConfig parses the speed multiplier with default 1 and garbage fallback', () => {
  assert.equal(parseConfig('?event=x&speed=2').speed, 2);
  assert.equal(parseConfig('?event=x&speed=0.5').speed, 0.5);
  assert.equal(parseConfig('?event=x').speed, 1);
  assert.equal(parseConfig('?event=x&speed=0').speed, 1);
  assert.equal(parseConfig('?event=x&speed=fast').speed, 1);
});

test('parseConfig parses track as an enum, defaulting to always', () => {
  // Track visibility: always (default) vs periodic (fade out between Passes).
  assert.equal(parseConfig('?event=x').track, 'always');
  assert.equal(parseConfig('?event=x&track=periodic').track, 'periodic');
  assert.equal(parseConfig('?event=x&track=PERIODIC').track, 'periodic');
  assert.equal(parseConfig('?event=x&track=always').track, 'always');
  // Garbage / blank fall back to the default (tolerance contract).
  assert.equal(parseConfig('?event=x&track=banana').track, 'always');
  assert.equal(parseConfig('?event=x&track=').track, 'always');
});

test('parseConfig parses track fade durations as 0..120 seconds, defaulting 15 in / 10 out', () => {
  // Fade in/out seconds for track=periodic; 0 is a legal value (instant cut).
  assert.equal(parseConfig('?event=x').trackfadein, 15);
  assert.equal(parseConfig('?event=x').trackfadeout, 10);
  assert.equal(parseConfig('?event=x&trackfadein=20').trackfadein, 20);
  assert.equal(parseConfig('?event=x&trackfadeout=5').trackfadeout, 5);
  assert.equal(parseConfig('?event=x&trackfadein=0').trackfadein, 0); // 0 is valid
  assert.equal(parseConfig('?event=x&trackfadeout=0').trackfadeout, 0);
  // Out of range or non-numeric falls back to the default (tolerance contract).
  assert.equal(parseConfig('?event=x&trackfadein=999').trackfadein, 15);
  assert.equal(parseConfig('?event=x&trackfadein=-5').trackfadein, 15);
  assert.equal(parseConfig('?event=x&trackfadeout=soon').trackfadeout, 10);
});

test('parseConfig parses the scale multiplier as 0.5..2, defaulting to 1', () => {
  // A size multiplier on the default --train-height, distinct from
  // `height` (vertical position). 1 is the no-op default; max 2 (×30vh = 60vh).
  assert.equal(parseConfig('?event=x').scale, 1);
  assert.equal(parseConfig('?event=x&scale=1.5').scale, 1.5);
  assert.equal(parseConfig('?event=x&scale=0.5').scale, 0.5);
  assert.equal(parseConfig('?event=x&scale=2').scale, 2);
  // Out of range (either side) or non-numeric falls back to 1 (tolerance contract).
  assert.equal(parseConfig('?event=x&scale=0.1').scale, 1);
  assert.equal(parseConfig('?event=x&scale=3').scale, 1);
  assert.equal(parseConfig('?event=x&scale=0').scale, 1);
  assert.equal(parseConfig('?event=x&scale=-2').scale, 1);
  assert.equal(parseConfig('?event=x&scale=big').scale, 1);
});

test('parseConfig parses the openslots toggle, defaulting off', () => {
  // Open Slots are hidden by default — a clean confirmed-only lineup.
  assert.equal(parseConfig('?event=x').openslots, false);
  assert.equal(parseConfig('?event=x&openslots=1').openslots, true);
  assert.equal(parseConfig('?event=x&openslots=true').openslots, true);
  assert.equal(parseConfig('?event=x&openslots=on').openslots, true);
  assert.equal(parseConfig('?event=x&openslots=yes').openslots, true);
  assert.equal(parseConfig('?event=x&openslots=TRUE').openslots, true);
  // Anything else falls back to off (tolerance contract).
  assert.equal(parseConfig('?event=x&openslots=0').openslots, false);
  assert.equal(parseConfig('?event=x&openslots=banana').openslots, false);
  assert.equal(parseConfig('?event=x&openslots=').openslots, false);
});

test('parseConfig parses spotlight into a normalized lowercased name list', () => {
  // Lowercased once here so matching in the lineup-engine is case-insensitive.
  assert.deepEqual(parseConfig('?event=x&spotlight=DJ Alpha,dj charlie').spotlight, [
    'dj alpha', 'dj charlie',
  ]);
  // Absent / empty → no Spotlights.
  assert.deepEqual(parseConfig('?event=x').spotlight, []);
  assert.deepEqual(parseConfig('?event=x&spotlight=').spotlight, []);
  // Whitespace-only entries and blanks are dropped; remaining names are trimmed.
  assert.deepEqual(parseConfig('?event=x&spotlight=,, A ,,').spotlight, ['a']);
  assert.deepEqual(parseConfig('?event=x&spotlight=%20%20').spotlight, []);
});

test('parseConfig maps tz abbreviations to IANA zones, max 3, dropping garbage', () => {
  assert.deepEqual(parseConfig('?event=x&tz=PT,ET,GMT').tz, [
    { token: 'PT', zone: 'America/Los_Angeles' },
    { token: 'ET', zone: 'America/New_York' },
    { token: 'GMT', zone: 'UTC' },
  ]);
  // Raw IANA names pass through unchanged.
  assert.deepEqual(parseConfig('?event=x&tz=America/New_York').tz, [
    { token: 'America/New_York', zone: 'America/New_York' },
  ]);
  // Unknown / invalid zones are dropped silently.
  assert.deepEqual(parseConfig('?event=x&tz=PT,Bogus/Zone,ET').tz, [
    { token: 'PT', zone: 'America/Los_Angeles' },
    { token: 'ET', zone: 'America/New_York' },
  ]);
  // At most three zones (flyer parity); the rest are dropped.
  assert.deepEqual(parseConfig('?event=x&tz=PT,MT,CT,ET').tz.map((z) => z.token), [
    'PT', 'MT', 'CT',
  ]);
  // Absent → relative times (no absolute zones).
  assert.deepEqual(parseConfig('?event=x').tz, []);
  // Case-insensitive abbreviations.
  assert.deepEqual(parseConfig('?event=x&tz=pt').tz, [
    { token: 'PT', zone: 'America/Los_Angeles' },
  ]);
});

test('resolveZone resolves one token to a {token, zone} pair or null', () => {
  assert.deepEqual(resolveZone('et'), { token: 'ET', zone: 'America/New_York' });
  assert.deepEqual(resolveZone('Europe/Amsterdam'), {
    token: 'Europe/Amsterdam',
    zone: 'Europe/Amsterdam',
  });
  assert.equal(resolveZone('Bogus/Zone'), null);
  assert.equal(resolveZone(''), null);
});

test('parseConfig parses height as a 0..100 placement, defaulting to 100 (bottom)', () => {
  // Placement 0..100: 0 = top-flush, 100 = bottom-flush, 50 = centred.
  // Default 100 sits the Train at the bottom edge (tuned vs real OBS).
  assert.equal(parseConfig('?event=x').height, 100);
  assert.equal(parseConfig('?event=x&height=0').height, 0); // 0 is valid — not positiveNumber
  assert.equal(parseConfig('?event=x&height=100').height, 100);
  assert.equal(parseConfig('?event=x&height=33.5').height, 33.5);
  assert.equal(parseConfig('?event=x&height=50').height, 50);
  // Out of range or non-numeric falls back to the bottom default.
  assert.equal(parseConfig('?event=x&height=-5').height, 100);
  assert.equal(parseConfig('?event=x&height=150').height, 100);
  assert.equal(parseConfig('?event=x&height=abc').height, 100);
});

test('parseConfig parses the hidefinished toggle, defaulting off', () => {
  // Departed Cars dim by default; hidefinished opts into removing them entirely.
  assert.equal(parseConfig('?event=x').hidefinished, false);
  assert.equal(parseConfig('?event=x&hidefinished=1').hidefinished, true);
  assert.equal(parseConfig('?event=x&hidefinished=true').hidefinished, true);
  assert.equal(parseConfig('?event=x&hidefinished=on').hidefinished, true);
  // Anything else falls back to off (tolerance contract).
  assert.equal(parseConfig('?event=x&hidefinished=0').hidefinished, false);
  assert.equal(parseConfig('?event=x&hidefinished=banana').hidefinished, false);
});

test('parseConfig parses enginedim as an enum, defaulting to over', () => {
  assert.equal(parseConfig('?event=x').enginedim, 'over');
  assert.equal(parseConfig('?event=x&enginedim=never').enginedim, 'never');
  assert.equal(parseConfig('?event=x&enginedim=finished').enginedim, 'finished');
  assert.equal(parseConfig('?event=x&enginedim=OVER').enginedim, 'over');
  // Garbage / blank fall back to the default (tolerance contract).
  assert.equal(parseConfig('?event=x&enginedim=banana').enginedim, 'over');
  assert.equal(parseConfig('?event=x&enginedim=').enginedim, 'over');
});

test('parseConfig parses refresh minutes: off by default, floored at 15', () => {
  // Off (fetch-once) by default and for 0 / absent / negative / garbage.
  assert.equal(parseConfig('?event=x').refresh, 0);
  assert.equal(parseConfig('?event=x&refresh=0').refresh, 0);
  assert.equal(parseConfig('?event=x&refresh=soon').refresh, 0);
  assert.equal(parseConfig('?event=x&refresh=-5').refresh, 0);
  // Any positive value is floored to 15 to stay gentle on the shared RaidPal API.
  assert.equal(parseConfig('?event=x&refresh=5').refresh, 15);
  assert.equal(parseConfig('?event=x&refresh=15').refresh, 15);
  assert.equal(parseConfig('?event=x&refresh=30').refresh, 30);
  assert.equal(parseConfig('?event=x&refresh=22.5').refresh, 22.5);
});

test('parseConfig parses theme as an enum, defaulting to classic', () => {
  assert.equal(parseConfig('?event=x').theme, 'classic');
  assert.equal(parseConfig('?event=x&theme=classic').theme, 'classic');
  assert.equal(parseConfig('?event=x&theme=CLASSIC').theme, 'classic');
  // A shipped Theme key resolves to itself.
  assert.equal(parseConfig('?event=x&theme=flat').theme, 'flat');
  assert.equal(parseConfig('?event=x&theme=FLAT').theme, 'flat');
  assert.equal(parseConfig('?event=x&theme=synthwave').theme, 'synthwave');
  assert.equal(parseConfig('?event=x&theme=pixel').theme, 'pixel');
  // `neon` is the old mockup name for synthwave — kept as an alias.
  assert.equal(parseConfig('?event=x&theme=neon').theme, 'synthwave');
  assert.equal(parseConfig('?event=x&theme=NEON').theme, 'synthwave');
  // The four new Themes resolve by their canonical keys.
  assert.equal(parseConfig('?event=x&theme=highvibes').theme, 'highvibes');
  assert.equal(parseConfig('?event=x&theme=jazz').theme, 'jazz');
  assert.equal(parseConfig('?event=x&theme=bullet').theme, 'bullet');
  assert.equal(parseConfig('?event=x&theme=lava').theme, 'lava');
  // …and by their friendly aliases (case-insensitive), like neon→synthwave.
  assert.equal(parseConfig('?event=x&theme=smoke').theme, 'highvibes');
  assert.equal(parseConfig('?event=x&theme=coltrane').theme, 'jazz');
  assert.equal(parseConfig('?event=x&theme=SHINKANSEN').theme, 'bullet');
  assert.equal(parseConfig('?event=x&theme=lavalamp').theme, 'lava');
  // Unknown / garbage Theme keys fall back to the default (tolerance contract).
  assert.equal(parseConfig('?event=x&theme=banana').theme, 'classic');
  assert.equal(parseConfig('?event=x&theme=').theme, 'classic');
});

test('serializeConfig emits only non-default params, keeping the URL minimal', () => {
  // Bare event: every other param is at its default and is omitted.
  assert.equal(serializeConfig(parseConfig('?event=x')), 'event=x');
  // Non-default Mode params serialize; defaults stay omitted.
  assert.equal(
    serializeConfig(parseConfig('?event=x&mode=marquee&interval=5&speed=2')),
    'event=x&mode=marquee&interval=5&speed=2',
  );
  // track serializes only when periodic; the always default stays omitted.
  assert.equal(serializeConfig(parseConfig('?event=x&track=periodic')), 'event=x&track=periodic');
  assert.equal(serializeConfig(parseConfig('?event=x&track=always')), 'event=x');
  // Fade durations serialize on their own non-default value; defaults (15/10) stay omitted.
  assert.equal(serializeConfig(parseConfig('?event=x&trackfadein=20&trackfadeout=5')), 'event=x&trackfadein=20&trackfadeout=5');
  assert.equal(serializeConfig(parseConfig('?event=x&trackfadein=15&trackfadeout=10')), 'event=x');
  assert.equal(serializeConfig(parseConfig('?event=x&trackfadeout=0')), 'event=x&trackfadeout=0');
  // openslots serializes as 1 only when on; height only when off its default.
  assert.equal(
    serializeConfig(parseConfig('?event=x&openslots=1&height=20')),
    'event=x&openslots=1&height=20',
  );
  // The bottom default (100) is omitted; other placements serialize.
  assert.equal(serializeConfig(parseConfig('?event=x&height=100')), 'event=x');
  assert.equal(serializeConfig(parseConfig('?event=x&height=50')), 'event=x&height=50');
  // scale serializes only when off the default 1; out-of-range falls back and is omitted.
  assert.equal(serializeConfig(parseConfig('?event=x&scale=1.5')), 'event=x&scale=1.5');
  assert.equal(serializeConfig(parseConfig('?event=x&scale=1')), 'event=x');
  assert.equal(serializeConfig(parseConfig('?event=x&scale=99')), 'event=x');
  // Lifecycle params: hidefinished only when on; enginedim only when not `over`.
  assert.equal(
    serializeConfig(parseConfig('?event=x&hidefinished=1&enginedim=never')),
    'event=x&hidefinished=1&enginedim=never',
  );
  assert.equal(serializeConfig(parseConfig('?event=x&enginedim=over')), 'event=x');
  // refresh serializes only when on (> 0), carrying the floored value; off stays omitted.
  assert.equal(serializeConfig(parseConfig('?event=x&refresh=30')), 'event=x&refresh=30');
  assert.equal(serializeConfig(parseConfig('?event=x&refresh=5')), 'event=x&refresh=15');
  assert.equal(serializeConfig(parseConfig('?event=x&refresh=0')), 'event=x');
  // lang serializes only when set and not the default English; it sorts right after event.
  assert.equal(serializeConfig(parseConfig('?event=x&lang=de')), 'event=x&lang=de');
  assert.equal(serializeConfig(parseConfig('?event=x&lang=es-MX')), 'event=x&lang=es-MX');
  assert.equal(serializeConfig(parseConfig('?event=x&lang=en')), 'event=x');
  // No event → nothing to render → empty string (defensive; Configurator always has one).
  assert.equal(serializeConfig(parseConfig('')), '');
});

test('serializeConfig omits theme at the default and emits a non-default Theme', () => {
  // Default classic is omitted (omit-defaults rule), so a bare event stays minimal.
  assert.equal(serializeConfig(parseConfig('?event=x&theme=classic')), 'event=x');
  // A shipped non-default Theme round-trips through the enum.
  assert.equal(serializeConfig(parseConfig('?event=x&theme=flat')), 'event=x&theme=flat');
  // An unshipped key still serializes if set directly — the Theme seam.
  assert.equal(
    serializeConfig({ ...parseConfig('?event=x'), theme: 'synthwave' }),
    'event=x&theme=synthwave',
  );
});

test('parse(serialize(parse(q))) round-trips every param (the Configurator contract)', () => {
  // Normal form: serialize then re-parse must reproduce the parsed config, for
  // any query string — including garbage, which parse has already normalized away.
  const cases = [
    'event=x',
    'event=x&mode=marquee&interval=5&speed=2&scale=1.5&openslots=1&spotlight=dj alpha,dj charlie&tz=PT,ET,GMT&height=20',
    'event=x&track=periodic&interval=7',
    'event=x&track=periodic&trackfadein=20&trackfadeout=5',
    'event=x&trackfadeout=0&trackfadein=8',
    'event=x&mode=banana&interval=0&scale=0&tz=PT,Bogus,ET&height=999&bogus=1',
    'event=x&scale=999',
    'event=x&tz=Europe/Amsterdam&spotlight=Solo',
    'event=x&hidefinished=1&enginedim=finished',
    'event=x&enginedim=banana&hidefinished=nope',
    'event=x&refresh=30',
    'event=x&refresh=5',
    'event=x&lang=de',
    'event=x&lang=es-MX&theme=flat',
  ];
  for (const query of cases) {
    const parsed = parseConfig(query);
    assert.deepEqual(parseConfig(serializeConfig(parsed)), parsed, `round-trip failed for: ${query}`);
  }
});
