import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVerdict } from '../src/feed-verdict.js';

// Two bars, four issues' worth of reasoning (#31, #39, #41, #49), and until now
// nothing could check either. A Good read is positive evidence about when
// trains end; a Verified read is the only evidence strong enough to let absence
// from the feed delete a streamer's saved settings.

/** A feed snapshot the way the Configurator holds one, with the bits that matter. */
const feed = (over = {}) => ({
  status: 'ready', events: [], details: {}, error: null, login: 'goproslowyo', ...over,
});

const EVENTS = [{ slug: 'a-train', endtime: new Date('2026-08-01T00:00:00Z') }];

test('a ready read with no error and nothing stale is a Good read', () => {
  const { events } = readVerdict(feed({ events: EVENTS, fromCache: false }));
  assert.deepEqual(events, EVENTS);
});

test('a stale read is not a Good read, even though it has events to show', () => {
  const { events } = readVerdict(feed({ events: EVENTS, stale: 'notfound' }));
  assert.equal(events, null);
});

test('an errored read is not a Good read, even served ready from cache', () => {
  const { events } = readVerdict(feed({ events: EVENTS, error: new Error('RaidPal is down') }));
  assert.equal(events, null);
});

test('a read that is not ready is not a Good read', () => {
  for (const status of ['idle', 'loading', 'notfound', 'error']) {
    assert.equal(readVerdict(feed({ status, events: EVENTS })).events, null, status);
  }
});

test('a Good read served from cache is not a Verified read', () => {
  const verdict = readVerdict(feed({ events: EVENTS, fromCache: true }));
  assert.deepEqual(verdict.events, EVENTS, 'still Good — an end time is a recorded fact');
  assert.equal(verdict.verified, false);
});

test('a Good read that reached RaidPal is a Verified read', () => {
  assert.equal(readVerdict(feed({ events: EVENTS, fromCache: false })).verified, true);
});

test('a read that never said whether it reached RaidPal is not a Verified read', () => {
  assert.equal(readVerdict(feed({ events: EVENTS })).verified, false);
});

test('a read that is not Good is never Verified, however fresh it claims to be', () => {
  assert.equal(readVerdict(feed({ status: 'loading', fromCache: false })).verified, false);
  assert.equal(readVerdict(feed({ stale: 'notfound', fromCache: false })).verified, false);
  assert.equal(readVerdict(feed({ error: new Error('nope'), fromCache: false })).verified, false);
});
