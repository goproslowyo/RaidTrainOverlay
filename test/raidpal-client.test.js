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

// ---- user endpoint (My Raid Trains) ----

import { fetchUserPayload, normalizeUser, loadUser } from '../src/raidpal-client.js';
import { makeUserPayload } from './fixtures/user-payload.js';

test('fetchUserPayload fetches the raw wire payload from the user URL', async () => {
  const payload = makeUserPayload();
  let calledUrl;
  const fakeFetch = async (url) => {
    calledUrl = url;
    return { ok: true, status: 200, text: async () => JSON.stringify(payload) };
  };
  const raw = await fetchUserPayload('goproflowyo', fakeFetch);
  assert.equal(calledUrl, 'https://api.raidpal.com/rest/user/goproflowyo');
  // Raw means raw: wire shape preserved (events_joined, not normalized).
  assert.ok(Array.isArray(raw.user.events_joined));
});

test('fetchUserPayload returns null on 204 — unknown user, not an error', async () => {
  // The live API answers unknown/invalid logins with 204 No Content and an
  // EMPTY body (not JSON) — response.json() would throw here.
  const fakeFetch = async () => ({ ok: true, status: 204, text: async () => '' });
  assert.equal(await fetchUserPayload('thisuserdoesnotexist12345', fakeFetch), null);
});

test('an EMPTY body is "no such user" whatever status carries it (#49)', async () => {
  // The probe saw a 204, but this outcome must not hinge on which code an
  // undocumented, unversioned API picks for "nobody here".
  const empty = async () => ({ ok: true, status: 200, text: async () => '' });
  assert.equal(await fetchUserPayload('someone', empty), null);
  const blank = async () => ({ ok: true, status: 200, text: async () => '  \n ' });
  assert.equal(await fetchUserPayload('someone', blank), null);
});

test('an UNREADABLE body is a failed read, not "no such user" (#49)', async () => {
  // This used to return null, which told a streamer with 13 trains that they
  // had no RaidPal profile — and, because "not found" is not a failure, it also
  // withheld the Verified read that #39's pruning and #41's Cleanup require.
  // Throwing puts it on #47's retry curve and the honest "didn't answer" path.
  const cloudflare = async () => ({
    ok: true, status: 200,
    text: async () => '<!DOCTYPE html><html><head><title>Error 522</title></head><body>Connection timed out</body></html>',
  });
  await assert.rejects(fetchUserPayload('goproflowyo', cloudflare), /could not read/);
  const truncated = async () => ({ ok: true, status: 200, text: async () => '{"user":{"display_nam' });
  await assert.rejects(fetchUserPayload('goproflowyo', truncated), /could not read/);
  const noUser = async () => ({ ok: true, status: 200, text: async () => '{"ok":true}' });
  await assert.rejects(fetchUserPayload('goproflowyo', noUser), /could not read/);
});

test('the unreadable error stays plain for the UI and keeps its detail for the log', async () => {
  // configurator.html renders error.message straight into the error card, so it
  // must read like a sentence, not like a stack trace.
  const cloudflare = async () => ({
    ok: true, status: 200, text: async () => '<!doctype html><title>Error 522</title>',
  });
  const error = await fetchUserPayload('goproflowyo', cloudflare).catch((e) => e);
  assert.equal(error.message, 'RaidPal answered with something we could not read.');
  assert.match(error.detail, /goproflowyo/);
  assert.match(error.detail, /an HTML page/);
});

test('a real user with NO raid trains is a success, not garbage (#49)', async () => {
  // The case most easily confused with an empty/odd response: the payload is
  // perfectly valid, there is simply nothing on the schedule. It must not throw.
  const noTrains = async () => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({ user: { display_name: 'Quiet', events_joined: [] } }),
  });
  const raw = await fetchUserPayload('quiet', noTrains);
  assert.equal(raw.user.display_name, 'Quiet');
  assert.deepEqual(normalizeUser(raw).events, []);
});

test('fetchUserPayload throws on a non-ok response, carrying the status', async () => {
  const fakeFetch = async () => ({ ok: false, status: 503, text: async () => '' });
  await assert.rejects(fetchUserPayload('goproflowyo', fakeFetch), /503/);
});

test('fetchUserPayload URL-encodes the login', async () => {
  let calledUrl;
  const fakeFetch = async (url) => {
    calledUrl = url;
    return { ok: true, status: 204, text: async () => '' };
  };
  await fetchUserPayload('bad name!!', fakeFetch);
  assert.equal(calledUrl, 'https://api.raidpal.com/rest/user/bad%20name!!');
});

test('normalizeUser maps the profile fields', () => {
  const user = normalizeUser(makeUserPayload());
  assert.equal(user.displayName, 'GoProFlowYo');
  assert.equal(user.profileImage, 'https://example.test/avatars/goproflowyo.png');
  assert.equal(user.twitchUri, 'https://twitch.tv/goproflowyo');
  assert.equal(user.timezone, 'America/Los_Angeles');
});

test('normalizeUser merges organised + joined Events, deduped by raidpal_link, sorted by starttime', () => {
  const user = normalizeUser(makeUserPayload());
  // 1 organised (duplicated in joined) + 3 joined = 3 unique, ascending by start.
  assert.deepEqual(
    user.events.map((e) => e.slug),
    ['luna-hao8', 'trainwreck-lucky-13', 'my-own-train'],
  );
});

test('normalizeUser marks the Events the user organises', () => {
  const user = normalizeUser(makeUserPayload());
  const bySlug = Object.fromEntries(user.events.map((e) => [e.slug, e]));
  assert.equal(bySlug['my-own-train'].organiser, true);
  assert.equal(bySlug['luna-hao8'].organiser, false);
});

test('normalizeUser tolerates the events key being absent (non-organisers)', () => {
  const payload = makeUserPayload();
  delete payload.user.events;
  const user = normalizeUser(payload);
  assert.equal(user.events.length, 3);
  assert.ok(user.events.every((e) => e.organiser === false));
});

test('normalizeUser maps Event summary fields, with Date times and a slug from api_link', () => {
  const user = normalizeUser(makeUserPayload());
  const luna = user.events[0];
  assert.equal(luna.title, 'LUNA');
  assert.ok(luna.starttime instanceof Date);
  assert.equal(luna.starttime.getTime(), Date.parse('2026-08-03T22:00:00Z'));
  assert.ok(luna.endtime instanceof Date);
  assert.equal(luna.raidpalLink, 'https://raidpal.com/en/event/luna-hao8');
  assert.equal(luna.apiLink, 'https://api.raidpal.com/rest/event/luna-hao8');
  assert.equal(luna.slug, 'luna-hao8');
});

test('normalizeUser decodes HTML entities in Event titles (defensive)', () => {
  const user = normalizeUser(makeUserPayload());
  const wreck = user.events.find((e) => e.slug === 'trainwreck-lucky-13');
  assert.equal(wreck.title, 'Trainwreck & Friends');
});

test('normalizeUser throws when the payload has no user', () => {
  assert.throws(() => normalizeUser({}), /user/);
  assert.throws(() => normalizeUser(null), /user/);
});

test('loadUser returns the normalized user, or null for an unknown login', async () => {
  const okFetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify(makeUserPayload()) });
  const user = await loadUser('goproflowyo', { fetchImpl: okFetch });
  assert.equal(user.displayName, 'GoProFlowYo');

  const goneFetch = async () => ({ ok: true, status: 204, text: async () => '' });
  assert.equal(await loadUser('nobody', { fetchImpl: goneFetch }), null);
});
