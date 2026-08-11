/**
 * feed-verdict: how much a My Raid Trains read is allowed to prove. Pure — no
 * fetch, no storage, no clock — because the judgement needs none of them.
 *
 * Deliberately NOT the read itself. The feed is the Configurator's render data
 * in dozens of places (status for the loading/not-found/error views, events for
 * classification, details for the cards, display name for slot resolution), so
 * a module owning the load would drag every view builder through a new
 * interface. The cut is at the judgement: the Configurator keeps the feed and
 * asks this what it may conclude from it.
 *
 * Two bars, and they are two because four issues put them there (#31, #39,
 * #41, #49). Every caller that needs either asks here, so the distinction
 * cannot drift between the end-time lookup, the Live Link and Cleanup.
 */

/**
 * What a feed snapshot proves.
 *
 * `events` non-null is a **Good read** — a `ready` status with no error and
 * nothing served from a stale cache. Everything downstream treats those events
 * as positive evidence about when trains end (#31), so a doubtful read must
 * contribute none.
 *
 * `verified` is a **Verified read** — a Good read that actually reached RaidPal
 * (#39). Goodness alone cannot tell: `loadMyRaidTrains` serves a cache hit
 * inside its 6h window with no error and no stale flag, so a feed can look
 * perfectly healthy and still be a six-hour-old snapshot nobody re-checked.
 * That is fine for an end time — a recorded fact — but absence from it is an
 * inference, and pruning a train's overrides on a stale inference is silent
 * data loss. Hence the strict test: a read that never said whether it reached
 * RaidPal has not earned the stronger bar.
 *
 * @param {{ status?: string, events?: object[], error?: unknown, stale?: unknown, fromCache?: boolean }} feed
 * @returns {{ events: object[] | null, verified: boolean }}
 */
export function readVerdict(feed) {
  const good = feed.status === 'ready' && !feed.stale && !feed.error ? feed.events : null;
  return { events: good, verified: good != null && feed.fromCache === false };
}
