/**
 * live-link-url: the Configurator half of the Live Link — turning a Profile's
 * local stores into the one URL a streamer pastes into OBS. The mirror of
 * src/live-link.js, which reads that URL back on the Overlay side.
 *
 * The URL is the save file: the Overlay never reads Configurator storage, so
 * everything the Profile knows has to be encoded here. The base query carries
 * the default Preset's settings plus the standing Spotlights; the `trains=`
 * blob carries, per Event slug, only what that Raid Train Config makes
 * DIFFERENT from the base. A Profile whose trains all use the default Preset
 * unchanged therefore produces no blob at all — the copy-once path the Live
 * Link decision (#6) was chosen to protect.
 */

import { MAX_BLOB_CHARS } from './blob-codec.js';
import { buildOverlayQuery } from './configurator.js';
import { encodeTrainMap } from './live-link.js';
import { getPreset } from './preset-library.js';
import { resolveTrainSettings } from './profiles.js';
import { diffSettings, normalizeSettings, toQueryValues } from './settings-schema.js';

/** Names in `additions` that the standing list doesn't already cover (case-insensitive). */
function spotlightAdditions(standing, additions) {
  return additions.filter((name) => !standing.some((s) => s.toLowerCase() === name.toLowerCase()));
}

/**
 * The Profile's base settings — its default Preset, or the Overlay's own
 * defaults when it has none (or the reference dangles). Exported because both
 * the URL builder and the "styled by" line in the UI need the same answer.
 */
export function baseSettings(library, store, login) {
  const profile = store.profiles?.[(login ?? '').toLowerCase()];
  return normalizeSettings(getPreset(library, profile?.defaultPresetId ?? null)?.settings ?? {});
}

/**
 * When each Config's Event is known to finish, freshest source first: a good
 * read of the feed beats the end time the store recorded earlier (a train can
 * be rescheduled), and a slug the feed doesn't mention falls back to what the
 * store already observed.
 *
 * `events` must be null unless the read was GOOD — see buildTrainMap, which
 * reads absence from the same argument and would prune the whole map on a bad
 * read that got this far.
 */
function endTimes(profile, events) {
  const ends = new Map();
  for (const slug of Object.keys(profile.trains ?? {})) {
    const endsAt = profile.trains[slug]?.endsAt;
    if (typeof endsAt === 'number' && Number.isFinite(endsAt)) ends.set(slug, endsAt);
  }
  if (Array.isArray(events)) {
    for (const event of events) {
      const ms = event?.endtime instanceof Date ? event.endtime.getTime() : Number(event?.endtime);
      if (Number.isFinite(ms)) ends.set(event.slug, ms);
    }
  }
  return ends;
}

/**
 * Per-slug mapping `{ [slug]: { overrides, spotlight } }` for `trains=`, in the
 * shape encodeTrainMap takes. Only Configs that actually diverge from the base
 * appear: a Config that resolves to exactly the base settings with no extra
 * Spotlights would add bytes and change the URL for no visible effect.
 *
 * Overrides are RAW query values (checkboxes as `1`/`0`) so an override to OFF
 * survives the trip — an absent param would read as "inherit the base".
 *
 * Trains the streamer will not run are skipped, so the blob tracks their
 * upcoming schedule instead of growing with their history (#31). Two grounds,
 * and the load-bearing fact under both is that the Overlay resolves which
 * train renders by fetching the SAME user endpoint. An entry it can never
 * match is unreachable, so dropping it changes nothing on stream:
 *
 *   1. Absent from a GOOD read. The endpoint returns only upcoming events, so
 *      a slug it does not list is one of: ended, deleted, or renamed. The
 *      Overlay will never resolve to any of them — a renamed slug is as dead
 *      as an ended one — so the entry is pure weight in the URL.
 *   2. A known end time in the past. Catches the ~6h window where an ended
 *      train is still listed, from `endsAt` recorded earlier or from the read
 *      itself.
 *
 * The failure mode is the part to keep right, and the two grounds do not need
 * the same evidence:
 *
 * - `events` MUST be null unless the read was good. `fetchUserPayload` returns
 *   null for any unexpected 200 body, and a read that failed or was served
 *   stale is not evidence of anything — pruning on one would blank an entire
 *   Live Link on a bad RaidPal day.
 * - `verified` MUST be true only when that read actually reached RaidPal.
 *   Ground 1 is an INFERENCE from absence and it decays: `loadMyRaidTrains`
 *   serves a cache hit inside its 6h window as `{ fromCache: true, fresh: true }`
 *   with no error and no stale flag, so a healthy-looking feed can be six hours
 *   old and never re-checked — and one degraded-but-well-formed response poisons
 *   it for that whole window. Ground 2 is a recorded FACT and does not decay, so
 *   it still applies to a cached read.
 *
 * `verified` defaults to false so a caller that has not thought about
 * provenance prunes nothing on absence. With `events: null` nothing is dropped
 * on absence either, and with no `now` nothing is dropped on time.
 */
