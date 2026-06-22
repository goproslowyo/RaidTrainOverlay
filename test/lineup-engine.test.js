import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTrain, formatRelativeTime, formatAbsoluteTime } from '../src/lineup-engine.js';
import { normalizeEvent } from '../src/raidpal-client.js';
import { makeEventPayload } from './fixtures/event-payload.js';
import { loadMessages, makeT } from '../src/i18n/index.js';

// Fixture (occupied orders 0/2/3 + Open Slot 1), Slots 60min from 18:00Z:
//   order 0 DJ Alpha   18:00  ← the first passenger Car (kicks off the stream)
//   order 1 (open)     19:00
//   order 2 DJ Charlie 20:00  ┐ the rest of the Cars
//   order 3 DJ Caboose 21:00  ┘
// The Organiser (DJ Organiser) drives the LOCOMOTIVE — the conductor of the train.
const NOW = new Date('2026-06-16T19:30:00Z');
const CONFIG = { event: 'trainwreck-lucky-13' };

test('the Organiser drives the loco; every booked streamer is a Car', () => {
  const payload = makeEventPayload();
  payload.event.time_table = payload.event.time_table.filter((slot) => slot.slot_occupied);
  const train = buildTrain(normalizeEvent(payload), NOW, CONFIG);

  assert.equal(train.engine.broadcaster, null); // the loco is the Organiser, not a slot streamer
  assert.deepEqual(train.cars.map((car) => car.slotOrder), [0, 2, 3]);
  assert.deepEqual(
    train.cars.map((car) => car.broadcaster.displayName),
    ['DJ Alpha', 'DJ Charlie', 'DJ Caboose'],
  );
});

test('buildTrain excludes Open Slots from the Train', () => {
  // Default fixture: occupied orders 0, 2, 3 plus an Open Slot at order 1.
  const train = buildTrain(normalizeEvent(makeEventPayload()), NOW, CONFIG);

  // Cars = Alpha (0), Charlie (2), Caboose (3); the Open Slot is hidden.
  assert.equal(train.cars.length, 3);
  assert.ok(!train.cars.some((car) => car.slotOrder === 1));
  assert.ok(!train.cars.some((car) => car.isOpen));
});

test('only the last Car is the Caboose; the Engine is the Organiser', () => {
  const train = buildTrain(normalizeEvent(makeEventPayload()), NOW, CONFIG);
  assert.deepEqual(
    train.cars.map((car) => car.isCaboose),
    [false, false, true], // Alpha, Charlie, Caboose
  );

  const single = makeEventPayload();
  single.event.time_table = [single.event.time_table[1]]; // DJ Alpha (order 0) only
  const singleTrain = buildTrain(normalizeEvent(single), NOW, CONFIG);
  // A lone streamer is a Car (first and last → the Caboose); the loco is the Organiser.
  assert.equal(singleTrain.cars.length, 1);
  assert.equal(singleTrain.cars[0].broadcaster.displayName, 'DJ Alpha');
  assert.equal(singleTrain.cars[0].isCaboose, true);
  assert.equal(singleTrain.engine.broadcaster, null);
});

test('buildTrain credits the Organiser (who drives the loco) and exposes the Event title', () => {
  const train = buildTrain(normalizeEvent(makeEventPayload()), NOW, CONFIG);

  assert.equal(train.title, 'Trainwreck & Friends');
  assert.equal(train.organiser.displayName, 'DJ Organiser');
  assert.equal(train.organiser.image, 'https://example.test/avatars/organiser.png');
  // The Organiser drives the loco — the Engine carries no slot streamer.
  assert.equal(train.engine.broadcaster, null);
});

