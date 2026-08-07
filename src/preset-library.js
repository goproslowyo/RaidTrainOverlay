/**
 * Preset library (v2): pure CRUD over id-keyed, settings-only Presets —
 * `{ [id]: { name, settings } }`. The id is the stable identity Raid Train
 * Configs reference; the name is a freely-renameable display label, so a
 * rename never orphans a reference. Settings are the raw Configurator form
 * values, stripped to the settings-only field list by construction — no
 * Event, no lineup source, no Spotlight (that's a Profile trait).
 *
 * v2 lives under its OWN storage key; the v1 name-keyed store
 * (`raidtrainoverlay.configurator.presets`) is left untouched and ignored —
 * no migration, per the map decision. Same discipline as presets.js: pure
 * module, tolerant parse, never mutates, localStorage is a page adapter.
 */

/** The fields a v2 Preset carries — the Configurator's look/behavior knobs, nothing per-train. */
export const PRESET_SETTINGS_FIELDS = [
  'mode', 'interval', 'speed', 'track', 'trackfadein', 'trackfadeout', 'refresh',
  'openslots', 'hidefinished', 'enginedim', 'tz', 'theme', 'scale', 'height', 'lang',
];

/** Keep only settings-only fields — Presets can't smuggle per-train state. */
export function pickSettings(raw) {
  const settings = {};
  for (const field of PRESET_SETTINGS_FIELDS) {
    if (raw != null && Object.hasOwn(raw, field)) settings[field] = raw[field];
  }
  return settings;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const defaultGenId = () =>
  globalThis.crypto?.randomUUID?.() ?? `p-${Math.random().toString(36).slice(2, 10)}`;

/** JSON string → Preset library. Tolerant: anything bad falls back to an empty library. */
export function parsePresetLibrary(json) {
  if (json == null || json === '') return {};
  try {
    const parsed = JSON.parse(json);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Preset library → JSON string, for the page to persist. */
export function serializePresetLibrary(library) {
  return JSON.stringify(library);
}

/**
 * Add a Preset, returning `{ library, id }` — a NEW store plus the generated
 * id (the caller usually selects it right away). A blank name is a no-op
 * (`id: null`), mirroring upsertPreset's contract.
 */
export function createPreset(library, name, rawSettings, genId = defaultGenId) {
  const label = (name ?? '').trim();
  if (label === '') return { library: { ...library }, id: null };
  const id = genId();
  return { library: { ...library, [id]: { name: label, settings: pickSettings(rawSettings) } }, id };
}

/** Rename the display label only — the id (and every reference to it) is untouched. */
export function renamePreset(library, id, name) {
  const preset = library[id];
  const label = (name ?? '').trim();
  if (!preset || label === '') return { ...library };
  return { ...library, [id]: { ...preset, name: label } };
}

/** Replace a Preset's settings (stripped to settings-only). Unknown id is a no-op. */
export function updatePresetSettings(library, id, rawSettings) {
  const preset = library[id];
  if (!preset) return { ...library };
  return { ...library, [id]: { ...preset, settings: pickSettings(rawSettings) } };
}

/**
 * Copy a Preset under a fresh id and a "<name> (copy)" label — the quick
 * dupe+rename path for cross-Profile tweaks. Returns `{ library, id }`;
 * unknown source id is a no-op (`id: null`).
 */
export function duplicatePreset(library, id, genId = defaultGenId) {
  const preset = library[id];
  if (!preset) return { library: { ...library }, id: null };
  return createPreset(library, `${preset.name} (copy)`, preset.settings, genId);
}

/** Remove a Preset. Unknown id is a silent no-op. The caller handles references (see profiles.js materializePreset). */
export function deletePreset(library, id) {
  const next = { ...library };
  delete next[id];
  return next;
}

/** A Preset by id, or null. */
export function getPreset(library, id) {
  return library[id] ?? null;
}

/** All Presets as `{ id, name, settings }`, case-insensitively sorted by name for stable UI ordering. */
export function listPresets(library) {
  return Object.entries(library)
    .map(([id, { name, settings }]) => ({ id, name, settings }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
}
