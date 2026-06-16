import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDemoEvent, DEMO_SLUG, DEMO_SPOTLIGHT } from '../src/demo-event.js';
import { buildTrain } from '../src/lineup-engine.js';
import { parseConfig } from '../src/config.js';

const NOW = new Date('2026-06-16T12:00:00Z');

test('demo lineup: GoProSlowYo organises, teknokat222 kicks off, 8 booked slots', () => {
  const event = makeDemoEvent(NOW, () => 0);
  assert.equal(event.organiser.displayName, 'GoProSlowYo');
  assert.equal(event.slots.length, 8);
  assert.ok(event.slots.every((slot) => slot.occupied), 'every demo slot is booked');
  const ordered = [...event.slots].sort((a, b) => a.order - b.order);
  assert.equal(ordered[0].broadcaster.displayName, 'teknokat222', 'teknokat222 kicks off');
});

test('demo lineup: live phase, organiser drives the loco, both VIPs spotlit, someone is on air', () => {
  const train = buildTrain(makeDemoEvent(NOW, () => 0), NOW, parseConfig(`spotlight=${DEMO_SPOTLIGHT.join(',')}`));
  assert.equal(train.phase, 'live');
  assert.equal(train.engine.broadcaster, null, 'the Organiser (GoProSlowYo) drives the loco — no slot streamer');
  assert.equal(train.cars[0].broadcaster.displayName, 'teknokat222', 'the first streamer rides as the first Car');
  assert.equal(train.engine.isDimmed, false, 'the loco stays bright mid-event');
  const spotlit = train.cars.filter((car) => car.isSpotlit).map((car) => car.broadcaster.displayName).sort();
  assert.deepEqual(spotlit, ['JackMonoDJ', 'PatrickRichards'], 'the two VIPs are highlighted');
  assert.ok(train.cars.some((car) => car.isCurrent), 'a streamer is live now');
});

test('demo slug + spotlight constants', () => {
  assert.equal(DEMO_SLUG, 'demo');
  assert.deepEqual(DEMO_SPOTLIGHT, ['patrickrichards', 'jackmonodj']);
});
