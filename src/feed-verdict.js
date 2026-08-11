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
 *
 * Cleanup's judgement half lives here too, as a plan: when to spend a Verified
 * read on a prune, and whose answer to overrule. The conditions themselves stay
 * in profiles.js — this only decides when to ask.
 */

import { pruneOrphanedConfigs, restoreTrainConfigs } from './profiles.js';

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

/**
 * What Cleanup should do about this read (#41), or null for "nothing at all".
 *
 * Pure, and returns a NEW store — the same discipline pruneOrphanedConfigs and
 * restoreTrainConfigs already keep. The caller assigns the store, persists it,
 * and raises the notice; none of that happens here.
 *
 * The judgement is only ever WHEN to ask. The five conditions that make a
 * removal safe live in pruneOrphanedConfigs, where they are tested, and are not
 * restated here.
 *
 * - `alreadyRan` throttles the automatic pass to once per session, so a session
 *   that opens the Configurator repeatedly does not keep re-testing the same
 *   rule against the same feed. `force` is the explicit refresh, which the
 *   streamer asked for and which therefore bypasses it.
 * - `kept` is the session-scoped suppression behind the notice's *Keep them*.
 *   The prune is blind to it by design — it answers "is this reachable?", not
 *   "did the streamer overrule us?" — so suppressed Configs are put straight
 *   back and left out of what is reported. Without it, the next Verified read
 *   deletes exactly what the streamer just asked us to keep, possibly before
 *   they have finished reading the notice offering it.
 *
 * Both stay the CALLER'S: the suppression's whole rule is that it dies with the
 * page, matching the undo's own lifetime, and a page lifetime is a fact the
 * page owns. Held in here, the rule would go invisible and this module would
 * acquire a lifetime it has no other need for.
 *
 * `login` arrives per call and is never held, which is what makes the notice
 * safe to leave on screen while the active Profile changes underneath it:
 * pinning the login to what was removed is provably the caller's job, done at
 * the moment it had the login.
 *
 * @param {object} args
 * @param {object} args.feed        the Configurator's feed snapshot
 * @param {object} args.store       the Profiles store
 * @param {string|null} args.login  the Profile the read was for
 * @param {{ has(slug: string): boolean }} [args.kept]  slugs the streamer kept
 * @param {number} args.now         epoch ms, for the past-endsAt guard
 * @param {boolean} [args.alreadyRan]  has the automatic pass already run
 * @param {boolean} [args.force]    an explicit refresh, which bypasses that
 * @returns {null | { store: object, removed: Array<{ slug: string, config: object }> }}
 */
export function planCleanup({ feed, store, login, kept, now, alreadyRan = false, force = false }) {
  if (!force && alreadyRan) return null;
  const { events, verified } = readVerdict(feed);
  if (!verified) return null;
  const { store: pruned, removed } = pruneOrphanedConfigs(store, login, { events, verified: true, now });
  if (removed.length === 0) return null;
  const held = removed.filter((r) => kept?.has(r.slug));
  const fresh = removed.filter((r) => !kept?.has(r.slug));
  if (fresh.length === 0) return null;
  return { store: held.length ? restoreTrainConfigs(pruned, login, held) : pruned, removed: fresh };
}
