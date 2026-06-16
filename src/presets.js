/**
 * Preset store: pure CRUD over a Presets object (name → raw Configurator form
 * state). The Configurator persists Presets in its OWN localStorage; the
 * Overlay never reads them — the URL is the single source of truth.
 * This module is pure: localStorage is a page-level adapter that passes the
 * stored JSON string in and out. A Preset's value is the raw form-field state
 * (strings/booleans, original casing) so loading restores the form exactly.
 */

/** A plain (non-null, non-array) object — the shape a Presets store must have. */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * JSON string → Presets store. Tolerant by design (mirrors parseConfig's
 * contract): absent/blank/corrupt JSON, or valid JSON that isn't a plain
 * object, all fall back to an empty store — a bricked localStorage entry must
 * never break the Configurator. Never throws.
 */
export function parsePresets(json) {
  if (json == null || json === '') return {};
  try {
    const parsed = JSON.parse(json);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Presets store → JSON string, for the page to persist to localStorage. */
export function serializePresets(store) {
  return JSON.stringify(store);
}

/**
 * Save `formState` under `name` (insert or overwrite), returning a NEW store —
 * never mutates the input. A blank or whitespace-only name is a silent no-op
 * (the page disables Save on a blank name); the name is trimmed before use.
 */
export function upsertPreset(store, name, formState) {
  const key = (name ?? '').trim();
  if (key === '') return { ...store };
  return { ...store, [key]: formState };
}

/**
 * Remove the Preset named `name`, returning a NEW store — never mutates the
 * input. A missing name is a silent no-op (returns a copy).
 */
export function deletePreset(store, name) {
  const next = { ...store };
  delete next[name];
  return next;
}

/**
 * Saved Preset names, case-insensitively sorted for stable UI ordering
 * (deterministic across serialize/parse round-trips, unlike insertion order).
 */
export function listPresetNames(store) {
  return Object.keys(store).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
