/**
 * Configurator pure logic: extract an event slug from user input (a bare slug
 * or a pasted RaidPal URL), and synthesize a canonical Overlay query string
 * from raw form state. No DOM, no storage — the page wires these to inputs.
 */
import { parseConfig, serializeConfig } from './config.js';

/** A RaidPal slug: lowercase/digit start, then lowercase/digit/hyphen. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/i;

/**
 * User input → event slug, or null. A pasted RaidPal URL is handled by
 * anchoring on the last `event/` marker (covers `/event/<slug>`,
 * `/<locale>/event/<slug>`, www/no-www, with/without protocol, the API URL
 * form, trailing slashes, `?query`, and `#fragment`); the captured segment is
 * then validated against the slug grammar. Without the marker the whole input
 * is treated as a bare slug. The slug is returned verbatim (RaidPal slugs are
 * lowercase; a bad one surfaces as an API 404 — fail visibly at fetch).
 */
export function extractSlug(input) {
  const trimmed = (input ?? '').trim();
  if (trimmed === '') return null;
  const markerIdx = trimmed.toLowerCase().lastIndexOf('event/');
  const candidate = markerIdx === -1
    ? trimmed
    : trimmed.slice(markerIdx + 'event/'.length).split(/[/?#]/)[0];
  return SLUG.test(candidate) ? candidate : null;
}

/**
 * Raw form state → canonical Overlay query string (no leading `?`). Builds a
 * draft query from the raw fields, then round-trips it through the config
 * schema (`serializeConfig(parseConfig(draft))`) so the Configurator reuses the
 * Overlay's exact validation, normalization, and omit-defaults rules — no
 * schema drift, and the output is the tested-idempotent serialize∘parse, which
 * is what makes a copied URL reproduce the form state. `event` is run through
 * extractSlug so a pasted RaidPal URL still produces a clean slug.
 */
export function buildOverlayQuery(formState = {}) {
  const params = new URLSearchParams();
  const slug = extractSlug(formState.event);
  if (slug) params.set('event', slug);
  if (formState.lang) params.set('lang', String(formState.lang));
  if (formState.mode) params.set('mode', formState.mode);
  if (formState.openslots) params.set('openslots', '1');
  if (formState.hidefinished) params.set('hidefinished', '1');
  if (formState.enginedim) params.set('enginedim', String(formState.enginedim));
  if (formState.theme) params.set('theme', String(formState.theme));
  if (formState.spotlight) params.set('spotlight', String(formState.spotlight));
  if (formState.tz) params.set('tz', String(formState.tz));
  for (const key of ['interval', 'speed', 'scale', 'height', 'refresh']) {
    const value = formState[key];
    if (value != null && String(value).trim() !== '') params.set(key, String(value));
  }
  // The round-trip drops defaults and garbage; parseConfig/serializeConfig fix
  // the param order, so the draft insertion order above doesn't matter.
  return serializeConfig(parseConfig(params.toString()));
}
