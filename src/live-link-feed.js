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
import { fetchUserPayload, fetchEventPayload, normalizeUser, normalizeEvent } from './raidpal-client.js';
import { startEventFeed, cacheKey as eventCacheKey } from './event-feed.js';
import { nextPollDelayMs } from './backoff.js';
import { decodeTrainMap, resolveLiveTrain, effectiveQuery, mySlot, myWindows } from './live-link.js';
import { parseConfig } from './config.js';

const USER_CACHE_PREFIX = 'raidtrainoverlay.cache.user.v1.';
// Live Link ALWAYS re-resolves (that's its promise), even when refresh=0
// keeps the inner lineup feed fetch-on-load-only. Default matches the
// event-feed freshness floor.
export const DEFAULT_RESOLVE_MIN = 15;

/** localStorage key for a login's last-good user payload (Overlay-side cache). */
export function userCacheKey(login) {
  return USER_CACHE_PREFIX + login.toLowerCase();
}

// The Upcoming card re-reads a lineup this often at most (per slug); between
// reads the Overlay's own event cache answers. Lineups shift, but slot times
// rarely move within hours — and the resolve tick re-runs this every cycle.
const SLOT_FRESH_MS = 6 * 60 * 60_000;
// The polite pause between consecutive lineup fetches (my-raid-trains' pacing).
const SLOT_FETCH_PAUSE_MS = 400;

/** Read the event-feed cache's `{ payload, savedAt }` for a slug, or null. */
function readEventCache(storage, slug) {
  const raw = storage.getItem(eventCacheKey(slug));
  if (raw == null) return null;
  try {
    const entry = JSON.parse(raw);
    return entry?.payload ? entry : null;
  } catch {
    return null;
  }
}

/**
 * Read the lineups for a list of trains and hand each one to `derive`.
 *
 * The one lineup-reading loop this module has, because both of its readers want
 * exactly the same manners and used to be one of them: cache-first from the
 * Overlay's own event cache (shared with the active train's feed), fetched
 * sequentially with a polite pause when stale, and fail-soft per train — a
 * lineup that cannot be read yields `null` and the caller falls back rather
 * than the whole read failing. `cacheOnly` skips the network entirely, for the
 * paths that must not wait on it.
 *
 * Returns `{ [slug]: derive(event) }`, with unreadable trains simply absent —
 * which is what lets a caller tell "we could not tell" from a real answer.
 */
async function readLineups(trains, {
  fetchImpl, storage, clock = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms), cacheOnly = false,
}, derive) {
  const out = {};
  let fetched = false;
  for (const train of trains) {
    const cached = readEventCache(storage, train.slug);
    let payload = cached?.payload ?? null;
    const fresh = cached != null && clock() - cached.savedAt < SLOT_FRESH_MS;
    if (!fresh && !cacheOnly) {
      try {
        if (fetched) await new Promise((resolve) => setTimer(resolve, SLOT_FETCH_PAUSE_MS));
        payload = await fetchEventPayload(train.slug, fetchImpl);
        fetched = true;
        storage.setItem(eventCacheKey(train.slug), JSON.stringify({ payload, savedAt: clock() }));
      } catch {
        // keep whatever the cache had (possibly null) — the caller falls back.
      }
    }
    if (payload == null) continue;
    try {
      out[train.slug] = derive(normalizeEvent(payload));
    } catch {
      // a malformed cached payload must not sink the card or the resolution
    }
  }
  return out;
}

/**
 * The trains the Overlay might render right now: running, or departing within
 * the lead window. Only these need a lineup read before resolution — the rest
 * cannot take the Stage this tick whatever their lineup says, so making the
 * first paint wait on them would buy nothing.
 */
function selectionCandidates(events, now, leadMs) {
  return events.filter((e) => now <= e.endtime && e.starttime - now <= leadMs);
}

/**
 * `{ [slug]: myWindows(...) }` for the trains that could take the Stage — the
 * evidence `resolveLiveTrain` needs to pick the train the streamer is actually
 * ON rather than whichever one departed first. A slug missing from the result
 * is "we could not tell", and resolution falls back to the whole train there.
 */
export async function readMyWindows(events, names, deps, { now, leadMs }) {
  return readLineups(selectionCandidates(events, now, leadMs), deps, (event) => myWindows(event, names));
}

