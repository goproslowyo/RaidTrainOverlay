/**
 * Profiles store: pure CRUD over the Configurator's identities —
 * `{ active, profiles: { [login]: { spotlight, defaultPresetId, trains } } }`.
 * A Profile is a bare Twitch login (lowercased key; RaidPal lookup is
 * case-insensitive) owning: a standing Spotlight list (names always
 * highlighted — self, friends, team members), a default Preset reference
 * (the base look, and the Live Link fallback for unmapped trains), its Live
 * Link preferences (the idle card's horizon), and its
 * Raid Train Configs keyed by Event slug — `{ presetId, overrides, spotlight }`
 * where overrides is a per-field sparse diff against the referenced Preset
 * and spotlight is per-train ADDITIONS (union with the standing list, never
 * a restatement).
 *
 * Same discipline as presets.js: pure module, tolerant parse, never mutates;
 * the page owns localStorage. Preset CONTENT lives in preset-library.js —
 * this module only holds references, plus the two cross-store operations
 * (resolveTrainSettings, materializePreset) that join them.
 */

import { getPreset, pickSettings } from './preset-library.js';

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const EMPTY_STORE = () => ({ active: null, profiles: {} });

/** JSON string → Profiles store. Tolerant: anything bad falls back to an empty store. */
export function parseProfiles(json) {
  if (json == null || json === '') return EMPTY_STORE();
  try {
    const parsed = JSON.parse(json);
    if (!isPlainObject(parsed) || !isPlainObject(parsed.profiles)) return EMPTY_STORE();
    return { active: parsed.active ?? null, profiles: parsed.profiles };
  } catch {
    return EMPTY_STORE();
  }
}

/** Profiles store → JSON string, for the page to persist. */
export function serializeProfiles(store) {
  return JSON.stringify(store);
}

const normalizeLogin = (login) => (login ?? '').trim().toLowerCase();

function withProfile(store, login, update) {
  const key = normalizeLogin(login);
  const profile = store.profiles[key];
  if (!profile) return store;
  return { ...store, profiles: { ...store.profiles, [key]: update(profile) } };
}

/**
 * Add a Profile (login lowercased). The FIRST Profile added becomes active —
 * a fresh Configurator is usable without a separate "switch" step. Blank or
 * already-present logins are silent no-ops.
 */
export function addProfile(store, login) {
  const key = normalizeLogin(login);
  if (key === '' || store.profiles[key]) return { ...store };
  return {
    active: store.active ?? key,
    profiles: {
      ...store.profiles,
      [key]: { spotlight: [], defaultPresetId: null, trains: {}, liveLink: { upcoming: null } },
    },
  };
}

/** Remove a Profile; if it was active, the first remaining Profile (or null) takes over. */
export function removeProfile(store, login) {
  const key = normalizeLogin(login);
  const profiles = { ...store.profiles };
  delete profiles[key];
  const active = store.active === key ? (listProfiles({ profiles }).at(0) ?? null) : store.active;
  return { active, profiles };
}

/** Switch the acting Profile. Unknown login is a silent no-op. */
export function setActiveProfile(store, login) {
  const key = normalizeLogin(login);
  if (!store.profiles[key]) return { ...store };
  return { ...store, active: key };
}

/** All Profile logins, sorted for stable UI ordering. */
export function listProfiles(store) {
  return Object.keys(store.profiles).sort();
}

/** The acting Profile's login, or null when none exist. */
export function activeProfile(store) {
  return store.active ?? null;
}

/**
 * The Profile's Live Link preferences — currently just the idle card's
 * `upcoming` horizon (`'3'`, `'2w'`, `'1m'`, `'all'`, or null for "no card").
 * It lives on the Profile, not in the URL alone, so the Live Link panel
 * regenerates the SAME URL on every visit; a Profile written before this field
 * existed reads as "no card".
 */
export function liveLinkPrefs(store, login) {
  return { upcoming: null, ...(store.profiles[normalizeLogin(login)]?.liveLink ?? {}) };
}

/** Set the Profile's Live Link preferences (merged over what's there). */
export function setLiveLinkPrefs(store, login, prefs) {
  return withProfile(store, login, (p) => ({ ...p, liveLink: { ...(p.liveLink ?? {}), ...prefs } }));
}

