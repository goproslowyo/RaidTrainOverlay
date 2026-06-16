import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, fetchEventPayload } from '../src/raidpal-client.js';
import { makeEventPayload } from './fixtures/event-payload.js';

test('fetchEventPayload fetches the raw, un-normalized wire payload from the slug URL', async () => {
  const payload = makeEventPayload();
  let calledUrl;
  const fakeFetch = async (url) => {
    calledUrl = url;
    return { ok: true, status: 200, json: async () => payload };
  };
  const raw = await fetchEventPayload('trainwreck-lucky-13', fakeFetch);
  assert.equal(calledUrl, 'https://api.raidpal.com/rest/event/trainwreck-lucky-13');
  // Raw means raw: the wire shape is preserved (time_table, not normalized slots).
  assert.equal(raw, payload);
  assert.ok(Array.isArray(raw.event.time_table));
});

test('fetchEventPayload throws on a non-ok response, carrying the status', async () => {
  const fakeFetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  await assert.rejects(fetchEventPayload('trainwreck-lucky-13', fakeFetch), /503/);
});

test('normalizeEvent maps the wire payload to a normalized Event', () => {
  const event = normalizeEvent(makeEventPayload());
  assert.equal(event.slotDurationMins, 60);
  assert.equal(event.organiser.displayName, 'DJ Organiser');
  assert.equal(event.organiser.image, 'https://example.test/avatars/organiser.png');
  assert.ok(event.starttime instanceof Date);
  assert.equal(event.starttime.getTime(), Date.parse('2026-06-16T18:00:00Z'));
  assert.ok(event.endtime instanceof Date);
  assert.equal(event.slots.length, 4);
});

test('normalizeEvent maps occupied and Open Slots with their Broadcasters', () => {
  const { slots } = normalizeEvent(makeEventPayload());

  const occupied = slots[1]; // DJ Alpha, order 0 (array order preserved from the wire)
  assert.equal(occupied.order, 0);
  assert.equal(occupied.occupied, true);
  assert.ok(occupied.starttime instanceof Date);
  assert.equal(occupied.starttime.getTime(), Date.parse('2026-06-16T18:00:00Z'));
  assert.equal(occupied.broadcaster.displayName, 'DJ Alpha');
  assert.equal(occupied.broadcaster.image, 'https://example.test/avatars/alpha.png');

  const open = slots[3]; // order 1, slot_occupied: false
  assert.equal(open.order, 1);
  assert.equal(open.occupied, false);
  assert.equal(open.broadcaster, null);
});

test('normalizeEvent decodes HTML entities in display strings', () => {
  const payload = makeEventPayload();
  payload.event.time_table[1].broadcaster_display_name = 'DJ &quot;Alpha&quot; &#x26; Co &#8211; live';
  const event = normalizeEvent(payload);

  assert.equal(event.title, 'Trainwreck & Friends');
  assert.equal(event.slots[1].broadcaster.displayName, 'DJ "Alpha" & Co – live');
});

test('normalizeEvent throws when the payload has no event', () => {
  assert.throws(() => normalizeEvent({}), /event/);
  assert.throws(() => normalizeEvent(null), /event/);
});
