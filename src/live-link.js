/**
 * live-link: the pure half of the Live Link — the `trains=` wire codec, the
 * live/next resolution rule, and the per-train effective-query merge. No
 * fetching, no timers (that's live-link-feed); no DOM. The URL is the save
 * file: everything here derives from the query string and the user's Event
 * summaries.
 *
 * Wire model for `trains=` (versioned, like `lineup=`):
 *   { v: 1, t: { [slug]: { o?: { param: rawValue }, sp?: [names] } } }
 * `o` is a per-field sparse diff of RAW query-param values (they re-enter
 * parseConfig, so validation stays in one place); `sp` is per-train Spotlight
 * ADDITIONS (union with the base spotlight, per the Preset v2 decision).
 */

import { encodeJsonBlob, decodeJsonBlob } from './blob-codec.js';

const WIRE_VERSION = 1;

/** The full Train renders this far ahead of departure (fixed, v1). */
export const LEAD_MS = 60 * 60_000;

/** Mapping `{ [slug]: { overrides, spotlight } }` → URL-safe blob. Empty entries stay compact. */
export function encodeTrainMap(map) {
  const t = {};
  for (const [slug, entry] of Object.entries(map)) {
    const wire = {};
    if (entry.overrides && Object.keys(entry.overrides).length > 0) wire.o = entry.overrides;
    if (entry.spotlight && entry.spotlight.length > 0) wire.sp = entry.spotlight;
    t[slug] = wire;
  }
  return encodeJsonBlob({ v: WIRE_VERSION, t });
}

/**
 * URL blob → normalized mapping `{ [slug]: { overrides, spotlight } }`, or
 * null on any bad, oversized, or unknown-version input. Entry contents are
 * sanitized field-by-field (string values only) — a tampered blob degrades to
 * fewer overrides, never to a throw or a smuggled object.
 */
export function decodeTrainMap(str) {
  const wire = decodeJsonBlob(str);
  if (wire == null || typeof wire !== 'object' || wire.v !== WIRE_VERSION) return null;
  if (wire.t == null || typeof wire.t !== 'object' || Array.isArray(wire.t)) return null;
  const map = {};
  for (const [slug, entry] of Object.entries(wire.t)) {
    if (entry == null || typeof entry !== 'object') continue;
    const overrides = {};
    if (entry.o != null && typeof entry.o === 'object' && !Array.isArray(entry.o)) {
      for (const [key, value] of Object.entries(entry.o)) {
        if (typeof value === 'string') overrides[key] = value;
      }
    }
    const spotlight = Array.isArray(entry.sp) ? entry.sp.filter((n) => typeof n === 'string') : [];
    map[slug] = { overrides, spotlight };
  }
  return map;
}

/**
 * Which train the Live Link shows now. `events` are normalized Event
 * summaries (raidpal-client's normalizeUser output — Date times, ascending
 * or not; sorted here).
 *
 *   live — now ∈ [starttime, endtime] (earliest-started wins an overlap)
 *   lead — the next upcoming train departs within `leadMs` (full render early,
 *          so viewers see the lineup as departure approaches)
 *   idle — nothing to render; `upcoming` carries the future trains for the
 *          opt-in card (#15)
 *
 * Returns `{ state, train, upcoming }`.
 */
export function resolveLiveTrain(events, now, leadMs = LEAD_MS) {
  const byStart = [...events].sort((a, b) => a.starttime - b.starttime);
  const upcoming = byStart.filter((e) => e.starttime > now);
  const live = byStart.find((e) => e.starttime <= now && now <= e.endtime);
  if (live) return { state: 'live', train: live, upcoming };
  const next = upcoming[0] ?? null;
  if (next && next.starttime - now <= leadMs) return { state: 'lead', train: next, upcoming };
  return { state: 'idle', train: null, upcoming };
}

/** Idle for this long since page load → the Overlay reloads itself (JS-leak insurance). */
export const IDLE_RELOAD_MS = 60 * 60_000;

const WEEK_MS = 7 * 24 * 60 * 60_000;
const MONTH_MS = 30 * 24 * 60 * 60_000; // a card horizon, not a calendar — 30d is plenty

/**
 * The trains the idle card lists, per the `upcoming=` spec (config.upcoming):
 * null = card off (empty), `count` = next n, `weeks`/`months` = departing
 * within the window, `all` = everything upcoming.
 */
export function filterUpcoming(upcoming, spec, now) {
  if (!spec) return [];
  if (spec.kind === 'all') return [...upcoming];
  if (spec.kind === 'count') return upcoming.slice(0, spec.n);
  const horizon = now.getTime() + spec.n * (spec.kind === 'weeks' ? WEEK_MS : MONTH_MS);
  return upcoming.filter((e) => e.starttime.getTime() <= horizon);
}

/**
 * Reload only from the idle state (the caller's context — never mid-render,
 * never inside the T-60 lead) once the page is over an hour old.
 */
export function shouldSelfReload({ loadedAt, now }) {
  return now - loadedAt > IDLE_RELOAD_MS;
}

/** The idle card never grows past this many rows — it must not creep up a stream. */
export const CARD_MAX_ROWS = 3;

/** How many CARD_MAX_ROWS pages a list needs — at least 1, so `% pages` is always safe. */
export function upcomingPages(trains) {
  return Math.max(1, Math.ceil(trains.length / CARD_MAX_ROWS));
}

/**
 * The card's visible window: everything when it fits, else the `offset`-th
 * PAGE of CARD_MAX_ROWS (any integer — wrapped by page count here).
 *
 * Pages, not a sliding window: sliding by one wraps the end of the list
 * around to the front (`7,8,1` then `8,1,2` with 8 trains), so a
 * chronological list stopped reading chronologically twice per lap. Paging
 * never wraps, gets through the list in ceil(n/3) steps instead of n, and —
 * at a longer hold — leaves each train on screen about as long as before.
 */
export function visibleUpcoming(trains, offset) {
  if (trains.length <= CARD_MAX_ROWS) return [...trains];
  const pages = upcomingPages(trains);
  const page = ((offset % pages) + pages) % pages;
  return trains.slice(page * CARD_MAX_ROWS, page * CARD_MAX_ROWS + CARD_MAX_ROWS);
}

// A mapping entry may only tune settings — never re-point the Overlay at a
// different Event source or a second mapping.
const PROTECTED_PARAMS = ['user', 'trains', 'event', 'lineup'];

/**
 * The resolved train's effective query: base query ⊕ the mapping entry's
 * overrides, spotlight unioned (base first, additions deduped
 * case-insensitively). The result re-enters parseConfig, so all value
 * validation stays there. A null/absent entry returns the base unchanged.
 */
export function effectiveQuery(baseSearch, entry) {
  const params = new URLSearchParams(baseSearch);
  if (!entry) return params.toString();
  for (const [key, value] of Object.entries(entry.overrides ?? {})) {
    if (!PROTECTED_PARAMS.includes(key)) params.set(key, value);
  }
  if (entry.spotlight?.length > 0) {
    const base = (params.get('spotlight') ?? '').split(',').map((n) => n.trim()).filter(Boolean);
    const additions = entry.spotlight.filter(
      (n) => !base.some((b) => b.toLowerCase() === n.toLowerCase()),
    );
    const union = [...base, ...additions];
    if (union.length > 0) params.set('spotlight', union.join(','));
  }
  return params.toString();
}
