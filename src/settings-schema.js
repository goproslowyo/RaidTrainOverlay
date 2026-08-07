/**
 * settings-schema: the ONE description of the Configurator's 15 settings
 * fields — key, group, control type, options, and default — plus the pure
 * operations both editors need (sparse diff, apply, raw-query projection,
 * field gating).
 *
 * Two editors render from this: the Raid Train Config editor (a Preset
 * reference + a sparse per-field override diff, with badges) and the Preset
 * editor (plain values). One schema, so a new field appears in both at once
 * and can never drift between them.
 *
 * Values are RAW form values — strings for everything except the two
 * checkboxes — exactly what preset-library stores and what buildOverlayQuery
 * consumes. Validation is NOT duplicated here: raw values re-enter
 * parseConfig, which stays the single source of truth for the param schema.
 */

import { PRESET_SETTINGS_FIELDS } from './preset-library.js';

/** Theme key → English label. Keys mirror the config schema's Theme enum. */
export const THEME_OPTIONS = {
  classic: 'Classic Americana',
  flat: 'Flat cartoon',
  synthwave: 'Synthwave',
  ticket: 'Vintage ticket',
  wood: 'Wooden toy train',
  comic: 'Comic / halftone',
  departures: 'Departures board',
  paper: 'Paper cutout',
  tron: 'Tron lightcycle',
  pixel: '16-bit pixel',
  highvibes: 'High Vibes',
  jazz: 'Jazz vinyl',
  bullet: 'Anime bullet train',
  lava: 'Lava lamp',
  pride: 'Pride',
  shuffle: '🔀 Shuffle — cycle every theme',
};

/** Overlay-language selector values ('' = Auto, follow the browser). */
export const LANG_OPTIONS = {
  '': 'Auto (browser)',
  'en': 'English',
  'es-ES': 'Español (España)',
  'es-MX': 'Español (México)',
  'pt-BR': 'Português (Brasil)',
  'fr': 'Français',
  'it': 'Italiano',
  'de': 'Deutsch',
  'nl': 'Nederlands',
  'da': 'Dansk',
  'lt': 'Lietuvių',
};

/** The collapsible groups the fields render under, in display order. */
export const SETTING_GROUPS = [
  { id: 'look', label: 'Look' },
  { id: 'motion', label: 'Motion' },
  { id: 'behavior', label: 'Behavior' },
];

/**
 * Every settings field, in display order within its group. `default` is the
 * raw form value that matches the Overlay's own default, so a Preset built
 * from these defaults serializes to an empty query.
 */
export const SETTING_FIELDS = [
  {
    key: 'theme', group: 'look', label: 'Theme', type: 'select', options: THEME_OPTIONS, default: 'classic',
    hint: 'The art style that paints your train. Shuffle rotates the whole roster — a fresh theme each pass.',
  },
  {
    key: 'scale', group: 'look', label: 'Train size', type: 'range', min: 0.5, max: 2, step: 0.1, default: '1',
    hint: 'How big the train is in your broadcast. 1 is the default; the train always stays fully on screen.',
  },
  {
    key: 'height', group: 'look', label: 'Vertical position', type: 'range', min: 0, max: 100, step: 1, default: '100',
    hint: '0 = top, 100 = bottom, 50 = centered. The default sits it on the bottom edge.',
  },
  {
    key: 'enginedim', group: 'look', label: 'When the event ends', type: 'select', default: 'over',
    options: {
      over: 'Dim the engine',
      finished: 'Hide it (when hiding finished cars)',
      never: 'Keep the engine bright',
    },
  },
  {
    key: 'mode', group: 'motion', label: 'Display style', type: 'select', default: 'pass',
    options: {
      pass: 'Pass — rolls across every few minutes, then leaves',
      marquee: 'Marquee — scrolls continuously, always on screen',
    },
  },
  { key: 'interval', group: 'motion', label: 'Minutes between passes', type: 'number', min: 1, step: 1, default: '15' },
  {
    key: 'speed', group: 'motion', label: 'Animation speed', type: 'number', min: 0.1, step: 0.1, default: '1',
    hint: 'Higher is faster. 1 is the default pace.',
  },
  {
    key: 'track', group: 'motion', label: 'Track between passes', type: 'select', default: 'periodic',
    options: { periodic: 'Fade it out between passes', always: 'Always show the track' },
  },
  { key: 'trackfadein', group: 'motion', label: 'Track fade in (seconds)', type: 'number', min: 0, max: 120, step: 1, default: '15' },
  { key: 'trackfadeout', group: 'motion', label: 'Track fade out (seconds)', type: 'number', min: 0, max: 120, step: 1, default: '10' },
  {
    key: 'refresh', group: 'behavior', label: 'Auto-refresh (minutes)', type: 'number', min: 15, step: 5, default: '', placeholder: 'off',
    hint: 'How often to re-check RaidPal for lineup changes. Blank = check once on load.',
  },
  {
    key: 'openslots', group: 'behavior', label: 'Open slots', type: 'check', default: false,
    checkText: 'Show open slots as OPEN cars so viewers can sign up',
  },
  {
    key: 'hidefinished', group: 'behavior', label: 'Finished cars', type: 'check', default: false,
    checkText: 'Hide cars that have already played, instead of dimming them',
  },
  {
    key: 'tz', group: 'behavior', label: 'Clock time zones', type: 'text', default: '', placeholder: 'PT, ET, GMT',
    hint: 'Up to 3 zones to show absolute times instead of "in 2h". Blank = relative times.',
  },
  { key: 'lang', group: 'behavior', label: 'Overlay language', type: 'select', options: LANG_OPTIONS, default: '' },
];

