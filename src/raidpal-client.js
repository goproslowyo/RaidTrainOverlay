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

/** A short, safe hint at what came back instead of a profile — for the log, not the UI. */
function describeBody(body) {
  const head = body.trim().slice(0, 120).replace(/\s+/g, ' ');
  if (/^<(?:!doctype|html)/i.test(head)) return `an HTML page: ${head}`;
  return `${body.length} characters starting: ${head}`;
}

/**
 * Fetch a user's raw wire payload (profile + joined/organised Events), or null
 * when RaidPal doesn't know the login.
 *
 * Three outcomes, and keeping them apart is the whole point (#49):
 *
 * - **`{ user: … }`** → the answer.
 * - **Nothing at all** → "no such login". The live API answers unknown *and*
 *   malformed logins with `204 No Content` and an empty body — not 404, not
 *   JSON (probed 2026-08-06, `docs/research/raidpal-user-endpoint-edge-cases.md`).
 *   An empty body on a **200** is read the same way, deliberately: the API is
 *   undocumented and unversioned, and this outcome should not hinge on which
 *   status code it picks for "nobody here".
 * - **Something we cannot read** → a **failed** read, so it throws. A body that
 *   will not parse, or parses without a `user`, means RaidPal answered but not
 *   with a profile — a Cloudflare backend-down page (observed), a truncated
 *   response, a captive portal. It used to be folded into "not found", which
 *   told a streamer with 13 trains that they had no RaidPal profile and, worse,
 *   quietly withheld the **Verified read** that #39's pruning and #41's Cleanup
 *   both require. Throwing puts it on #47's retry curve and, if that does not
 *   help, on the honest "RaidPal didn't answer just now" path.
 *
 * The message stays plain because it reaches the Configurator's error card;
 * the technical detail rides on `error.detail` for logs.
 */
export async function fetchUserPayload(login, fetchImpl = globalThis.fetch.bind(globalThis)) {
  const response = await fetchImpl(USER_API_BASE + encodeURIComponent(login));
  if (!response.ok) {
    throw new Error(`RaidPal API responded ${response.status} for user "${login}"`);
  }
  if (response.status === 204) return null;
  const body = await response.text();
  if (body.trim() === '') return null;
  const unreadable = (detail) => {
    const error = new Error('RaidPal answered with something we could not read.');
    error.detail = `user "${login}": ${detail}`;
    return error;
  };
  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    throw unreadable(describeBody(body));
  }
  if (!payload?.user) throw unreadable(`parsed, but carried no "user" — ${describeBody(body)}`);
  return payload;
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