test('the first streamer\'s Car carries the Now Marker — never the loco', () => {
  const event = normalizeEvent(makeEventPayload());

  // Alpha's Slot is 18:00–19:00 → Alpha's CAR carries the Marker; the loco never does.
  const duringAlpha = buildTrain(event, new Date('2026-06-16T18:30:00Z'), CONFIG);
  assert.equal(duringAlpha.engine.isCurrent, false);
  assert.equal(duringAlpha.cars[0].broadcaster.displayName, 'DJ Alpha');
  assert.deepEqual(duringAlpha.cars.map((car) => car.isCurrent), [true, false, false]);

  // 20:30: Charlie's Slot → the Marker moves to Charlie's Car.
  const at2030 = buildTrain(event, new Date('2026-06-16T20:30:00Z'), CONFIG);
  assert.equal(at2030.engine.isCurrent, false);
  assert.deepEqual(at2030.cars.map((car) => car.isCurrent), [false, true, false]);
});

test('the Now Marker window is inclusive of Slot start and exclusive of Slot end', () => {
  const event = normalizeEvent(makeEventPayload());

  const atStart = buildTrain(event, new Date('2026-06-16T18:00:00.000Z'), CONFIG);
  assert.equal(atStart.cars[0].isCurrent, true); // Alpha at 18:00 exactly
  assert.equal(atStart.engine.isCurrent, false);

  const atEnd = buildTrain(event, new Date('2026-06-16T19:00:00.000Z'), CONFIG);
  assert.equal(atEnd.cars[0].isCurrent, false); // Alpha's Slot has ended
  assert.ok(atEnd.cars.every((car) => !car.isCurrent));
});

test('the first streamer\'s Car departs once their Slot ends, but the loco isn\'t dimmed mid-event', () => {
  const at2030 = buildTrain(normalizeEvent(makeEventPayload()), new Date('2026-06-16T20:30:00Z'), CONFIG);

  // Alpha's Slot (18:00–19:00) is over, so Alpha's Car is departed…
  assert.equal(at2030.cars[0].isDeparted, true);
  // …and the locomotive (the Organiser) has no Slot, so it is neither current nor
  // departed, and is not dimmed mid-event.
  assert.equal(at2030.engine.isDeparted, false);
  assert.equal(at2030.engine.isDimmed, false);
  assert.deepEqual(at2030.cars.map((car) => car.isDeparted), [true, false, false]);
});

test('pre-event Train has no current Car, nothing departed, phase pre', () => {
  const at1700 = buildTrain(normalizeEvent(makeEventPayload()), new Date('2026-06-16T17:00:00Z'), CONFIG);

  assert.equal(at1700.phase, 'pre');
  assert.equal(at1700.engine.isCurrent, false);
  assert.equal(at1700.engine.isDeparted, false);
  assert.ok(at1700.cars.every((car) => !car.isCurrent && !car.isDeparted));
});

test('post-event Train is fully departed with no current Car, phase post', () => {
  const event = normalizeEvent(makeEventPayload());

  // One millisecond before the last Slot ends, the Caboose is still current.
  const lastInstant = buildTrain(event, new Date('2026-06-16T21:59:59.999Z'), CONFIG);
  assert.equal(lastInstant.phase, 'live');
  assert.equal(lastInstant.cars.at(-1).isCurrent, true);

  // At the last Slot's exact end the Event is over, and the loco dims.
  const atEnd = buildTrain(event, new Date('2026-06-16T22:00:00.000Z'), CONFIG);
  assert.equal(atEnd.phase, 'post');
  assert.equal(atEnd.engine.isDimmed, true);
  assert.ok(atEnd.cars.every((car) => car.isDeparted));
  assert.ok(atEnd.cars.every((car) => !car.isCurrent));
});

test('no Car is current while the current timetable Slot is an Open Slot', () => {
  // 19:30 falls inside the fixture's Open Slot (order 1). Alpha (the first Car) has
  // departed; no Car carries the Now Marker because the live Slot has no Broadcaster.
  const train = buildTrain(normalizeEvent(makeEventPayload()), NOW, CONFIG);

  assert.equal(train.phase, 'live');
  assert.ok(train.cars.every((car) => !car.isCurrent));
  assert.deepEqual(train.cars.map((car) => car.isDeparted), [true, false, false]); // Alpha departed
});

