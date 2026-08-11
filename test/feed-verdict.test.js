import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readVerdict, planCleanup } from '../src/feed-verdict.js';
import { addProfile, upsertTrainConfig, getTrainConfig } from '../src/profiles.js';

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

// ── planCleanup ────────────────────────────────────────────────────────────
// The judgement half of Cleanup: not "may this Config go?" — pruneOrphanedConfigs
// answers that, and test/profiles.test.js pins its five conditions — but WHEN to
// ask, and WHOSE answer to overrule. The once-per-session guard, the explicit
// refresh that bypasses it, and the session-scoped suppression behind the
// notice's "Keep them". That last one is the highest-consequence path in the
// Configurator: without it, the next Verified read deletes exactly what the
// streamer just asked to keep, possibly before they finish reading the notice.

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 7, 7, 12);
const EMPTY = { active: null, profiles: {} };

/** A Profile holding one Raid Train Config per slug, each with the given endsAt. */
function withTrains(spec, login = 'me', store = EMPTY) {
  let next = addProfile(store, login);
  for (const [slug, endsAt] of Object.entries(spec)) {
    next = upsertTrainConfig(next, login, slug, { overrides: { scale: '120' }, endsAt });
  }
  return next;
}

/** A read that reached RaidPal and listed one train the store knows nothing about. */
const verifiedFeed = () => feed({ events: EVENTS, fromCache: false });

const plan = (over = {}) => planCleanup({
  feed: verifiedFeed(), store: withTrains({ 'gone-and-over': NOW - HOUR }), login: 'me',
  kept: new Set(), now: NOW, alreadyRan: false, force: false, ...over,
});

const slugs = (result) => result.removed.map((r) => r.slug).sort();

test('a Verified read with an Orphaned Config plans its removal', () => {
  const result = plan();
  assert.deepEqual(slugs(result), ['gone-and-over']);
  assert.equal(getTrainConfig(result.store, 'me', 'gone-and-over'), null);
});

test('nothing is planned without a Verified read', () => {
  assert.equal(plan({ feed: feed({ events: EVENTS, fromCache: true }) }), null, 'from cache');
  assert.equal(plan({ feed: feed({ events: EVENTS }) }), null, 'never said');
  assert.equal(plan({ feed: feed({ events: EVENTS, stale: 'notfound' }) }), null, 'stale');
  assert.equal(plan({ feed: feed({ status: 'error', error: new Error('down') }) }), null, 'errored');
});

test('the once-per-session guard stops a second automatic pass on the same feed', () => {
  assert.equal(plan({ alreadyRan: true }), null);
});

test('an explicit refresh forces the pass through the once-per-session guard', () => {
  assert.deepEqual(slugs(plan({ alreadyRan: true, force: true })), ['gone-and-over']);
});

test('a suppressed slug survives the next Verified read — "Keep them" is not undone', () => {
  // Without this the streamer's undo lasts until the next read, which may land
  // before they have finished reading the notice that offered it.
  assert.equal(plan({ kept: new Set(['gone-and-over']) }), null);
});

test('a mix of suppressed and fresh removals reports only the fresh ones', () => {
  const result = plan({
    store: withTrains({ 'already-kept': NOW - HOUR, 'newly-gone': NOW - HOUR }),
    kept: new Set(['already-kept']),
  });
  assert.deepEqual(slugs(result), ['newly-gone'], 'the notice offers back only what it just took');
  assert.ok(getTrainConfig(result.store, 'me', 'already-kept'), 'the suppressed Config is put straight back');
  assert.equal(getTrainConfig(result.store, 'me', 'newly-gone'), null);
});

test('the login travels through the plan unchanged — prune and restore hit the same Profile', () => {
  const store = withTrains(
    { 'hers-kept': NOW - HOUR, 'hers-gone': NOW - HOUR },
    'alice',
    withTrains({ 'his-gone': NOW - HOUR }, 'bob'),
  );
  const result = plan({ store, login: 'alice', kept: new Set(['hers-kept']) });
  assert.deepEqual(slugs(result), ['hers-gone']);
  assert.ok(getTrainConfig(result.store, 'alice', 'hers-kept'), 'restored into the Profile it came from');
  assert.ok(getTrainConfig(result.store, 'bob', 'his-gone'), "another Profile's Configs are untouched");
});

test('the plan returns a NEW store and never mutates the one it was given', () => {
  const store = withTrains({ 'gone-and-over': NOW - HOUR });
  const result = plan({ store });
  assert.notEqual(result.store, store);
  assert.ok(getTrainConfig(store, 'me', 'gone-and-over'), 'the caller\'s store is still intact');
});

test('a Good but unverified read prunes nothing while still contributing end times', () => {
  // The guard rail #31 and #39 argued out: when a train ENDS is a fact RaidPal
  // reported, and a fact does not decay — a cached read may still supply it.
  // That a train is ABSENT is an inference, and it decays with the cache.
  const cached = feed({ events: EVENTS, fromCache: true });
  assert.equal(plan({ feed: cached }), null, 'absence proves nothing from a cache hit');
  assert.deepEqual(readVerdict(cached).events, EVENTS, 'end times still flow from the same read');
});
