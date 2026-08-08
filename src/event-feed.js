/**
 * event-feed: the Overlay's resilience layer. Wraps raidpal-client
 * with a last-good cache per Event slug and an opt-in refresh poll. Cache-first:
 * within a freshness window the Overlay renders straight from cache and makes NO
 * API call; it only fetches when the cache is missing or stale, and on a live
 * failure falls back to the (stale) cache so a warm Train never blanks.
 * raidpal-client stays the pure fetch + normalize (the proxy swap
 * point); the caching lives here and the schedule comes from backoff, which
 * owns the one delay curve all three feed readers share (#47).
 */

import { fetchEventPayload, normalizeEvent } from './raidpal-client.js';
import { nextPollDelayMs } from './backoff.js';

const CACHE_PREFIX = 'raidtrainoverlay.cache.v2.'; // v2 entry shape: { payload, savedAt }
const DEFAULT_FRESH_MIN = 15; // cache-first window when ?refresh is off (aligns with the refresh floor)

/** localStorage key for a slug's last-good entry. */
export function cacheKey(slug) {
  return CACHE_PREFIX + slug;
}

/**
 * Persist a slug's raw wire payload with the time it was saved. `savedAt` (ms) is
 * passed in (injected clock) so cache-first freshness is testable. Storage is
 * injected (the page owns localStorage).
 */
export function writeCache(storage, slug, payload, savedAt) {
  storage.setItem(cacheKey(slug), JSON.stringify({ payload, savedAt }));
}

/**
 * Read a slug's cached entry `{ payload, savedAt }`, or null if never cached,
 * corrupt, or the wrong shape. Never throws — a bad blob must not blank the
 * Overlay.
 */
export function readCache(storage, slug) {
  const raw = storage.getItem(cacheKey(slug));
  if (raw == null) return null;
  try {
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || entry.payload == null) return null;
    return { payload: entry.payload, savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

/**
 * Load an Event, cache-first.
 *
 * If the cached entry is younger than `freshMs`, return it WITHOUT touching the
 * network (`fromCache: true, fresh: true`). Otherwise (cache missing/stale, or
 * `force`) fetch fresh, cache it, and on a live failure fall back to the (stale)
 * cache (`fromCache: true` + `error`) so a warm Overlay never blanks; a cold-cache
 * failure rethrows. `clock` (default Date.now) and `freshMs` (default 0 = never
 * fresh → always fetch, the network-first path) are injected; `force` skips the
 * freshness short-circuit so scheduled polls always fetch.
 *
 * Returns `{ event, payload, fromCache, fresh?, error? }`.
 */
export async function loadEventResilient(slug, { fetchImpl, storage, clock = Date.now, freshMs = 0, force = false }) {
  if (!force && freshMs > 0) {
    const cached = readCache(storage, slug);
    if (cached && clock() - cached.savedAt < freshMs) {
      return { event: normalizeEvent(cached.payload), payload: cached.payload, fromCache: true, fresh: true };
    }
  }
  try {
    const payload = await fetchEventPayload(slug, fetchImpl);
    const event = normalizeEvent(payload);
    writeCache(storage, slug, payload, clock());
    return { event, payload, fromCache: false };
  } catch (error) {
    const cached = readCache(storage, slug);
    if (cached == null) throw error;
    return { event: normalizeEvent(cached.payload), payload: cached.payload, fromCache: true, error };
  }
}

/**
 * Start the Overlay's Event feed. The first load is cache-first within a
 * freshness window (`?refresh` minutes when set, else 15) — a recent reload makes
 * no API call. Then, only if `config.refresh > 0`, a self-rescheduling poll
 * force-fetches on schedule (polls bypass the freshness window) to pick up lineup
 * edits.
 *
 * Callbacks (all injected): `onEvent(event)` fires on first load and thereafter
 * only when the raw payload changed (so the shell re-renders on real edits, not
 * every poll); `onError(err)` fires once per live failure for logging. A
 * warm-cache fallback on a failed fetch counts as a failure for backoff but keeps
 * the last-good lineup on screen; a cold-start failure surfaces nothing and, when
 * polling, keeps retrying until RaidPal recovers.
 *
 * Returns `{ stop, ready }`: `stop()` cancels the pending poll; `ready` resolves
 * after the first load attempt settles (the shell ignores it; tests await it).
 */
export function startEventFeed(slug, config, deps) {
  const {
    fetchImpl,
    storage,
    clock = Date.now,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
    rand = Math.random,
    onEvent = () => {},
    onError = () => {},
  } = deps;

  const freshMs = (config.refresh > 0 ? config.refresh : DEFAULT_FRESH_MIN) * 60_000;
  let consecutiveFailures = 0;
  let lastEmitted = null; // serialized payload last handed to onEvent (dedupe)
  let timer = null;
  let stopped = false;
  let first = true;

  function emit(event, payload) {
    const serialized = JSON.stringify(payload);
    if (serialized === lastEmitted) return; // unchanged lineup → no re-render
    lastEmitted = serialized;
    onEvent(event);
  }

  function schedule() {
    if (stopped || !(config.refresh > 0)) return;
    // Scheduled polls force a real fetch — the freshness window only governs the load.
    timer = setTimer(() => attempt(true), nextPollDelayMs({ refreshMins: config.refresh, consecutiveFailures, rand }));
  }

  async function attempt(force) {
    try {
      const r = await loadEventResilient(slug, { fetchImpl, storage, clock, freshMs, force });
      if (r.error) {
        // Live fetch failed; the (stale) cache served. Render on the very first
        // load before reporting, so the error handler sees the Train is up. Counts
        // as a failure for backoff.
        consecutiveFailures += 1;
        if (first) emit(r.event, r.payload);
        onError(r.error);
      } else {
        // Success: a fresh fetch, or a fresh cache-hit that skipped the network.
        consecutiveFailures = 0;
        emit(r.event, r.payload);
      }
    } catch (err) {
      // Cold start with no cache: nothing to show. Keep retrying if polling.
      consecutiveFailures += 1;
      onError(err);
    } finally {
      first = false;
      schedule();
    }
  }

  const ready = attempt(false);
  return {
    ready,
    stop() {
      stopped = true;
      if (timer != null) clearTimer(timer);
    },
  };
}
