/**
 * Saved-streamers store: a remembered, newest-first list of DJ handles, so a
 * streamer building lineups by hand can re-add people they've used before. Pure CRUD
 * over a plain string array (mirrors presets.js); the Configurator persists it in its
 * OWN localStorage and harvests handles from a lineup only on a COMMITTED action (save
 * preset / copy URL), so half-typed names never get remembered. The Overlay never
 * reads this — it's authoring convenience only. Never throws.
 */

/** Most we keep, so the store can't grow unbounded. Oldest are pruned. */
const MAX = 200;
const clean = (h) => String(h ?? '').trim();

/** Stored JSON → list. Tolerant: blank/corrupt/non-array → [], non-strings dropped. */
export function parseStreamers(json) {
  if (json == null || json === '') return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** List → JSON string for the page to persist. */
export function serializeStreamers(list) {
  return JSON.stringify(list);
}

/**
 * Add one or more handles, returning a NEW list (never mutates). Each added handle
 * moves to the FRONT (newest-first) and dedups case-insensitively, keeping the latest
 * typed casing. Blank handles are ignored. A batch (a whole lineup) keeps its order at
 * the front. The list is capped at MAX, pruning the oldest.
 */
export function addStreamers(list, handles) {
  let next = Array.isArray(list) ? [...list] : [];
  const batch = Array.isArray(handles) ? handles : [handles];
  // Reverse so the batch's first handle ends up frontmost (reads in lineup order).
  for (const raw of [...batch].reverse()) {
    const h = clean(raw);
    if (!h) continue;
    const lc = h.toLowerCase();
    next = next.filter((x) => x.toLowerCase() !== lc);
    next.unshift(h);
  }
  return next.slice(0, MAX);
}

/** Forget a handle (case-insensitive), returning a NEW list. */
export function removeStreamer(list, handle) {
  const lc = clean(handle).toLowerCase();
  return (Array.isArray(list) ? list : []).filter((x) => x.toLowerCase() !== lc);
}

/** A copy of the list, newest-first (the stored order). */
export function listStreamers(list) {
  return Array.isArray(list) ? [...list] : [];
}