test('buildTrain shows Open Slot Cars labeled OPEN when config.openslots is on', () => {
  const event = normalizeEvent(makeEventPayload());
  const train = buildTrain(event, NOW, { ...CONFIG, openslots: true });

  // Cars = Alpha (0), the open Slot (1), Charlie (2), Caboose (3).
  assert.deepEqual(train.cars.map((car) => car.slotOrder), [0, 1, 2, 3]);

  const open = train.cars.find((car) => car.slotOrder === 1);
  assert.equal(open.isOpen, true);
  assert.equal(open.broadcaster, null);
  assert.equal(open.displayName, 'OPEN');

  // The open Slot is live at 19:30, so its Car now carries the Now Marker.
  assert.equal(open.isCurrent, true);

  // The Caboose stays the last Broadcaster's Car, never an Open Slot.
  assert.deepEqual(train.cars.map((car) => car.isCaboose), [false, false, false, true]);
});

test('an Open Slot never becomes the Caboose, even when it sorts last', () => {
  const payload = makeEventPayload();
  payload.event.time_table.push({
    order: 4,
    starttime: '2026-06-16T22:00:00Z',
    slot_occupied: false,
    user_timezone: 'UTC',
    broadcaster_display_name: null,
    broadcaster_image: null,
    broadcaster_live: false,
    broadcaster_id: null,
  });
  const train = buildTrain(normalizeEvent(payload), NOW, { ...CONFIG, openslots: true });

  // Cars = 0, 1, 2, 3, 4.
  assert.deepEqual(train.cars.map((car) => car.slotOrder), [0, 1, 2, 3, 4]);
  const cabeese = train.cars.filter((car) => car.isCaboose);
  assert.equal(cabeese.length, 1);
  assert.equal(cabeese[0].slotOrder, 3); // DJ Caboose, not the trailing open order 4
});

test('buildTrain stamps isSpotlit on the Car whose Broadcaster is spotlit, never the loco', () => {
  const event = normalizeEvent(makeEventPayload());

  // A spotlit Car glows; the Engine (Organiser) does not.
  const lit = buildTrain(event, NOW, { ...CONFIG, spotlight: ['dj charlie'] });
  assert.deepEqual(
    lit.cars.map((c) => [c.broadcaster.displayName, c.isSpotlit]),
    [['DJ Alpha', false], ['DJ Charlie', true], ['DJ Caboose', false]],
  );
  assert.equal(lit.engine.isSpotlit, false);

  // Spotlighting the first streamer lights their Car, not the loco.
  const first = buildTrain(event, NOW, { ...CONFIG, spotlight: ['dj alpha'] });
  assert.equal(first.cars[0].isSpotlit, true);
  assert.equal(first.engine.isSpotlit, false);

  // No spotlight config → nobody spotlit.
  const none = buildTrain(event, NOW, CONFIG);
  assert.equal(none.engine.isSpotlit, false);
  assert.ok(none.cars.every((c) => !c.isSpotlit));
});

test('Spotlight matches the decoded Broadcaster name and never an Open Slot', () => {
  const payload = makeEventPayload();
  // Rename Charlie (a Car) to "DJ R&B" via its encoded form.
  payload.event.time_table[0].broadcaster_display_name = 'DJ R&amp;B';
  const event = normalizeEvent(payload);

  const train = buildTrain(event, NOW, { ...CONFIG, spotlight: ['dj r&b'], openslots: true });
  const spotlit = train.cars.filter((car) => car.isSpotlit);
  assert.equal(spotlit.length, 1);
  assert.equal(spotlit[0].broadcaster.displayName, 'DJ R&B');
  // Open Slot Cars carry no Broadcaster, so they are never spotlit.
  assert.ok(train.cars.filter((car) => car.isOpen).every((car) => !car.isSpotlit));
});

