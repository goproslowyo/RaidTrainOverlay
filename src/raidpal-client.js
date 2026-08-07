/**
 * raidpal-client: owns all RaidPal I/O and payload normalization.
 * The single fetch lives here — the proxy swap point.
 */

const API_BASE = 'https://api.raidpal.com/rest/event/';
const USER_API_BASE = 'https://api.raidpal.com/rest/user/';

/**
 * The single isolated fetch: if RaidPal's CORS posture ever
 * changes, a proxy swaps in here and nowhere else. Returns the raw wire
 * payload — exported so event-feed can cache exactly what the API returned,
 * then normalize on read.
 */
export async function fetchEventPayload(slug, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const response = await fetchImpl(API_BASE + encodeURIComponent(slug));
  if (!response.ok) {
    throw new Error(`RaidPal API responded ${response.status} for event "${slug}"`);
  }
  return response.json();
}

/** Load an Event by slug. Throws on network error, non-ok status, or unknown slug. */
export async function loadEvent(slug, { fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  return normalizeEvent(await fetchEventPayload(slug, fetchImpl));
}

/**
 * Fetch a user's raw wire payload (profile + joined/organised Events), or null
 * when RaidPal doesn't know the login. The live API answers unknown AND
 * malformed logins with 204 No Content and an empty body — not 404, not JSON —
 * so the body is read as text and parsed defensively; anything that isn't a
 * `{ user: … }` payload is "not found". Throws only on indeterminate failures
 * (network error, non-ok status): per the fail-soft mandate, a failed read
 * must stay distinguishable from a definitive "no such user".
 */
export async function fetchUserPayload(login, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const response = await fetchImpl(USER_API_BASE + encodeURIComponent(login));
  if (!response.ok) {
    throw new Error(`RaidPal API responded ${response.status} for user "${login}"`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  try {
    const payload = JSON.parse(body);
    return payload?.user ? payload : null;
  } catch {
    return null;
  }
}

/** Load a user by Twitch login. Null for an unknown login; throws on failed reads. */
export async function loadUser(login, { fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  const payload = await fetchUserPayload(login, fetchImpl);
  return payload == null ? null : normalizeUser(payload);
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Decode the HTML entities RaidPal embeds in display strings. No DOM — runs under Node. */
function decodeEntities(text) {
  if (typeof text !== 'string') return text;
  return text.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi, (match, hex, dec, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dec) return String.fromCodePoint(parseInt(dec, 10));
    return NAMED_ENTITIES[name.toLowerCase()] ?? match;
  });
}

function normalizeSlot(slot) {
  return {
    order: slot.order,
    starttime: new Date(slot.starttime),
    occupied: slot.slot_occupied,
    broadcaster: slot.slot_occupied
      ? {
          displayName: decodeEntities(slot.broadcaster_display_name),
          image: slot.broadcaster_image,
          live: slot.broadcaster_live,
          id: slot.broadcaster_id,
          timezone: slot.user_timezone,
        }
      : null,
  };
}

/** An Event summary's slug, from the api_link tail (event identity is slug-only). */
function slugFromLinks(entry) {
  const link = entry.api_link ?? entry.raidpal_link ?? '';
  return link.slice(link.lastIndexOf('/') + 1) || null;
}

function normalizeEventSummary(entry, organiser) {
  return {
    slug: slugFromLinks(entry),
    title: decodeEntities(entry.title),
    starttime: new Date(entry.starttime),
    endtime: new Date(entry.endtime),
    raidpalLink: entry.raidpal_link,
    apiLink: entry.api_link,
    organiser,
  };
}

/**
 * Wire payload { user: {...} } → normalized user. Pure.
 *
 * `events` merges the trains the user organises (`user.events` — a key that is
 * ABSENT entirely for non-organisers) with `events_joined`, deduped by
 * raidpal_link (organisers who take a slot in their own train appear in both
 * arrays, and no id field exists), sorted ascending by starttime — the API's
 * ordering is unguaranteed. Organised entries carry `organiser: true`.
 */
export function normalizeUser(payload) {
  const wire = payload?.user;
  if (!wire) {
    throw new Error('RaidPal payload has no user — unknown login or unexpected response shape');
  }
  const merged = new Map();
  for (const entry of wire.events ?? []) {
    merged.set(entry.raidpal_link, normalizeEventSummary(entry, true));
  }
  for (const entry of wire.events_joined ?? []) {
    if (!merged.has(entry.raidpal_link)) merged.set(entry.raidpal_link, normalizeEventSummary(entry, false));
  }
  return {
    displayName: decodeEntities(wire.display_name),
    profileImage: wire.profile_image,
    twitchUri: wire.twitch_uri,
    timezone: wire.timezone,
    events: [...merged.values()].sort((a, b) => a.starttime - b.starttime),
  };
}

/** Wire payload { event: {...} } → normalized Event. Pure. */
export function normalizeEvent(payload) {
  const wire = payload?.event;
  if (!wire) {
    throw new Error('RaidPal payload has no event — unknown slug or unexpected response shape');
  }
  return {
    title: decodeEntities(wire.title),
    description: decodeEntities(wire.description),
    status: wire.status,
    starttime: new Date(wire.starttime),
    endtime: new Date(wire.endtime),
    slotDurationMins: wire.slot_duration_mins,
    organiser: {
      displayName: decodeEntities(wire.organiser_display_name),
      image: wire.organiser_image,
      link: wire.organiser_link,
      timezone: wire.organiser_timezone,
    },
    raidpalLink: wire.raidpal_link,
    slots: wire.time_table.map(normalizeSlot),
  };
}
