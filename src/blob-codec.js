/**
 * blob-codec: the shared URL wire discipline for params that carry a JSON
 * payload as base64url (`lineup=`, `trains=`). Encode stamps nothing — each
 * caller owns its wire version and shape validation; this module owns only
 * the transport: UTF-8 → base64url and the defensive inverse (never throws,
 * null on bad base64/JSON or an oversized blob). No DOM; btoa/atob +
 * TextEncoder/TextDecoder are globals in browsers and node:test alike.
 */

// An ENCODED blob (the base64url string) over this many chars is rejected — a
// runaway payload that would approach browser/OBS URL limits. base64 is ~33%
// larger than the JSON it carries, so this conservatively bounds the model
// below ~6 KB.
export const MAX_BLOB_CHARS = 8192;

function bytesToB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded); // throws on invalid base64 — caught by decodeJsonBlob
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** JSON-serializable value → URL-safe base64url string. */
export function encodeJsonBlob(value) {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(value)));
}

/**
 * base64url string → parsed JSON value, or null on ANY failure (non-string,
 * empty, oversized, bad base64, bad JSON). Never throws — a corrupt blob must
 * render nothing, never broken UI.
 */
export function decodeJsonBlob(str, maxChars = MAX_BLOB_CHARS) {
  if (typeof str !== 'string' || str === '' || str.length > maxChars) return null;
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(str)));
  } catch {
    return null;
  }
}