test('formatRelativeTime renders upcoming times in minutes under an hour', () => {
  const now = new Date('2026-06-16T12:00:00Z');
  const at = (iso) => formatRelativeTime(new Date(iso), now);

  assert.equal(at('2026-06-16T12:00:00.001Z'), 'in 1m');
  assert.equal(at('2026-06-16T12:45:00Z'), 'in 45m');
  assert.equal(at('2026-06-16T12:59:00Z'), 'in 59m');
});

test('formatRelativeTime renders upcoming times in hours and days', () => {
  const now = new Date('2026-06-16T12:00:00Z');
  const at = (iso) => formatRelativeTime(new Date(iso), now);

  assert.equal(at('2026-06-16T12:59:01Z'), 'in 1h');
  assert.equal(at('2026-06-16T13:00:00Z'), 'in 1h');
  assert.equal(at('2026-06-16T13:30:00Z'), 'in 1h30m');
  assert.equal(at('2026-06-17T11:59:00Z'), 'in 23h59m');
  assert.equal(at('2026-06-17T12:00:00Z'), 'in 1d');
  assert.equal(at('2026-06-17T18:00:00Z'), 'in 1d6h');
  assert.equal(at('2026-06-20T12:00:00Z'), 'in 4d');
});

test('buildTrain stamps every Car with its relative time string; the loco has none', () => {
  const event = normalizeEvent(makeEventPayload());

  const preEvent = buildTrain(event, new Date('2026-06-16T17:00:00Z'), CONFIG);
  assert.equal(preEvent.engine.relativeTime, ''); // the loco (Organiser) has no Slot time
  assert.deepEqual(preEvent.cars.map((car) => car.relativeTime), ['in 1h', 'in 3h', 'in 4h']);

  // 20:30: Alpha departed (empty), Charlie current, Caboose 30 minutes out.
  const live = buildTrain(event, new Date('2026-06-16T20:30:00Z'), CONFIG);
  assert.equal(live.engine.relativeTime, '');
  assert.deepEqual(live.cars.map((car) => car.relativeTime), ['', 'NOW', 'in 30m']);
});

// A parsed tz list (PT, ET, GMT), built inline to keep this suite independent of config.
const TZ_PEG = [
  { token: 'PT', zone: 'America/Los_Angeles' },
  { token: 'ET', zone: 'America/New_York' },
  { token: 'GMT', zone: 'UTC' },
];

test('formatAbsoluteTime renders the instant in a zone, DST-correct', () => {
  const summer = new Date('2026-06-16T20:00:00Z');
  const winter = new Date('2026-01-15T20:00:00Z');
  assert.equal(formatAbsoluteTime(summer, 'America/Los_Angeles'), '1:00 PM');
  assert.equal(formatAbsoluteTime(winter, 'America/Los_Angeles'), '12:00 PM');
  assert.equal(formatAbsoluteTime(summer, 'America/New_York'), '4:00 PM');
  assert.equal(formatAbsoluteTime(winter, 'America/New_York'), '3:00 PM');
  assert.equal(formatAbsoluteTime(summer, 'UTC'), '8:00 PM');
  assert.equal(formatAbsoluteTime(winter, 'UTC'), '8:00 PM');
});

test('buildTrain renders absolute multi-zone timeLines for upcoming Cars when tz is set', () => {
  const event = normalizeEvent(makeEventPayload());
  const preEvent = buildTrain(event, new Date('2026-06-16T17:00:00Z'), { ...CONFIG, tz: TZ_PEG });

  // Caboose Slot at 21:00Z → flyer-style lines, each labeled with its token.
  assert.deepEqual(preEvent.cars.at(-1).timeLines, ['2:00 PM PT', '5:00 PM ET', '9:00 PM GMT']);
});

test('tz never overrides the NOW / departed time states; absent tz mirrors relative', () => {
  const event = normalizeEvent(makeEventPayload());

  const live = buildTrain(event, new Date('2026-06-16T20:30:00Z'), { ...CONFIG, tz: TZ_PEG });
  assert.deepEqual(live.cars.map((car) => car.timeLines), [
    [''], // Alpha departed
    ['NOW'], // Charlie current
    ['2:00 PM PT', '5:00 PM ET', '9:00 PM GMT'], // Caboose upcoming
  ]);

  const relative = buildTrain(event, new Date('2026-06-16T20:30:00Z'), CONFIG);
  assert.deepEqual(relative.cars.map((car) => car.timeLines), [[''], ['NOW'], ['in 30m']]);
});

