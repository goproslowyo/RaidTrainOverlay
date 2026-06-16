/**
 * raidpal-client: owns all RaidPal I/O and payload normalization.
 * The single fetch lives here — the proxy swap point.
 */

const API_BASE = 'https://api.raidpal.com/rest/event/';

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
