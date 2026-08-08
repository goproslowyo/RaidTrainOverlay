import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  backoffDelayMs, nextPollDelayMs, nextRetryDelayMs, retry,
  RETRY_ATTEMPTS, RETRY_BASE_MS, RETRY_CAP_MS,
} from '../src/backoff.js';

const MIN = 60_000;

// ---- the poll shape (moved here from event-feed, which no longer owns it) ----

test('nextPollDelayMs returns exactly the base interval at the jitter midpoint', () => {
  // rand 0.5 is the jitter midpoint → no jitter, so the delay is the base.
  assert.equal(nextPollDelayMs({ refreshMins: 15, consecutiveFailures: 0, rand: () => 0.5 }), 15 * MIN);
  assert.equal(nextPollDelayMs({ refreshMins: 30, consecutiveFailures: 0, rand: () => 0.5 }), 30 * MIN);
});

test('nextPollDelayMs jitters within ±15% at the rand extremes', () => {
  const base = 15 * MIN;
  // Delays are rounded to whole ms, so round the expected band edges too
  // (base * 1.15 isn't exactly representable in float).
  assert.equal(nextPollDelayMs({ refreshMins: 15, consecutiveFailures: 0, rand: () => 0 }), Math.round(base * 0.85));
  assert.equal(nextPollDelayMs({ refreshMins: 15, consecutiveFailures: 0, rand: () => 1 }), Math.round(base * 1.15));
});

test('nextPollDelayMs backs off as 2^failures, capped at 60 min', () => {
  const mid = (consecutiveFailures) =>
    nextPollDelayMs({ refreshMins: 15, consecutiveFailures, rand: () => 0.5 });
  assert.equal(mid(0), 15 * MIN); // base
  assert.equal(mid(1), 30 * MIN); // ×2
  assert.equal(mid(2), 60 * MIN); // ×4 = 60, the cap
  assert.equal(mid(3), 60 * MIN); // ×8 = 120 → capped
  assert.equal(mid(10), 60 * MIN); // stays capped
});

// ---- the curve underneath both shapes ----

test('backoffDelayMs is one curve: 2^failures, capped, then jittered', () => {
  const mid = (failures) => backoffDelayMs({ baseMs: 100, failures, capMs: 500, rand: () => 0.5 });
  assert.equal(mid(0), 100);
  assert.equal(mid(1), 200);
  assert.equal(mid(2), 400);
  assert.equal(mid(3), 500); // 800 → capped
  assert.equal(backoffDelayMs({ baseMs: 100, failures: 0, capMs: 500, rand: () => 0 }), 85);
  assert.equal(backoffDelayMs({ baseMs: 100, failures: 0, capMs: 500, rand: () => 1 }), 115);
});

// ---- the retry shape: someone is watching ----

test('the retry shape is tight and finite — a person is waiting on it', () => {
  // The poll shape starts in minutes and never ends; this one has to do both
  // the opposite things. Pinned because #47 turns on exactly that difference.
  assert.ok(RETRY_BASE_MS < 1_000, 'first re-attempt lands under a second');
  assert.ok(RETRY_CAP_MS <= 2_000, 'no single wait crosses two seconds');
  assert.equal(RETRY_ATTEMPTS, 3);
  const mid = (attempt) => nextRetryDelayMs({ attempt, rand: () => 0.5 });
  assert.equal(mid(1), RETRY_BASE_MS); // after the 1st failure
  assert.equal(mid(2), RETRY_BASE_MS * 2);
  assert.equal(mid(3), Math.min(RETRY_BASE_MS * 4, RETRY_CAP_MS));
  assert.equal(mid(9), RETRY_CAP_MS); // capped, however bad it gets
});

test('retry returns the first success without sleeping', async () => {
  const slept = [];
  const value = await retry(async () => 'ok', { sleep: async (ms) => slept.push(ms) });
  assert.equal(value, 'ok');
  assert.deepEqual(slept, []);
});

test('retry re-attempts a throw and resolves — the flaky read that would have been lost', async () => {
  const slept = [];
  let calls = 0;
  const value = await retry(
    async (attempt) => {
      calls += 1;
      if (attempt < 2) throw new Error('network down');
      return 'ok';
    },
    { sleep: async (ms) => slept.push(ms), rand: () => 0.5 },
  );
  assert.equal(value, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(slept, [RETRY_BASE_MS, RETRY_BASE_MS * 2]); // the curve, in order
});

test('retry spends its attempts and rethrows the LAST error — the loop always ends', async () => {
  let calls = 0;
  await assert.rejects(
    retry(
      async () => {
        calls += 1;
        throw new Error(`failure ${calls}`);
      },
      { sleep: async () => {}, attempts: 3 },
    ),
    /failure 3/,
  );
  assert.equal(calls, 3);
});

test('attempts: 1 disables retrying, and a nonsense ceiling still runs once', async () => {
  for (const attempts of [1, 0, -5]) {
    let calls = 0;
    await assert.rejects(
      retry(async () => { calls += 1; throw new Error('nope'); }, { attempts, sleep: async () => {} }),
      /nope/,
    );
    assert.equal(calls, 1, `attempts: ${attempts} must still attempt exactly once`);
  }
});

test('onRetry observes each wait before it happens', async () => {
  const seen = [];
  await assert.rejects(
    retry(async () => { throw new Error('down'); }, {
      sleep: async () => {}, rand: () => 0.5, onRetry: (info) => seen.push(info),
    }),
    /down/,
  );
  // Two waits for three attempts — the last failure is reported by the throw.
  assert.deepEqual(seen.map((s) => s.attempt), [1, 2]);
  assert.deepEqual(seen.map((s) => s.delayMs), [RETRY_BASE_MS, RETRY_BASE_MS * 2]);
  assert.ok(seen.every((s) => s.error instanceof Error));
});

test('a resolved value is never retried, however empty — an answer is an answer', async () => {
  // fetchUserPayload turns RaidPal's definitive 204 into null. Asking again
  // would not change it, and retrying it would make an unknown login slow.
  let calls = 0;
  const value = await retry(async () => { calls += 1; return null; }, { sleep: async () => {} });
  assert.equal(value, null);
  assert.equal(calls, 1);
});
