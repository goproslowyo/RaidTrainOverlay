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
const WIRE_VERSION = 1;
// An ENCODED blob (the base64url string) over this many chars is rejected — a runaway
// lineup that would approach browser/OBS URL limits. base64 is ~33% larger than the
// JSON it carries, so this conservatively bounds the model below ~6 KB (hundreds of DJs).
const MAX_BLOB_CHARS = 8192;

function bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded); // throws on invalid base64 — caught by decodeLineup
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Manual-lineup model → URL-safe blob. Stamps the wire version. */
export function encodeLineup(model) {
  const wire = { v: WIRE_VERSION, ...model };
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(wire)));
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
  if (typeof str !== 'string' || str === '' || str.length > MAX_BLOB_CHARS) return null;
  let wire;
  try {
    wire = JSON.parse(new TextDecoder().decode(b64urlToBytes(str)));
  } catch {
    return null;
  }
  if (wire == null || typeof wire !== 'object' || wire.v !== WIRE_VERSION) return null;
  if (typeof wire.t !== 'string' || typeof wire.s !== 'string' || typeof wire.z !== 'string') return null;
  if (!isOrganiser(wire.o) || !isLineup(wire.d)) return null;
  const { v, ...model } = wire; // strip the wire version → clean domain model
  void v;
  return model;
}