test('buildTrain returns an empty Train when no Slots are occupied', () => {
  const payload = makeEventPayload();
  payload.event.time_table = payload.event.time_table.map((slot) => ({
    ...slot,
    slot_occupied: false,
  }));
  const train = buildTrain(normalizeEvent(payload), NOW, CONFIG);

  assert.deepEqual(train.cars, []);
  // The loco is always the Organiser — its Engine carries no Broadcaster.
  assert.equal(train.engine.broadcaster, null);
  assert.equal(train.title, 'Trainwreck & Friends');
  assert.equal(train.organiser.displayName, 'DJ Organiser');
});

test('hidefinished removes departed Cars but never the Engine (the loco persists)', () => {
  const at2030 = new Date('2026-06-16T20:30:00Z');
  const event = normalizeEvent(makeEventPayload());

  // openslots on, hidefinished off: Cars = Alpha (0, departed), open (1, departed),
  // Charlie (2, current), Caboose (3, upcoming).
  const shown = buildTrain(event, at2030, { ...CONFIG, openslots: true });
  assert.deepEqual(shown.cars.map((c) => c.slotOrder), [0, 1, 2, 3]);

  // hidefinished on: the departed Cars (Alpha 0, open 1) vanish; the loco (the
  // Organiser) stays — the Engine is exempt, so a train never goes headless.
  const hidden = buildTrain(event, at2030, { ...CONFIG, openslots: true, hidefinished: true });
  assert.deepEqual(hidden.cars.map((c) => c.slotOrder), [2, 3]);
  assert.equal(hidden.engine.broadcaster, null);
  assert.ok(hidden.cars.every((c) => !c.isDeparted));
});

test('the locomotive dims or hides post-event per enginedim and hidefinished', () => {
  const event = normalizeEvent(makeEventPayload());
  const live = new Date('2026-06-16T20:30:00Z');
  const post = new Date('2026-06-16T22:00:00Z');
  const flags = (cfg, now = post) => {
    const { isDimmed, isHidden } = buildTrain(event, now, { ...CONFIG, ...cfg }).engine;
    return { isDimmed, isHidden };
  };
  // During the Event the loco is bright, whatever the mode (it never dims mid-event).
  assert.deepEqual(flags({ enginedim: 'over' }, live), { isDimmed: false, isHidden: false });
  // Default (no enginedim) behaves as 'over': dims once the Event is over.
  assert.deepEqual(flags({}), { isDimmed: true, isHidden: false });
  assert.deepEqual(flags({ enginedim: 'over' }), { isDimmed: true, isHidden: false });
  // 'never' keeps the loco bright forever.
  assert.deepEqual(flags({ enginedim: 'never' }), { isDimmed: false, isHidden: false });
  // 'finished' follows the hidefinished rule: hide it if Cars are hidden, else dim.
  assert.deepEqual(flags({ enginedim: 'finished', hidefinished: true }), { isDimmed: false, isHidden: true });
  assert.deepEqual(flags({ enginedim: 'finished' }), { isDimmed: true, isHidden: false });
});

// ── Localization: config.t / config.locale flow into the view model ─────────

