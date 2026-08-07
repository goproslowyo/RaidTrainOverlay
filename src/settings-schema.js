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
 *
 * i18n: this module names its strings by CATALOG KEY (`labelKey`, `hintKey`,
 * `optionKeys`, …) and never holds English. That keeps it pure — no translator
 * is threaded through it, so it stays importable from a test or a build script
 * with no i18n runtime — and puts the English in the one place that already
 * owns it, `src/i18n/locales/en.js`. The renderer (settings-form.js) is the
 * only thing that needs a `t`, because rendering is when a locale exists.
 */

import { PRESET_SETTINGS_FIELDS } from './preset-library.js';

/** Theme key → catalog key for its label. Keys mirror the config schema's Theme enum. */
export const THEME_OPTION_KEYS = {
  classic: 'configurator.theme.classic',
  flat: 'configurator.theme.flat',
  synthwave: 'configurator.theme.synthwave',
  ticket: 'configurator.theme.ticket',
  wood: 'configurator.theme.wood',
  comic: 'configurator.theme.comic',
  departures: 'configurator.theme.departures',
  paper: 'configurator.theme.paper',
  tron: 'configurator.theme.tron',
  pixel: 'configurator.theme.pixel',
  highvibes: 'configurator.theme.highvibes',
  jazz: 'configurator.theme.jazz',
  bullet: 'configurator.theme.bullet',
  lava: 'configurator.theme.lava',
  pride: 'configurator.theme.pride',
  shuffle: 'configurator.theme.shuffle',
};

/**
 * Overlay-language selector values ('' = Auto, follow the browser).
 *
 * Deliberately NOT catalog keys: every entry but Auto is an ENDONYM — a
 * language's name in its own language — which reads the same whatever locale
 * the page is in. That is the point of a language picker (a German speaker
 * hunting for Portuguese looks for "Português", not "Portugiesisch"), so these
 * are literals and only Auto carries a key.
 */
export const LANG_AUTO_KEY = 'configurator.languageAuto';
export const LANG_ENDONYMS = {
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
  { id: 'look', labelKey: 'configurator.tabLook' },
  { id: 'motion', labelKey: 'configurator.tabMotion' },
  { id: 'behavior', labelKey: 'configurator.tabBehavior' },
];

/**
 * Every settings field, in display order within its group. `default` is the
 * raw form value that matches the Overlay's own default, so a Preset built
 * from these defaults serializes to an empty query.
 */
export const SETTING_FIELDS = [
  {
    key: 'theme', group: 'look', labelKey: 'configurator.themeLabel', type: 'select',
    optionKeys: THEME_OPTION_KEYS, default: 'classic', hintKey: 'configurator.themeHint',
  },
  {
    key: 'scale', group: 'look', labelKey: 'configurator.scaleLabel', type: 'range',
    min: 0.5, max: 2, step: 0.1, default: '1', hintKey: 'configurator.scaleHint',
  },
  {
    key: 'height', group: 'look', labelKey: 'configurator.heightLabel', type: 'range',
    min: 0, max: 100, step: 1, default: '100', hintKey: 'configurator.heightHint',
  },
  {
    key: 'enginedim', group: 'look', labelKey: 'configurator.enginedimLabel', type: 'select', default: 'over',
    optionKeys: {
      over: 'configurator.enginedimOver',
      finished: 'configurator.enginedimFinished',
      never: 'configurator.enginedimNever',
    },
    hintKey: 'configurator.enginedimHint',
  },
  {
    key: 'mode', group: 'motion', labelKey: 'configurator.modeLabel', type: 'select', default: 'pass',
    optionKeys: { pass: 'configurator.modePass', marquee: 'configurator.modeMarquee' },
  },
  {
    key: 'interval', group: 'motion', labelKey: 'configurator.intervalLabel', type: 'number',
    min: 1, step: 1, default: '15',
  },
  {
    key: 'speed', group: 'motion', labelKey: 'configurator.speedLabel', type: 'number',
    min: 0.1, step: 0.1, default: '1', hintKey: 'configurator.speedHint',
  },
  {
    key: 'track', group: 'motion', labelKey: 'configurator.trackLabel', type: 'select', default: 'periodic',
    optionKeys: { periodic: 'configurator.trackPeriodic', always: 'configurator.trackAlways' },
    hintKey: 'configurator.trackHint',
  },
  // New keys, not the old trackFadeIn/OutLabel: those read "In" / "Out" because
  // they sub-labelled one paired "Track fade timing" control. As the label of a
  // standalone field they would say nothing, so their translations can't be reused.
  {
    key: 'trackfadein', group: 'motion', labelKey: 'configurator.trackFadeInField', type: 'number',
    min: 0, max: 120, step: 1, default: '15', hintKey: 'configurator.trackFadeHint',
  },
  {
    key: 'trackfadeout', group: 'motion', labelKey: 'configurator.trackFadeOutField', type: 'number',
    min: 0, max: 120, step: 1, default: '10',
  },
  {
    key: 'refresh', group: 'behavior', labelKey: 'configurator.refreshLabel', type: 'number',
    min: 15, step: 5, default: '', placeholderKey: 'configurator.refreshPlaceholder',
    hintKey: 'configurator.refreshHint',
  },
  {
    key: 'openslots', group: 'behavior', labelKey: 'configurator.openslotsField', type: 'check', default: false,
    checkTextKey: 'configurator.openslotsCheck',
  },
  {
    key: 'hidefinished', group: 'behavior', labelKey: 'configurator.hidefinishedField', type: 'check', default: false,
    checkTextKey: 'configurator.hidefinishedCheck',
  },
  {
    key: 'tz', group: 'behavior', labelKey: 'configurator.tzLabel', type: 'text', default: '',
    placeholderKey: 'configurator.tzPlaceholder', hintKey: 'configurator.tzHint',
  },
  {
    key: 'lang', group: 'behavior', labelKey: 'configurator.languageLabel', type: 'select', default: '',
    // Built at render: Auto needs a translation, the endonyms never do.
    optionKeys: { '': LANG_AUTO_KEY },
    literalOptions: LANG_ENDONYMS,
    hintKey: 'configurator.languageHint',
  },
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
 * Returns `{ [key]: { disabled, noteKey? } }` for the gated keys only — a
 * catalog key, not a sentence, so this stays pure (see the module header).
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
      noteKey: isPass && isShuffle ? 'configurator.intervalNotePassShuffle'
        : isPass ? 'configurator.intervalNotePass'
          : isShuffle ? 'configurator.intervalNoteShuffle'
            : 'configurator.intervalNoteOff',
    },
    // The same "Pass-only" note reads true for the track toggle as for interval.
    track: { disabled: !isPass, noteKey: isPass ? null : 'configurator.intervalNoteOff' },
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