export function buildTrainMap(library, store, login, { now = null, events = null, verified = false } = {}) {
  const profile = store.profiles?.[(login ?? '').toLowerCase()];
  if (!profile) return {};
  const at = now instanceof Date ? now.getTime() : now;
  const haveClock = Number.isFinite(at);
  // End times come from the read whatever its age — when a train finishes is a
  // fact RaidPal reported, not something inferred from what is missing.
  const ends = haveClock ? endTimes(profile, events) : new Map();
  // Absence, by contrast, only speaks when the read was actually verified.
  const listed = verified && Array.isArray(events) ? new Set(events.map((e) => e?.slug)) : null;
  const base = baseSettings(library, store, login);
  const map = {};
  for (const slug of Object.keys(profile.trains ?? {})) {
    if (listed && !listed.has(slug)) continue;
    // A live or lead train always ends in the future, so a Live Link copied
    // mid-train is never affected.
    if (haveClock && ends.has(slug) && ends.get(slug) < at) continue;
    const resolved = resolveTrainSettings(library, store, login, slug);
    // resolveTrainSettings returns a Preset-⊕-overrides object that may be
    // sparse (no Preset at all → `{}`); normalize before diffing so a missing
    // field compares as the Overlay default rather than as a difference.
    const diff = diffSettings(base, resolved.settings);
    const effective = toQueryValues(resolved.settings);
    const overrides = {};
    for (const key of Object.keys(diff)) overrides[key] = effective[key];
    const spotlight = spotlightAdditions(profile.spotlight ?? [], resolved.spotlight ?? []);
    if (Object.keys(overrides).length === 0 && spotlight.length === 0) continue;
    map[slug] = { overrides, spotlight };
  }
  return map;
}

/**
 * The Live Link for a Profile: the query string, plus what the panel needs to
 * tell the streamer the truth about it.
 *
 * `oversize` is the point of this function existing. The `trains=` cap lives
 * in blob-codec and is enforced on DECODE only, so before this the
 * Configurator would hand over a URL whose every per-train override was
 * already dead on arrival — the Overlay's `decodeTrainMap` returns null and
 * the feed's `?? {}` swallows it, silently (#33).
 *
 * Deliberately NOT truncated. A blob trimmed to fit would drop some trains
 * and keep others, which is the same silent wrong-settings failure moved one
 * layer up and made harder to see. The blob rides whole, the panel says it is
 * too big, and the fix is the streamer's to make: fewer trains carrying their
 * own Config, or less overridden on each. (A blob that is oversize today also
 * starts working unchanged if the cap is ever raised.)
 *
 * `when` is passed straight to buildTrainMap — `{ now, events, verified }`,
 * where `events` is the feed only when the read was good and `verified` says
 * that read actually reached RaidPal rather than the cache. `trainCount` is
 * what survives that filter, which is what the panel's coverage line reports.
 *
 * Returns `{ query: '' }` with a zero count for an unknown or blank login —
 * there is no Live Link without an identity to resolve.
 */
export function buildLiveLink(library, store, login, when = {}) {
  const key = (login ?? '').trim().toLowerCase();
  const profile = store.profiles?.[key];
  const empty = { query: '', trainCount: 0, blobChars: 0, maxBlobChars: MAX_BLOB_CHARS, oversize: false };
  if (key === '' || !profile) return empty;
  const map = buildTrainMap(library, store, login, when);
  const trainCount = Object.keys(map).length;
  const blob = trainCount > 0 ? encodeTrainMap(map) : '';
  // The idle-card knobs: null prefs stay absent so the Overlay's own defaults
  // apply and the copy-once URL stays lean.
  const prefs = profile.liveLink ?? {};
  const idleKnobs = {};
  for (const knob of ['uppos', 'upop', 'upcycle', 'upscroll', 'upstyle']) {
    if (prefs[knob] != null) idleKnobs[knob] = prefs[knob];
  }
  return {
    query: buildOverlayQuery({
      ...baseSettings(library, store, login),
      user: key,
      trains: blob,
      upcoming: prefs.upcoming ?? '',
      ...idleKnobs,
      spotlight: (profile.spotlight ?? []).join(','),
    }),
    trainCount,
    blobChars: blob.length,
    maxBlobChars: MAX_BLOB_CHARS,
    oversize: blob.length > MAX_BLOB_CHARS,
  };
}

/**
 * Just the query string (no leading `?`) — the common case. Callers that need
 * to know whether the blob fits want buildLiveLink instead.
 */
export function buildLiveLinkQuery(library, store, login, when = {}) {
  return buildLiveLink(library, store, login, when).query;
}