test('formatRelativeTime localizes the "in" prefix and unit tokens via t', async () => {
  const now = new Date('2026-06-16T12:00:00Z');
  const fr = makeT(await loadMessages('fr'));
  const nl = makeT(await loadMessages('nl'));
  // Assert the contract, not a translator's exact token: the compact value is
  // assembled from the catalog's own d/h/m unit tokens and wrapped by its
  // "in {v}" — so a translator changing fr "m"→"min" stays correct. The prefix
  // word is verified to actually be localized.
  const rel = (t, body) => t('time.in', { v: body });
  const fu = { d: fr('time.d'), h: fr('time.h'), m: fr('time.m') };
  const nu = { d: nl('time.d'), h: nl('time.h'), m: nl('time.m') };
  assert.equal(formatRelativeTime(new Date('2026-06-16T13:30:00Z'), now, fr), rel(fr, `1${fu.h}30${fu.m}`));
  assert.equal(formatRelativeTime(new Date('2026-06-17T18:00:00Z'), now, fr), rel(fr, `1${fu.d}6${fu.h}`));
  assert.equal(formatRelativeTime(new Date('2026-06-16T13:30:00Z'), now, nl), rel(nl, `1${nu.h}30${nu.m}`));
  assert.ok(formatRelativeTime(new Date('2026-06-16T13:30:00Z'), now, fr).startsWith('dans'));
  assert.ok(formatRelativeTime(new Date('2026-06-16T13:30:00Z'), now, nl).startsWith('over'));
});

test('formatAbsoluteTime is 24-hour for European locales, 12-hour for en/es-MX', () => {
  const t = new Date('2026-06-16T20:00:00Z'); // 20:00 UTC
  assert.match(formatAbsoluteTime(t, 'UTC', 'de'), /^20[:.]00$/);   // 24-hour, no AM/PM
  assert.match(formatAbsoluteTime(t, 'UTC', 'fr'), /20[:h]00/);     // 24-hour
  assert.match(formatAbsoluteTime(t, 'UTC', 'en'), /8:00\s?PM/i);   // 12-hour
  assert.match(formatAbsoluteTime(t, 'UTC', 'es-MX'), /8:00/);      // 12-hour (Mexico)
  // Default (no locale arg) stays en-US 12-hour, unchanged from before i18n.
  assert.equal(formatAbsoluteTime(t, 'UTC'), '8:00 PM');
});

test('buildTrain localizes NOW and the OPEN-slot label through config.t', async () => {
  const event = normalizeEvent(makeEventPayload());
  const de = makeT(await loadMessages('de'));
  const cfg = { ...CONFIG, openslots: true, t: de, locale: 'de' };

  // 19:30 → the open Slot (order 1) is live; its time line reads the localized NOW.
  const train = buildTrain(event, NOW, cfg);
  const open = train.cars.find((c) => c.slotOrder === 1);
  assert.equal(open.isOpen, true);
  assert.equal(open.displayName, de('overlay.open')); // not the literal "OPEN"
  assert.equal(open.relativeTime, de('overlay.now')); // localized NOW
  assert.notEqual(de('overlay.open'), 'OPEN');         // sanity: the catalog really translated it
});

// ── Back-to-back Slots: one Broadcaster, consecutive Slots → one Car ─────────
// RaidPal lets a streamer hold several Slots in a row (a 2-hour set across two
// 60-min Slots). The davelapalooza-4 lineup is built entirely this way — every DJ
// books two back-to-back Slots, and one (DJMoofasa) books three. Without merging,
// each Slot draws its own Car, so the streamer renders 2–3 times in a row (the
// "double-train"). buildTrain must collapse a contiguous same-Broadcaster run into
// a single Car spanning the combined window.

/** One occupied wire Slot. */
function occupiedSlot(order, starttime, name, id) {
  return {
    order,
    starttime,
    slot_occupied: true,
    user_timezone: 'UTC',
    broadcaster_display_name: name,
    broadcaster_image: `https://example.test/avatars/${id}.png`,
    broadcaster_live: false,
    broadcaster_id: id,
  };
}

// DJ Duo holds the first two Slots (18:00–20:00); DJ Solo holds the third (20:00–21:00).
function makeBackToBackPayload() {
  return makeEventPayload({
    starttime: '2026-06-16T18:00:00Z',
    endtime: '2026-06-16T21:00:00Z',
    time_table: [
      occupiedSlot(0, '2026-06-16T18:00:00Z', 'DJ Duo', 'duo-id'),
      occupiedSlot(1, '2026-06-16T19:00:00Z', 'DJ Duo', 'duo-id'),
      occupiedSlot(2, '2026-06-16T20:00:00Z', 'DJ Solo', 'solo-id'),
    ],
  });
}

