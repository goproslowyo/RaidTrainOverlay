/**
 * backoff: the one delay curve every RaidPal read in this codebase schedules
 * against. Exponential growth on consecutive failures, capped, then jittered —
 * written once here rather than a third time in a third feed module (#47).
 *
 * Two shapes ride on the same curve, and the difference between them is who is
 * waiting:
 *
 * - **Poll** (`nextPollDelayMs`) — nobody is watching. The Overlay's event-feed
 *   and live-link-feed reschedule themselves forever, so a sustained RaidPal
 *   outage has to *decay* into a gentle hourly retry rather than hammer.
 * - **Retry** (`retry`) — a streamer just opened the Configurator or pressed
 *   Refresh and is looking at a spinner. The first delay is tight, the ceiling
 *   is low, and the attempts are finite: this loop must always end.
 *
 * Everything here is pure or injectable (`rand`, `sleep`) so the curve is
 * testable without a clock.
 */

/** ±15% spread (rand 0..1 → factor 0.85..1.15), so Overlays never poll in lockstep. */
const JITTER = 0.3;

/** Poll shape: never wait longer than 60 min between polls. */
const POLL_CAP_MS = 60 * 60_000;

/** Retry shape: first re-attempt lands in well under a second. */
export const RETRY_BASE_MS = 400;
/** Retry shape: and no single wait crosses two seconds — someone is watching. */
export const RETRY_CAP_MS = 2_000;
/** Retry shape: the hard ceiling. One initial attempt plus two re-attempts. */
export const RETRY_ATTEMPTS = 3;

/**
 * The curve itself: `baseMs · 2^failures`, capped at `capMs`, jittered ±15%.
 * Pure — `rand` is injected for tests. `failures` is how many attempts have
 * already failed, so 0 yields the base delay.
 */
export function backoffDelayMs({ baseMs, failures = 0, capMs, rand = Math.random }) {
  const backedOff = Math.min(baseMs * 2 ** failures, capMs);
  const jitterFactor = 1 + (rand() - 0.5) * JITTER;
  return Math.round(backedOff * jitterFactor);
}

/**
 * Milliseconds until the next poll of a self-rescheduling feed. Base is
 * `refreshMins` minutes; consecutive failures back off exponentially, capped at
 * 60 min, then jittered.
 */
export function nextPollDelayMs({ refreshMins, consecutiveFailures = 0, rand = Math.random }) {
  return backoffDelayMs({ baseMs: refreshMins * 60_000, failures: consecutiveFailures, capMs: POLL_CAP_MS, rand });
}

/**
 * Milliseconds before re-attempting a read a person is waiting on. `attempt` is
 * the number of attempts that have already failed (1 after the first failure).
 */
export function nextRetryDelayMs({ attempt = 1, baseMs = RETRY_BASE_MS, capMs = RETRY_CAP_MS, rand = Math.random } = {}) {
  return backoffDelayMs({ baseMs, failures: Math.max(0, attempt - 1), capMs, rand });
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, re-attempting on a throw with the retry curve, up to `attempts`
 * total attempts. Resolves with `fn`'s value; rethrows the LAST error once the
 * attempts are spent, so the caller's existing failure handling is unchanged —
 * this only buys a flaky read more chances to be a good one.
 *
 * `fn` receives the 0-based attempt index. Only a *throw* is retried: a RaidPal
 * answer that resolves — including the definitive 204 that `fetchUserPayload`
 * turns into null — is an answer, and asking again would not change it.
 *
 * `sleep` and `rand` are injected (tests pass a no-op sleep); `onRetry` fires
 * before each wait with `{ error, attempt, delayMs }`.
 */
export async function retry(fn, { attempts = RETRY_ATTEMPTS, baseMs = RETRY_BASE_MS, capMs = RETRY_CAP_MS, rand = Math.random, sleep = defaultSleep, onRetry = () => {} } = {}) {
  const ceiling = Math.max(1, attempts);
  let failed = 0;
  for (;;) {
    try {
      return await fn(failed);
    } catch (error) {
      failed += 1;
      if (failed >= ceiling) throw error;
      const delayMs = nextRetryDelayMs({ attempt: failed, baseMs, capMs, rand });
      onRetry({ error, attempt: failed, delayMs });
      await sleep(delayMs);
    }
  }
}