/**
 * The upcoming trains, each annotated with `mySlotAt` — when the streamer's
 * OWN slot starts — wherever the Event's lineup names them. `cacheOnly` skips
 * the network, so the first paint never waits on it. Fail-soft throughout: a
 * lineup that cannot be read, or one the streamer isn't on, simply leaves the
 * row on the train's departure time.
 */
export async function annotateMySlots(upcoming, names, deps) {
  const slots = await readLineups(upcoming, deps, (event) => mySlot(event, names));
  return upcoming.map((train) => {
    const slot = slots[train.slug];
    return slot ? { ...train, mySlotAt: slot.starttime } : { ...train };
  });
}

/** The annotation fingerprint — two paints with the same signature are the same card. */
const slotSignature = (list) => list.map((t) => +(t.mySlotAt ?? 0)).join(',');

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
    onHorizon = () => {},
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
  // How early the full Train rolls in ahead of the streamer's own slot. Read
  // from the BASE query, not a train's effective config: it decides which train
  // is chosen, so it cannot come from the mapping entry of a train not yet picked.
  const leadMs = baseConfig.lead * 60_000;

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
      const now = new Date(clock());
      const names = [login, r.user.displayName];
      const slotDeps = { fetchImpl, storage, clock, setTimer };
      // Which train the streamer is ON, not merely which one is running. The
      // lineups for the handful of trains that could take the Stage are read
      // first — cache-first, so a warm Overlay pays nothing — and a train whose
      // lineup will not read simply falls back to its whole-train window, which
      // is what this resolution did before it could read lineups at all.
      // `wholetrain=1` opts out by declining to gather the evidence, and so
      // does `uponly=1` — a source that never renders the Train has no use for
      // an answer to which train it would have rendered, and reading lineups
      // for one would be pure traffic.
      const windows = baseConfig.wholetrain || baseConfig.uponly
        ? null
        : await readMyWindows(r.user.events, names, slotDeps, { now, leadMs });
      const { state, train, upcoming } = resolveLiveTrain(r.user.events, now, { leadMs, windows });
      // The card says when the streamer PLAYS, wherever a lineup names them:
      // paint immediately from whatever the cache knows, then complete the
      // lineups over the network and repaint only if that changed anything.
      // One annotate-and-paint, two destinations: `onIdle` when nothing is
      // running, `onHorizon` when a train is. The live path gets the same
      // cache-first-then-full treatment — the between-Pass card lists other
      // trains too, so its rows must know when the streamer plays.
      // `detachFull` is what separates them: idle has nothing else to do, so it
      // awaits the network refinement, but a live train's resolve tick must not
      // sit behind slot lookups — it still has to schedule the next poll.
      const paint = async (emit, { detachFull = false } = {}) => {
        const first = await annotateMySlots(upcoming, names, { ...slotDeps, cacheOnly: true });
        emit({ upcoming: first });
        const refine = annotateMySlots(upcoming, names, slotDeps).then((full) => {
          if (!stopped && slotSignature(full) !== slotSignature(first)) emit({ upcoming: full });
        });
        if (detachFull) refine.catch(() => {}); // fail-soft: the rows keep their departure times
        else await refine;
      };
      const paintIdle = () => paint(onIdle);
      if (baseConfig.uponly) {
        // Upcoming-only Live Link (?uponly=1): whatever state the resolver
        // found, this source renders the upcoming card and never the Train —
        // a second URL for a separate OBS scene (starting soon / BRB). The
        // inner lineup feed is never started.
        stopInner();
        await paintIdle();
      } else if (state === 'idle') {
        stopInner();
        await paintIdle();
      } else {
        if (train.slug !== activeSlug) {
          stopInner();
          activeSlug = train.slug;
          const config = parseConfig(effectiveQuery(baseQuery, map[train.slug]));
          onSwitch(train.slug, config);
          innerFeed = startEventFeed(train.slug, config, {
            fetchImpl, storage, clock, setTimer, clearTimer, rand, onEvent, onError,
          });
          await innerFeed.ready;
        }
        // The horizon rides EVERY resolve tick, not just a switch: a broadcast
        // runs for hours, and the card that lists the other trains during it
        // would otherwise still be showing the horizon as it looked at sign-on.
        await paint(onHorizon, { detachFull: true });
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