test('consecutive Slots held by one Broadcaster merge into a single Car', () => {
  const train = buildTrain(normalizeEvent(makeBackToBackPayload()), new Date('2026-06-16T17:00:00Z'), CONFIG);
  // DJ Duo's two Slots collapse to one Car; DJ Solo is the second.
  assert.deepEqual(train.cars.map((c) => c.broadcaster.displayName), ['DJ Duo', 'DJ Solo']);
  // The merged Car keeps the first Slot's order.
  assert.deepEqual(train.cars.map((c) => c.slotOrder), [0, 2]);
});

test('a merged multi-Slot Car reads NOW across its whole combined window and departs only at its end', () => {
  const event = normalizeEvent(makeBackToBackPayload());

  // First half of DJ Duo's set (18:30): DJ Duo is current.
  assert.deepEqual(buildTrain(event, new Date('2026-06-16T18:30:00Z'), CONFIG).cars.map((c) => c.isCurrent), [true, false]);
  // Second half (19:30) — still DJ Duo, NOT departed and NOT a second Car.
  const secondHour = buildTrain(event, new Date('2026-06-16T19:30:00Z'), CONFIG);
  assert.deepEqual(secondHour.cars.map((c) => c.isCurrent), [true, false]);
  assert.deepEqual(secondHour.cars.map((c) => c.isDeparted), [false, false]);
  // At 20:00 DJ Duo's full window has ended → departed; DJ Solo takes over.
  const afterDuo = buildTrain(event, new Date('2026-06-16T20:00:00Z'), CONFIG);
  assert.deepEqual(afterDuo.cars.map((c) => c.isDeparted), [true, false]);
  assert.deepEqual(afterDuo.cars.map((c) => c.isCurrent), [false, true]);
});

test('three consecutive Slots for one Broadcaster merge into one Car (the davelapalooza triple)', () => {
  const payload = makeEventPayload({
    starttime: '2026-06-16T18:00:00Z',
    endtime: '2026-06-16T21:00:00Z',
    time_table: [
      occupiedSlot(0, '2026-06-16T18:00:00Z', 'DJMoofasa', 'moofasa-id'),
      occupiedSlot(1, '2026-06-16T19:00:00Z', 'DJMoofasa', 'moofasa-id'),
      occupiedSlot(2, '2026-06-16T20:00:00Z', 'DJMoofasa', 'moofasa-id'),
    ],
  });
  const train = buildTrain(normalizeEvent(payload), new Date('2026-06-16T17:00:00Z'), CONFIG);
  assert.equal(train.cars.length, 1);
  assert.equal(train.cars[0].broadcaster.displayName, 'DJMoofasa');
  // Current anywhere in the 18:00–21:00 triple window.
  assert.equal(buildTrain(normalizeEvent(payload), new Date('2026-06-16T20:30:00Z'), CONFIG).cars[0].isCurrent, true);
});

test('the same Broadcaster in non-adjacent Slots stays two Cars (two separate sets)', () => {
  const payload = makeEventPayload({
    starttime: '2026-06-16T18:00:00Z',
    endtime: '2026-06-16T21:00:00Z',
    time_table: [
      occupiedSlot(0, '2026-06-16T18:00:00Z', 'DJ Encore', 'encore-id'),
      occupiedSlot(1, '2026-06-16T19:00:00Z', 'DJ Other', 'other-id'),
      occupiedSlot(2, '2026-06-16T20:00:00Z', 'DJ Encore', 'encore-id'),
    ],
  });
  const train = buildTrain(normalizeEvent(payload), new Date('2026-06-16T17:00:00Z'), CONFIG);
  // No merge across the gap — DJ Encore genuinely plays twice.
  assert.deepEqual(train.cars.map((c) => c.broadcaster.displayName), ['DJ Encore', 'DJ Other', 'DJ Encore']);
});

