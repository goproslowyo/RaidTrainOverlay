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
 * Per-slug mapping `{ [slug]: { overrides, spotlight } }` for `trains=`, in the
 * shape encodeTrainMap takes. Only Configs that actually diverge from the base
 * appear: a Config that resolves to exactly the base settings with no extra
 * Spotlights would add bytes and change the URL for no visible effect.
 *
 * Overrides are RAW query values (checkboxes as `1`/`0`) so an override to OFF
 * survives the trip — an absent param would read as "inherit the base".
 */
export function buildTrainMap(library, store, login) {
  const profile = store.profiles?.[(login ?? '').toLowerCase()];
  if (!profile) return {};
  const base = baseSettings(library, store, login);
  const map = {};
  for (const slug of Object.keys(profile.trains ?? {})) {
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
 * Returns `{ query: '' }` with a zero count for an unknown or blank login —
 * there is no Live Link without an identity to resolve.
 */
export function buildLiveLink(library, store, login) {
  const key = (login ?? '').trim().toLowerCase();
  const profile = store.profiles?.[key];
  const empty = { query: '', trainCount: 0, blobChars: 0, maxBlobChars: MAX_BLOB_CHARS, oversize: false };
  if (key === '' || !profile) return empty;
  const map = buildTrainMap(library, store, login);
  const trainCount = Object.keys(map).length;
  const blob = trainCount > 0 ? encodeTrainMap(map) : '';
  return {
    query: buildOverlayQuery({
      ...baseSettings(library, store, login),
      user: key,
      trains: blob,
      upcoming: profile.liveLink?.upcoming ?? '',
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
export function buildLiveLinkQuery(library, store, login) {
  return buildLiveLink(library, store, login).query;
}
