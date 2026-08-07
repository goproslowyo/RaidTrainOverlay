/**
 * my-raid-trains: the Configurator's data layer for the My Raid Trains view.
 * Wraps raidpal-client's user + event fetches with a ~6h last-good cache and
 * fail-soft reads against the undocumented API: a failed read serves the stale
 * cache and reports the error — it is NEVER "you left the train" — and Event
 * detail fetches run one at a time with a pause, so a long train list doesn't
 * hammer RaidPal.
 *
 * The cache is the Configurator's OWN localStorage namespace, separate from
 * the Overlay's event-feed cache: the two pages stay decoupled (the Overlay
 * never reads Configurator storage) and their freshness windows differ
 * (Overlay minutes, Configurator hours). Storage, fetch, clock, and sleep are
 * all injected; the page owns the real localStorage.
 */

import { fetchUserPayload, fetchEventPayload, normalizeUser, normalizeEvent } from './raidpal-client.js';

const CACHE_PREFIX = 'raidtrainoverlay.myraidtrains.v1.';

/** Default freshness window: within ~6h the view renders from cache, no API call. */
export const FRESH_MS = 6 * 60 * 60_000;

const DEFAULT_PAUSE_MS = 500;

/** localStorage key for a login's last-good user payload (lookup is case-insensitive). */
export function userCacheKey(login) {
  return `${CACHE_PREFIX}user.${login.toLowerCase()}`;
}

/** localStorage key for an Event slug's last-good detail payload. */
export function eventCacheKey(slug) {
  return `${CACHE_PREFIX}event.${slug}`;
}

function writeEntry(storage, key, payload, savedAt) {
  storage.setItem(key, JSON.stringify({ payload, savedAt }));
}

/** Read a cached `{ payload, savedAt }`, or null if missing/corrupt. Never throws. */
function readEntry(storage, key) {
  const raw = storage.getItem(key);
  if (raw == null) return null;
  try {
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || entry.payload == null) return null;
    return { payload: entry.payload, savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

function isFresh(entry, clock, freshMs) {
  return entry != null && clock() - entry.savedAt < freshMs;
}

/**
 * Load a Profile's user record (profile + Event summaries), cache-first.
 *
 * Fresh cache → served with no network call. Stale/missing (or `force`, the
 * manual refresh) → fetch, re-cache. A live failure falls back to the stale
 * cache with `error` so the train list never blanks; with no cache it
 * rethrows. An unknown login is a definitive 204, not a failure: it returns
 * `{ user: null, notFound: true }` but leaves any last-good cache intact —
 * the undocumented API earns no trust, so the UI decides what to discard.
 *
 * Returns `{ user, payload, fromCache, fresh?, error?, notFound? }`.
 */
export async function loadMyRaidTrains(login, { fetchImpl, storage, clock = Date.now, freshMs = FRESH_MS, force = false }) {
  const key = userCacheKey(login);
  if (!force) {
    const cached = readEntry(storage, key);
    if (isFresh(cached, clock, freshMs)) {
      return { user: normalizeUser(cached.payload), payload: cached.payload, fromCache: true, fresh: true };
    }
  }
  let payload;
  try {
    payload = await fetchUserPayload(login, fetchImpl);
  } catch (error) {
    const cached = readEntry(storage, key);
    if (cached == null) throw error;
    return { user: normalizeUser(cached.payload), payload: cached.payload, fromCache: true, error };
  }
  if (payload == null) return { user: null, payload: null, fromCache: false, notFound: true };
  writeEntry(storage, key, payload, clock());
  return { user: normalizeUser(payload), payload, fromCache: false };
}

/**
 * One Event detail, cache-first, fail-soft. Returns
 * `{ slug, event, payload, fromCache, fresh?, error? }` — never throws: a
 * live failure serves the stale cache with `error`, or `event: null` when
 * there is nothing cached. `didFetch` on the result tells the sequential
 * loop whether the network was actually touched (pause pacing).
 */
async function loadOneEventDetail(slug, { fetchImpl, storage, clock, freshMs, force, onBeforeFetch = async () => {} }) {
  const key = eventCacheKey(slug);
  if (!force) {
    const cached = readEntry(storage, key);
    if (isFresh(cached, clock, freshMs)) {
      return { slug, event: normalizeEvent(cached.payload), payload: cached.payload, fromCache: true, fresh: true, didFetch: false };
    }
  }
  await onBeforeFetch();
  try {
    const payload = await fetchEventPayload(slug, fetchImpl);
    const event = normalizeEvent(payload);
    writeEntry(storage, key, payload, clock());
    return { slug, event, payload, fromCache: false, didFetch: true };
  } catch (error) {
    const cached = readEntry(storage, key);
    if (cached == null) return { slug, event: null, payload: null, fromCache: false, error, didFetch: true };
    return { slug, event: normalizeEvent(cached.payload), payload: cached.payload, fromCache: true, error, didFetch: true };
  }
}

function stripDidFetch({ didFetch, ...result }) {
  return result;
}

/**
 * Load the details for a list of Event summaries (anything with a `slug`),
 * SEQUENTIALLY — one fetch at a time with a `pauseMs` sleep between network
 * fetches (cache hits neither fetch nor pause, so a warm reload is instant
 * and silent). Each Event fails soft in isolation: one bad slug yields an
 * `error` entry (stale cache if available) and the rest still load.
 *
 * Returns an array of `{ slug, event, payload, fromCache, fresh?, error? }`
 * in input order; `onDetail(result, index)` fires as each settles so the UI
 * can render progressively.
 */
export async function loadEventDetails(summaries, deps) {
  const { pauseMs = DEFAULT_PAUSE_MS, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onDetail = () => {}, ...rest } = deps;
  const results = [];
  let fetchedBefore = false;
  for (const { slug } of summaries) {
    // The pause runs only when this Event actually goes to the network, and
    // only after a previous network fetch — cache hits neither pause nor reset
    // the pacing.
    const onBeforeFetch = async () => {
      if (fetchedBefore) await sleep(pauseMs);
    };
    const r = await loadOneEventDetail(slug, { clock: Date.now, freshMs: FRESH_MS, force: false, ...rest, onBeforeFetch });
    fetchedBefore = fetchedBefore || r.didFetch;
    const result = stripDidFetch(r);
    results.push(result);
    onDetail(result, results.length - 1);
  }
  return results;
}

/**
 * The per-Event manual refresh: force-fetch one Event past any fresh cache
 * and rewrite its entry. Fails soft like the sequential loop — stale cache +
 * `error` on a live failure, never a throw.
 */
export async function refreshEventDetail(slug, { fetchImpl, storage, clock = Date.now }) {
  return stripDidFetch(await loadOneEventDetail(slug, { fetchImpl, storage, clock, freshMs: FRESH_MS, force: true }));
}
