/**
 * Profiles store: pure CRUD over the Configurator's identities —
 * `{ active, profiles: { [login]: { spotlight, defaultPresetId, trains } } }`.
 * A Profile is a bare Twitch login (lowercased key; RaidPal lookup is
 * case-insensitive) owning: a standing Spotlight list (names always
 * highlighted — self, friends, team members), a default Preset reference
 * (the base look, and the Live Link fallback for unmapped trains), its Live
 * Link preferences (the idle card's horizon), and its
 * Raid Train Configs keyed by Event slug —
 * `{ presetId, overrides, spotlight, endsAt }` where overrides is a per-field
 * sparse diff against the referenced Preset, spotlight is per-train ADDITIONS
 * (union with the standing list, never a restatement), and endsAt is when the
 * Event was last known to finish (epoch ms, or null when never observed).
 *
 * `endsAt` exists so the Live Link can stop encoding trains that have already
 * run (#31). It is the secondary of the two grounds — the primary is simply
 * being absent from a good read of the user endpoint — and covers the ~6h
 * window in which a departed train is still listed, so it drops out of the
 * URL the moment it ends rather than whenever the feed next turns over. A
 * record written before this field existed has no endsAt and is judged on
 * absence alone.
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
export function upsertTrainConfig(store, login, slug, { presetId = null, overrides = {}, spotlight = [], endsAt = null } = {}) {
  return withProfile(store, login, (p) => {
    const config = {
      presetId,
      overrides: pickSettings(overrides),
      spotlight: [...spotlight],
      endsAt: toEpochMs(endsAt),
    };
    // Auto-prune: a Config holding nothing is DELETED, not stored (#31).
    // Deliberately here rather than at the call sites, so every writer gets
    // it — `reset-overrides` most of all, which writes `{...config,
    // overrides: {}}` and is the exact case this exists for. Touching a
    // setting and putting it back must not leave a permanent record claiming
    // the train is configured, because that record keeps riding the Live
    // Link's blob carrying its Preset's whole diff against the base.
    if (isEmptyTrainConfig(config, p.defaultPresetId ?? null)) {
      const trains = { ...p.trains };
      delete trains[slug];
      return { ...p, trains };
    }
    return { ...p, trains: { ...p.trains, [slug]: config } };
  });
}

/** Date | epoch ms | ISO string → epoch ms, or null for anything unusable. */
function toEpochMs(value) {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : Number(new Date(value));
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Does this Config hold nothing the streamer chose? No overrides, no per-train
 * Spotlight additions, and no Preset of its own beyond the Profile's default.
 *
 * Such a record is pure bookkeeping: the editor synthesizes exactly the same
 * thing when it is absent, so deleting it loses nothing and is not data loss.
 * `endsAt` is not consulted — it is observed fact about the Event, never a
 * choice, so a record holding only an end time holds nothing.
 */
export function isEmptyTrainConfig(config, defaultPresetId = null) {
  if (config == null) return true;
  return Object.keys(config.overrides ?? {}).length === 0
    && (config.spotlight ?? []).length === 0
    && (config.presetId ?? null) === (defaultPresetId ?? null);
}

/**
 * Drop the Raid Train Configs a Profile can no longer reach (#41).
 *
 * #31 settled that the URL filters and the store does not, because a bad
 * RaidPal day makes every train look absent. That premise CHANGED with #39:
 * "healthy read" is now detectable, so absence can be trusted under conditions
 * #31 had no way to express. This is the deliberate overturn, not a regression
 * — see CONTEXT.md. Every guard below exists because removing one makes some
 * real day delete settings the streamer still needs:
 *
 *   - `verified`: a cache hit inside the 6h window is not evidence of anything.
 *   - `events` a non-empty ARRAY: `normalizeUser` merges `wire.events ?? []`,
 *     so a payload that arrives without the key is indistinguishable from a
 *     streamer with nothing booked. An empty list must never mean "all gone" —
 *     it costs a quiet streamer a delayed cleanup, which nobody can see.
 *   - a PAST `endsAt`: the guard against a rename. RaidPal has no stable event
 *     id, so renaming an upcoming train reads here exactly like deleting it,
 *     and that train's settings are about to be needed. A Config we cannot date
 *     (written before the field existed) is protected for the same reason.
 *
 * Absence alone never deletes: the slug must be gone AND the train must already
 * be over. Returns the store unchanged plus `removed: []` when nothing
 * qualifies, so callers can treat "nothing happened" as the common path.
 *
 * `removed` carries `{ slug, config }` — the config verbatim, so the caller can
 * offer an undo without this function knowing anything about undo.
 */
export function pruneOrphanedConfigs(store, login, { events = null, verified = false, now = null } = {}) {
  const at = now instanceof Date ? now.getTime() : now;
  const profile = store.profiles?.[normalizeLogin(login)];
  if (!profile || !verified || !Number.isFinite(at)) return { store, removed: [] };
  if (!Array.isArray(events) || events.length === 0) return { store, removed: [] };

  const listed = new Set(events.map((e) => e?.slug));
  const removed = [];
  for (const [slug, config] of Object.entries(profile.trains ?? {})) {
    if (listed.has(slug)) continue;
    const endsAt = config?.endsAt;
    if (typeof endsAt !== 'number' || !Number.isFinite(endsAt) || endsAt >= at) continue;
    removed.push({ slug, config });
  }
  if (removed.length === 0) return { store, removed: [] };

  const trains = { ...profile.trains };
  for (const { slug } of removed) delete trains[slug];
  return { store: withProfile(store, login, (p) => ({ ...p, trains })), removed };
}

/** Put back Configs a prune removed, verbatim — the undo behind #41's notice. */
export function restoreTrainConfigs(store, login, removed) {
  if (!Array.isArray(removed) || removed.length === 0) return store;
  return withProfile(store, login, (p) => {
    const trains = { ...p.trains };
    for (const { slug, config } of removed) {
      if (typeof slug === 'string' && slug !== '' && config != null) trains[slug] = config;
    }
    return { ...p, trains };
  });
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

/**
 * The Preset a Config actually renders through: its own reference, else the
 * Profile's default. resolveTrainSettings has always read it this way, so
 * anything that reasons about "which Configs use this Preset" must too — a
 * Config with a null reference is not unaffiliated, it is on the default.
 */
function effectivePresetId(profile, config) {
  return config.presetId ?? profile.defaultPresetId ?? null;
}

/**
 * How many Raid Train Configs and Profile defaults a Preset is reaching — the
 * delete-confirm numbers. Counts Configs that reach it THROUGH the Profile
 * default too, because those are exactly the ones a delete would change on
 * stream; counting only explicit references understated the blast radius.
 */
export function countPresetReferences(store, presetId) {
  let configs = 0;
  let defaults = 0;
  for (const profile of Object.values(store.profiles)) {
    if (profile.defaultPresetId === presetId) defaults += 1;
    for (const config of Object.values(profile.trains)) {
      if (effectivePresetId(profile, config) === presetId) configs += 1;
    }
  }
  return { configs, defaults };
}

/**
 * Delete-while-referenced, the store half: bake the Preset's settings into
 * every Config that RENDERS through it as full overrides (nothing changes
 * visually, nothing dangles) and clear matching Profile defaults. Run this
 * BEFORE deletePreset(library, id); the confirm dialog runs on
 * countPresetReferences.
 *
 * "Renders through it" includes Configs with a null reference sitting on the
 * Profile default — the same pass clears that default, so skipping them would
 * silently drop their look on stream, which is the one thing this function
 * exists to prevent.
 */
export function materializePreset(store, library, presetId) {
  const preset = getPreset(library, presetId);
  const profiles = {};
  for (const [login, profile] of Object.entries(store.profiles)) {
    const trains = {};
    for (const [slug, config] of Object.entries(profile.trains)) {
      trains[slug] = effectivePresetId(profile, config) === presetId
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
