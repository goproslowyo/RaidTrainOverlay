/**
 * lineup-codec: the URL wire format for a hand-built ("manual") lineup, carried in
 * the Overlay's ?lineup= param. The inverse pair encodeLineup/decodeLineup — the
 * manual-lineup analogue of config.js's serialize/parse.
 *
 * The wire model is compact and editor-friendly (per-DJ DURATIONS, not expanded
 * slots) and VERSIONED so a shareable OBS URL stays readable as the format evolves:
 *   { v, t:title, o:{n:name, i?:avatarUrl}, z:ianaZone, s:ISO-instant, d:[{h:handle, d:mins}] }
 * `z` is the authoring zone (kept only so re-opening the lineup in the editor shows
 * the original zone); the Overlay itself needs only the absolute instant `s`.
 *
 * decodeLineup is DEFENSIVE — it never throws and returns null on any bad, oversized,
 * or unknown-version input, so a corrupt blob renders nothing (never broken UI),
 * mirroring the event-feed's cold-start discipline. No DOM; runs in the Overlay and
 * in node:test alike (btoa/atob + TextEncoder/TextDecoder are globals in both).
 */
import { encodeJsonBlob, decodeJsonBlob } from './blob-codec.js';

const WIRE_VERSION = 1;

/** Manual-lineup model → URL-safe blob. Stamps the wire version. */
export function encodeLineup(model) {
  const wire = { v: WIRE_VERSION, ...model };
  return encodeJsonBlob(wire);
}

/** A `{n, ...}` organiser, optional avatar. */
function isOrganiser(o) {
  return o != null && typeof o === 'object' && typeof o.n === 'string'
    && (o.i === undefined || typeof o.i === 'string');
}

/** A `[{h, d}]` lineup of at least one DJ with a positive duration. */
function isLineup(d) {
  return Array.isArray(d) && d.length > 0
    && d.every((x) => x != null && typeof x === 'object' && typeof x.h === 'string'
      && Number.isFinite(x.d) && x.d > 0);
}

/**
 * URL blob → manual-lineup model, or null. Validates the wire version and the full
 * shape; any failure (bad base64/JSON, wrong shape, unknown version, oversize) → null.
 * Returns the domain model (the `v` wire field is stripped) so it round-trips with
 * encodeLineup's input.
 */
export function decodeLineup(str) {
  const wire = decodeJsonBlob(str);
  if (wire == null || typeof wire !== 'object' || wire.v !== WIRE_VERSION) return null;
  if (typeof wire.t !== 'string' || typeof wire.s !== 'string' || typeof wire.z !== 'string') return null;
  if (!isOrganiser(wire.o) || !isLineup(wire.d)) return null;
  const { v, ...model } = wire; // strip the wire version → clean domain model
  void v;
  return model;
}