test('a trailing merged Car is the Caboose, and its time counts from its first Slot', () => {
  const payload = makeEventPayload({
    starttime: '2026-06-16T18:00:00Z',
    endtime: '2026-06-16T21:00:00Z',
    time_table: [
      occupiedSlot(0, '2026-06-16T18:00:00Z', 'DJ Opener', 'opener-id'),
      occupiedSlot(1, '2026-06-16T19:00:00Z', 'DJ Closer', 'closer-id'),
      occupiedSlot(2, '2026-06-16T20:00:00Z', 'DJ Closer', 'closer-id'),
    ],
  });
  const train = buildTrain(normalizeEvent(payload), new Date('2026-06-16T17:00:00Z'), CONFIG);
  assert.deepEqual(train.cars.map((c) => c.broadcaster.displayName), ['DJ Opener', 'DJ Closer']);
  // The merged final set is the single Caboose.
  assert.deepEqual(train.cars.map((c) => c.isCaboose), [false, true]);
  // DJ Closer's merged set starts at its FIRST Slot (19:00), so at 17:00 it reads "in 2h".
  assert.equal(train.cars[1].relativeTime, 'in 2h');
});

test('a positively-identified Slot never merges with an adjacent id-less Slot of the same name', () => {
  // Identity is id-authoritative: if one Slot carries a Broadcaster id and the next
  // does not, they are not provably the same person (a shared display name isn't proof),
  // so they stay two Cars. The name fallback is ONLY for when NEITHER Slot has an id
  // (hand-built lineups). RaidPal occupied slots always carry ids, so this guards the
  // manual-lineup path against a false-merge on dirty/partial data.
  const payload = makeEventPayload({
    starttime: '2026-06-16T18:00:00Z',
    endtime: '2026-06-16T20:00:00Z',
    time_table: [
      occupiedSlot(0, '2026-06-16T18:00:00Z', 'DJ Same', 'id-A'),
      occupiedSlot(1, '2026-06-16T19:00:00Z', 'DJ Same', null),
    ],
  });
  const train = buildTrain(normalizeEvent(payload), new Date('2026-06-16T17:00:00Z'), CONFIG);
  assert.equal(train.cars.length, 2);

  // But two id-less Slots of the same name (a hand-built lineup) DO still merge by name.
  const manual = makeEventPayload({
    starttime: '2026-06-16T18:00:00Z',
    endtime: '2026-06-16T20:00:00Z',
    time_table: [
      occupiedSlot(0, '2026-06-16T18:00:00Z', 'DJ Hand', null),
      occupiedSlot(1, '2026-06-16T19:00:00Z', 'DJ Hand', null),
    ],
  });
  assert.equal(buildTrain(normalizeEvent(manual), new Date('2026-06-16T17:00:00Z'), CONFIG).cars.length, 1);
});

test('hidefinished keeps a merged set live through its whole window, dropping it only after the set ends', () => {
  // Regression guard for the filter↔merge interaction: hidefinished must evaluate
  // departure on the merged SET window, not the first Slot. DJ Duo holds 18:00–20:00.
  const event = normalizeEvent(makeBackToBackPayload());

  // 19:30 is inside DJ Duo's SECOND slot — its first slot's raw window has elapsed,
  // but the set runs to 20:00, so hidefinished must NOT drop it mid-set.
  const mid = buildTrain(event, new Date('2026-06-16T19:30:00Z'), { ...CONFIG, hidefinished: true });
  assert.deepEqual(mid.cars.map((c) => c.broadcaster.displayName), ['DJ Duo', 'DJ Solo']);
  assert.equal(mid.cars[0].isDeparted, false);

  // Once the full set ends (20:00), hidefinished removes the merged car.
  const after = buildTrain(event, new Date('2026-06-16T20:00:00Z'), { ...CONFIG, hidefinished: true });
  assert.deepEqual(after.cars.map((c) => c.broadcaster.displayName), ['DJ Solo']);
});