/** Field key → its definition. */
export const FIELD_BY_KEY = Object.fromEntries(SETTING_FIELDS.map((def) => [def.key, def]));

/** The baseline every Preset starts from: the Overlay's own defaults as raw form values. */
export const SETTINGS_DEFAULTS = Object.fromEntries(SETTING_FIELDS.map((def) => [def.key, def.default]));

/** Settings-only field keys, in schema order (the same set preset-library stores). */
export const SETTING_KEYS = SETTING_FIELDS.map((def) => def.key);

/**
 * Any partial settings object → a complete one: defaults filled in, unknown
 * keys dropped, checkbox fields coerced to real booleans (a blob or a hand-
 * edited backup can carry `"true"`, and `Boolean('false')` is a trap).
 */
export function normalizeSettings(raw) {
  const out = {};
  for (const def of SETTING_FIELDS) {
    const value = raw == null ? undefined : raw[def.key];
    if (value === undefined) {
      out[def.key] = def.default;
    } else if (def.type === 'check') {
      out[def.key] = value === true || value === 'true' || value === '1';
    } else {
      out[def.key] = String(value);
    }
  }
  return out;
}

/** Do two raw values mean the same setting? Checkboxes compare as booleans, the rest as strings. */
function sameValue(def, a, b) {
  return def.type === 'check' ? Boolean(a) === Boolean(b) : String(a ?? '') === String(b ?? '');
}

/**
 * A sparse override diff of `values` against `base` — only the fields that
 * actually differ. Presence is the whole signal: `{ openslots: false }` means
 * "overridden to off" and an absent key means "inherit", which is why this
 * can't be a truthiness test.
 */
export function diffSettings(base, values) {
  const from = normalizeSettings(base);
  const to = normalizeSettings(values);
  const diff = {};
  for (const def of SETTING_FIELDS) {
    if (!sameValue(def, from[def.key], to[def.key])) diff[def.key] = to[def.key];
  }
  return diff;
}

/** Base settings ⊕ a sparse override diff → the effective settings. */
export function applySettings(base, overrides) {
  return normalizeSettings({ ...normalizeSettings(base), ...(overrides ?? {}) });
}

/** How many fields in a group the diff overrides — the per-group "N overridden" tag. */
export function groupOverrideCount(groupId, overrides) {
  return SETTING_FIELDS.filter((def) => def.group === groupId && Object.hasOwn(overrides ?? {}, def.key)).length;
}

/**
 * Settings → raw query-param values, the form `trains=` overrides and
 * buildOverlayQuery both take. Checkboxes become `1`/`0` so an override to OFF
 * is expressible in a URL (an absent param would read as "inherit the base").
 */
export function toQueryValues(settings) {
  const normalized = normalizeSettings(settings);
  const out = {};
  for (const def of SETTING_FIELDS) {
    out[def.key] = def.type === 'check' ? (normalized[def.key] ? '1' : '0') : normalized[def.key];
  }
  return out;
}

/**
 * Which fields the current values make inert, and why — the same gating the
 * Configurator has always applied, now shared by both editors:
 *   - interval drives Pass cadence, and doubles as Shuffle's theme cadence
 *   - periodic Track visibility is Pass-only (marquee has no off-screen gap)
 *   - the fade durations only bite while the track actually fades
 * Returns `{ [key]: { disabled, note? } }` for the gated keys only.
 */
export function fieldGating(settings) {
  const values = normalizeSettings(settings);
  const isPass = values.mode === 'pass';
  const isShuffle = values.theme === 'shuffle';
  const intervalOn = isPass || isShuffle;
  const fadeOn = isPass && values.track === 'periodic';
  return {
    interval: {
      disabled: !intervalOn,
      note: isPass && isShuffle ? 'How often the train rolls across — and how often Shuffle picks a new theme.'
        : isPass ? 'How often the train rolls across.'
          : isShuffle ? 'How often Shuffle picks a new theme.'
            : 'Not used with this display style.',
    },
    track: { disabled: !isPass, note: isPass ? null : 'Not used with this display style.' },
    trackfadein: { disabled: !fadeOn },
    trackfadeout: { disabled: !fadeOn },
  };
}

/**
 * The schema and the store must describe the same 15 fields; a field added to
 * one and not the other would silently vanish from Presets or from the
 * editors. Exported (not asserted at import time) so the test owns the failure.
 */
export function schemaMatchesStore() {
  return [...SETTING_KEYS].sort().join(',') === [...PRESET_SETTINGS_FIELDS].sort().join(',');
}
