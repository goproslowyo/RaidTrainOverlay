/**
 * backup: the import/export blob for ALL Configurator-local data — the Preset
 * library, the Profiles store (with every Raid Train Config), and the saved
 * streamers. One paste-safe base64url string of gzipped JSON, versioned, so a
 * setup moves to another machine through the clipboard — the only cross-device
 * path a static site has.
 *
 * decodeBackup is fail-soft twice over: the ENVELOPE (base64/gzip/JSON/version)
 * rejects to null — a corrupt paste imports nothing — while each SECTION
 * re-enters its store's tolerant parser, so a malformed section degrades to
 * that store's safe empty rather than poisoning the rest. Async because
 * gzip rides CompressionStream (browser + Node 18 alike).
 */

import { bytesToB64url, b64urlToBytes } from './blob-codec.js';
import { parsePresetLibrary } from './preset-library.js';
import { parseProfiles } from './profiles.js';
import { parseStreamers } from './streamers.js';

const WIRE_VERSION = 1;
// Paste-safety bound: far above any real setup (gzip of hundreds of Configs
// is a few KB), low enough to refuse a hostile megapaste outright.
const MAX_BLOB_CHARS = 1_000_000;

async function pipeBytes(bytes, transform) {
  const stream = new Blob([bytes]).stream().pipeThrough(transform);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Stores → paste-safe blob. `version` is overridable only so tests can prove
 * the version gate; real callers never pass it.
 */
export async function encodeBackup({ presets, profiles, streamers }, { version = WIRE_VERSION } = {}) {
  const wire = { v: version, presets, profiles, streamers };
  const gzipped = await pipeBytes(new TextEncoder().encode(JSON.stringify(wire)), new CompressionStream('gzip'));
  return bytesToB64url(gzipped);
}

/**
 * Blob → `{ presets, profiles, streamers }`, or null when the envelope is bad
 * (non-string, oversized, bad base64, not gzip, bad JSON, unknown version).
 * Sections are individually laundered through their tolerant parsers.
 */
export async function decodeBackup(str) {
  if (typeof str !== 'string' || str === '' || str.length > MAX_BLOB_CHARS) return null;
  let wire;
  try {
    const bytes = await pipeBytes(b64urlToBytes(str), new DecompressionStream('gzip'));
    wire = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (wire == null || typeof wire !== 'object' || wire.v !== WIRE_VERSION) return null;
  return {
    presets: parsePresetLibrary(JSON.stringify(wire.presets ?? null)),
    profiles: parseProfiles(JSON.stringify(wire.profiles ?? null)),
    streamers: parseStreamers(JSON.stringify(wire.streamers ?? null)),
  };
}
