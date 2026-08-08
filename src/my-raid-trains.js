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
 *
 * Retries (#47): the two reads a streamer is actually waiting on — the user
 * record, and the per-Event manual Refresh — re-attempt a *thrown* failure on
 * backoff's retry curve before giving up to the cache. This matters more than
 * ordinary flakiness insurance, because a good read that never reaches RaidPal
 * is not a **Verified read** (CONTEXT.md), and #39 and #41 both hang real
 * behaviour off that bar: one unlucky response and the Live Link stops pruning
 * and the store stops cleaning up, silently, until the streamer intervenes.
 *
 * The sequential detail loop deliberately does NOT retry. It is N reads deep,
 * and N × the retry ladder turns one bad RaidPal minute into a minutes-long
 * spinner; each card already fails soft in isolation and carries its own
 * Refresh button, which does retry.
 */

import { fetchUserPayload, fetchEventPayload, normalizeUser, normalizeEvent } from './raidpal-client.js';
import { retry, RETRY_ATTEMPTS } from './backoff.js';

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
 * manual refresh) → fetch, re-cache. A failed fetch is re-attempted on the
 * retry curve (`attempts`, default 3) before the read is called lost; only then
 * does it fall back to the stale cache with `error` so the train list never
 * blanks, or rethrow when there is no cache. An unknown login is a definitive
 * 204, not a failure: it returns `{ user: null, notFound: true }` — unretried,
 * since RaidPal answered — but leaves any last-good cache intact, because the
 * undocumented API earns no trust and the UI decides what to discard.
 *
 * `attempts`, `sleep` and `rand` exist for tests and for a caller that wants a
 * different patience; `onRetry({ error, attempt, delayMs })` observes the waits.
 *
 * Returns `{ user, payload, fromCache, fresh?, error?, notFound? }`.
 */
export async function loadMyRaidTrains(login, { fetchImpl, storage, clock = Date.now, freshMs = FRESH_MS, force = false, attempts = RETRY_ATTEMPTS, sleep, rand, onRetry }) {
  const key = userCacheKey(login);
  if (!force) {
    const cached = readEntry(storage, key);
    if (isFresh(cached, clock, freshMs)) {
      return { user: normalizeUser(cached.payload), payload: cached.payload, fromCache: true, fresh: true };
    }
  }
  let payload;
  try {
    payload = await retry(() => fetchUserPayload(login, fetchImpl), { attempts, sleep, rand, onRetry });
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
 *
 * `retryOpts` is null for the sequential loop (one attempt each, see the module
 * note) and set for the manual per-Event Refresh.
 */
async function loadOneEventDetail(slug, { fetchImpl, storage, clock, freshMs, force, onBeforeFetch = async () => {}, retryOpts = null }) {
  const key = eventCacheKey(slug);
  if (!force) {
    const cached = readEntry(storage, key);
    if (isFresh(cached, clock, freshMs)) {
      return { slug, event: normalizeEvent(cached.payload), payload: cached.payload, fromCache: true, fresh: true, didFetch: false };
    }
  }
  await onBeforeFetch();
  try {
    const fetchOnce = () => fetchEventPayload(slug, fetchImpl);
    const payload = retryOpts ? await retry(fetchOnce, retryOpts) : await fetchOnce();
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
 * and rewrite its entry. Retries a thrown failure — the streamer pressed the
 * button and is watching it spin — then fails soft like the sequential loop:
 * stale cache + `error` on a live failure, never a throw.
 */
export async function refreshEventDetail(slug, { fetchImpl, storage, clock = Date.now, attempts = RETRY_ATTEMPTS, sleep, rand, onRetry }) {
  return stripDidFetch(await loadOneEventDetail(slug, {
    fetchImpl, storage, clock, freshMs: FRESH_MS, force: true,
    retryOpts: { attempts, sleep, rand, onRetry },
  }));
}
