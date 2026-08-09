/**
 * live-link-feed: the Overlay's Live Link orchestration. Wraps the pure
 * live-link resolution in the same resilience discipline as event-feed: the
 * user payload is cached last-good in the Overlay's OWN namespace (a failed
 * read resolves from stale data — it is never "you left the train"), and a
 * self-rescheduling resolve tick re-picks the live/next train so an
 * always-on OBS source rolls train-to-train unattended.
 *
 * Division of labor: this module decides WHICH train renders and with WHAT
 * effective config (base query ⊕ trains= mapping); the inner event-feed it
 * starts per train keeps owning lineup fetching, caching, and change dedupe.
 * The shell only wires callbacks: onSwitch (new train + its config), onEvent
 * (lineup data), onIdle (nothing to render; #15's card hooks here), onError.
 */

import { MAX_BLOB_CHARS } from './blob-codec.js';
import { fetchUserPayload, normalizeUser } from './raidpal-client.js';
import { startEventFeed } from './event-feed.js';
import { nextPollDelayMs } from './backoff.js';
import { decodeTrainMap, resolveLiveTrain, effectiveQuery } from './live-link.js';
import { parseConfig } from './config.js';

const USER_CACHE_PREFIX = 'raidtrainoverlay.cache.user.v1.';
// Live Link ALWAYS re-resolves (that's its promise), even when refresh=0
// keeps the inner lineup feed fetch-on-load-only. Default matches the
// event-feed freshness floor.
const DEFAULT_RESOLVE_MIN = 15;

/** localStorage key for a login's last-good user payload (Overlay-side cache). */
export function userCacheKey(login) {
  return USER_CACHE_PREFIX + login.toLowerCase();
}

/** Read the cached user payload, or null. Never throws (event-feed discipline). */
function readUserCache(storage, login) {
  const raw = storage.getItem(userCacheKey(login));
  if (raw == null) return null;
  try {
    const entry = JSON.parse(raw);
    return entry?.payload ?? null;
  } catch {
    return null;
  }
}

/**
 * Start the Live Link feed from the Overlay's raw query string (`baseQuery`
 * must contain `user=`). Returns `{ stop, ready }` like startEventFeed.
 *
 * Each resolve tick: fetch the user (stale-cache fallback on failure; an
 * unknown login reports once and idles), pick live/lead/idle, and on a train
 * change stop the old lineup feed and start the new one under the train's
 * effective config. Resolve cadence: `refresh` minutes when set, else 15 —
 * with the standard exponential backoff + jitter on consecutive failures.
 */
export function startLiveLinkFeed(baseQuery, deps) {
  const {
    fetchImpl,
    storage,
    clock = Date.now,
    setTimer = (fn, ms) => setTimeout(fn, ms),
    clearTimer = (id) => clearTimeout(id),
    rand = Math.random,
    onSwitch = () => {},
    onEvent = () => {},
    onIdle = () => {},
    onError = () => {},
  } = deps;

  const baseConfig = parseConfig(baseQuery);
  const login = baseConfig.user;
  // A `trains=` that will not decode is the loudest thing that can go wrong
  // here and used to be the quietest: `?? {}` turns it into "no per-train
  // settings", so every train renders with the base and nothing anywhere says
  // why (#33). Falling back is still right — a corrupt blob must not stop the
  // Overlay — but it has to be findable in the console.
  const decoded = decodeTrainMap(baseConfig.trains);
  if (decoded == null && baseConfig.trains != null) {
    console.warn(
      `RaidTrainOverlay: ?trains= could not be read — every train renders with the base settings. `
      + `The blob is corrupt or over the ${MAX_BLOB_CHARS}-character limit; re-copy the Live Link from the Configurator.`,
    );
  }
  const map = decoded ?? {};
  const resolveMins = baseConfig.refresh > 0 ? baseConfig.refresh : DEFAULT_RESOLVE_MIN;

  let consecutiveFailures = 0;
  let activeSlug = null;
  let innerFeed = null;
  let notFoundReported = false;
  let timer = null;
  let stopped = false;

  function stopInner() {
    if (innerFeed) innerFeed.stop();
    innerFeed = null;
    activeSlug = null;
  }

  function schedule() {
    if (stopped) return;
    timer = setTimer(resolveTick, nextPollDelayMs({ refreshMins: resolveMins, consecutiveFailures, rand }));
  }

  async function loadUser() {
    try {
      const payload = await fetchUserPayload(login, fetchImpl);
      if (payload == null) return { notFound: true };
      storage.setItem(userCacheKey(login), JSON.stringify({ payload, savedAt: clock() }));
      consecutiveFailures = 0;
      return { user: normalizeUser(payload) };
    } catch (error) {
      consecutiveFailures += 1;
      const cached = readUserCache(storage, login);
      if (cached == null) return { error };
      return { user: normalizeUser(cached), error };
    }
  }

  async function resolveTick() {
    const r = await loadUser();
    if (r.error) onError(r.error);
    if (r.notFound) {
      // A definitive 204 — the login isn't on RaidPal. Report once (a typo'd
      // Live Link should be findable in the console), idle empty, keep
      // checking: the account may appear.
      if (!notFoundReported) {
        notFoundReported = true;
        onError(new Error(`RaidPal has no user "${login}" — the Live Link renders nothing.`));
      }
      stopInner();
      onIdle({ upcoming: [] });
    } else if (r.user) {
      notFoundReported = false;
      const { state, train, upcoming } = resolveLiveTrain(r.user.events, new Date(clock()));
      if (baseConfig.uponly) {
        // Upcoming-only Live Link (?uponly=1): whatever state the resolver
        // found, this source renders the upcoming card and never the Train —
        // a second URL for a separate OBS scene (starting soon / BRB). No
        // inner lineup feed is ever started, so no per-train fetches happen.
        stopInner();
        onIdle({ upcoming });
      } else if (state === 'idle') {
        stopInner();
        onIdle({ upcoming });
      } else if (train.slug !== activeSlug) {
        stopInner();
        activeSlug = train.slug;
        const config = parseConfig(effectiveQuery(baseQuery, map[train.slug]));
        onSwitch(train.slug, config);
        innerFeed = startEventFeed(train.slug, config, {
          fetchImpl, storage, clock, setTimer, clearTimer, rand, onEvent, onError,
        });
        await innerFeed.ready;
      }
    }
    // r.error with no cache: nothing to resolve from — keep the current
    // train (if any) rendering and retry on the backed-off cadence.
    schedule();
  }

  const ready = resolveTick();
  return {
    ready,
    stop() {
      stopped = true;
      if (timer != null) clearTimer(timer);
      stopInner();
    },
  };
}