/** Set (or clear, with null) a Profile's default Preset reference. */
export function setDefaultPreset(store, login, presetId) {
  return withProfile(store, login, (p) => ({ ...p, defaultPresetId: presetId ?? null }));
}

/** Add a name to the Profile's standing Spotlight list (case-insensitive dedupe, original casing kept). */
export function addSpotlight(store, login, name) {
  const trimmed = (name ?? '').trim();
  if (trimmed === '') return { ...store };
  return withProfile(store, login, (p) => {
    if (p.spotlight.some((n) => n.toLowerCase() === trimmed.toLowerCase())) return p;
    return { ...p, spotlight: [...p.spotlight, trimmed] };
  });
}

/** Remove a name from the standing Spotlight list (case-insensitive). */
export function removeSpotlight(store, login, name) {
  const needle = (name ?? '').trim().toLowerCase();
  return withProfile(store, login, (p) => ({
    ...p,
    spotlight: p.spotlight.filter((n) => n.toLowerCase() !== needle),
  }));
}

/**
 * Save a Raid Train Config for an Event slug: `{ presetId, overrides, spotlight }`.
 * Overrides are stripped to settings-only fields (a Config can't smuggle
 * per-train state the URL grammar doesn't know); spotlight is the per-train
 * ADDITIONS list.
 */
export function upsertTrainConfig(store, login, slug, { presetId = null, overrides = {}, spotlight = [] } = {}) {
  return withProfile(store, login, (p) => ({
    ...p,
    trains: { ...p.trains, [slug]: { presetId, overrides: pickSettings(overrides), spotlight: [...spotlight] } },
  }));
}

/** Remove the Config for a slug. Missing slug is a silent no-op. */
export function deleteTrainConfig(store, login, slug) {
  return withProfile(store, login, (p) => {
    const trains = { ...p.trains };
    delete trains[slug];
    return { ...p, trains };
  });
}

/** A Profile's Raid Train Config for a slug, or null. */
export function getTrainConfig(store, login, slug) {
  return store.profiles[normalizeLogin(login)]?.trains[slug] ?? null;
}

/**
 * The effective settings for a train: referenced Preset (the Config's, else
 * the Profile default) ⊕ sparse overrides; Spotlight = standing list ∪
 * per-train additions. Fails soft everywhere — unknown Profile, missing
 * Config, or a dangling Preset id all degrade toward `{}` (the Overlay's
 * built-in defaults), never a throw.
 */
export function resolveTrainSettings(library, store, login, slug) {
  const profile = store.profiles[normalizeLogin(login)];
  if (!profile) return { settings: {}, spotlight: [] };
  const config = profile.trains[slug] ?? null;
  const preset = getPreset(library, config?.presetId ?? profile.defaultPresetId);
  return {
    settings: { ...(preset?.settings ?? {}), ...(config?.overrides ?? {}) },
    spotlight: [...profile.spotlight, ...(config?.spotlight ?? []).filter(
      (n) => !profile.spotlight.some((s) => s.toLowerCase() === n.toLowerCase()),
    )],
  };
}

/** How many Raid Train Configs and Profile defaults reference a Preset — the delete-confirm numbers. */
export function countPresetReferences(store, presetId) {
  let configs = 0;
  let defaults = 0;
  for (const profile of Object.values(store.profiles)) {
    if (profile.defaultPresetId === presetId) defaults += 1;
    for (const config of Object.values(profile.trains)) {
      if (config.presetId === presetId) configs += 1;
    }
  }
  return { configs, defaults };
}

/**
 * Delete-while-referenced, the store half: bake the Preset's settings into
 * every referencing Config as full overrides (nothing changes visually,
 * nothing dangles) and clear matching Profile defaults. Run this BEFORE
 * deletePreset(library, id); the confirm dialog runs on countPresetReferences.
 */
export function materializePreset(store, library, presetId) {
  const preset = getPreset(library, presetId);
  const profiles = {};
  for (const [login, profile] of Object.entries(store.profiles)) {
    const trains = {};
    for (const [slug, config] of Object.entries(profile.trains)) {
      trains[slug] = config.presetId === presetId
        ? { ...config, presetId: null, overrides: { ...(preset?.settings ?? {}), ...config.overrides } }
        : config;
    }
    profiles[login] = {
      ...profile,
      trains,
      defaultPresetId: profile.defaultPresetId === presetId ? null : profile.defaultPresetId,
    };
  }
  return { ...store, profiles };
}
