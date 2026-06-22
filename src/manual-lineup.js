/**
 * manual-lineup: the domain core for a hand-built ("no RaidPal") lineup — the
 * manual-lineup analogue of demo-event.js. Pure, DOM-free, runs in the Overlay and
 * in node:test alike. Turns the editor/wire MODEL into the normalized Event shape
 * buildTrain consumes, so a hand-built lineup is just a third Event source alongside
 * raidpal-client.normalizeEvent and demo-event.makeDemoEvent.
 *
 * MODEL: { t:title, o:{n:name, i?:avatarUrl}, z:ianaZone, s:ISO-instant, d:[{h:handle, d:mins}] }
 *
 * Uniform-slot mapping: the engine uses ONE slot length for every slot, so a per-DJ
 * "plays for" duration is expanded onto a base slot = gcd(all durations) (always a
 * 30-multiple given the editor's duration presets). A DJ playing 120 min in a 30-min
 * base becomes 4 consecutive same-handle slots — which mergeRuns (id-authoritative,
 * and these slots carry NO id) collapses back into a single Car by display name.
 */

/** Strip a leading @, a twitch.tv/<name> URL, and surrounding space → a bare handle. */
export function normalizeHandle(raw) {
  let h = String(raw ?? '').trim();
  const m = h.match(/twitch\.tv\/([^/?#\s]+)/i);
  if (m) h = m[1];
  return h.replace(/^@+/, '').split(/\s+/)[0] || '';
}

/**
 * One pasted line → { handle, mins }, or null for a blank line. Reads an optional
 * trailing human duration ("2h", "90m", "1h30", "1.5h"); defaults to `defaultMins`.
 */
export function parseLine(line, defaultMins = 60) {
  const raw = String(line ?? '').trim();
  if (raw === '') return null;
  let rest = raw;
  let mins = null;
  let m;
  if ((m = raw.match(/^(.*?)\s+(\d+)\s*h\s*(\d+)\s*m?$/i))) { rest = m[1]; mins = Number(m[2]) * 60 + Number(m[3]); }
  else if ((m = raw.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*h$/i))) { rest = m[1]; mins = Math.round(Number(m[2]) * 60); }
  else if ((m = raw.match(/^(.*?)\s+(\d+)\s*m$/i))) { rest = m[1]; mins = Number(m[2]); }
  const handle = normalizeHandle(rest);
  if (!handle) return null;
  return { handle, mins: mins != null && mins > 0 ? mins : defaultMins };
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const gcdAll = (nums) => nums.reduce((g, n) => gcd(g, n), 0);

/**
 * Snap a per-DJ duration to a 30-minute grid in [30 min, 12 h]. The base slot is the
 * GCD of all durations, so without this an off-grid value (a pasted "50m", or a
 * degenerate 0 / NaN / negative) would collapse the GCD to a tiny number and explode
 * the slot/car count — a hard no against the project's OBS-perf mandate. Snapping keeps
 * the base a 30-multiple ≥ 30 and is the single grid the editor + codec + overlay share.
 */
const SLOT_GRID_MINS = 30;
export function snapDuration(mins) {
  const n = Math.round((Number(mins) || 0) / SLOT_GRID_MINS) * SLOT_GRID_MINS;
  return Math.min(720, Math.max(SLOT_GRID_MINS, n));
}
/** Backstop on one Event's total slots so a degenerate lineup can never flood OBS. */
const MAX_SLOTS = 300;

/** A per-DJ slot count ("×N cars on the train") clamped to a sane 1..12. */
export function clampCount(n) {
  return Math.min(12, Math.max(1, Math.round(Number(n) || 1)));
}

/**
 * The IANA zone's offset (localWallClock − UTC, in ms) at a given UTC instant,
 * derived purely from Intl — no tz database dependency.
 */
function zoneOffsetMs(zone, utcMs) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  const asIfUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asIfUTC - utcMs;
}

/**
 * A wall-clock entered in a given IANA zone → the absolute UTC instant (ISO string).
 * `wallClock` is a datetime-local value "YYYY-MM-DDTHH:MM". Two passes settle the
 * offset across DST boundaries; gap/ambiguous wall clocks resolve to the earlier
 * valid instant (good enough — raid trains don't start on a clock-change minute).
 * NB: a non-existent spring-forward minute is therefore NOT round-trip-stable through
 * instantToZonedWallClock — an accepted edge for those ~1 hour per year.
 */
export function zonedWallClockToInstant(wallClock, zone) {
  const [datePart, timePart = '00:00'] = String(wallClock).split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi] = timePart.split(':').map(Number);
  const target = Date.UTC(y, mo - 1, d, h, mi);
  let instant = target - zoneOffsetMs(zone, target);
  instant = target - zoneOffsetMs(zone, instant); // correct across a DST boundary
  return new Date(instant).toISOString();
}

/**
 * The inverse of zonedWallClockToInstant: an absolute ISO instant → the wall-clock
 * "YYYY-MM-DDTHH:MM" it shows in `zone` (for a datetime-local input). Used to rehydrate
 * the editor from a shared ?lineup= link so it re-opens in its original zone.
 */
export function instantToZonedWallClock(iso, zone) {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(iso))) p[part.type] = part.value;
  const hh = String(Number(p.hour) % 24).padStart(2, '0');
  return `${p.year}-${p.month}-${p.day}T${hh}:${p.minute}`;
}

/** Manual-lineup MODEL → normalized Event (the shape buildTrain consumes). */
export function makeManualEvent(model, now = new Date()) {
  const djs = Array.isArray(model?.d) ? model.d : [];
  // Snap every duration to the shared grid FIRST, then derive the base from the snapped
  // values — so the GCD and the per-DJ expansion use the SAME numbers (no inconsistent
  // double-clamping) and the base can't collapse below 30 min.
  const durations = djs.map((x) => snapDuration(x.d));
  const base = durations.length ? gcdAll(durations) : 60;
  const slotMs = base * 60_000;
  const start = model?.s ? new Date(model.s) : now;

  const slots = [];
  let order = 0;
  djs.forEach((dj, idx) => {
    // base divides every snapped duration, so this is an integer; clampCount caps it at
    // the same 1..12 the editor enforces, so a re-opened link renders what the editor shows.
    const count = clampCount(durations[idx] / base);
    for (let i = 0; i < count && order < MAX_SLOTS; i += 1) {
      slots.push({
        order,
        starttime: new Date(start.getTime() + order * slotMs),
        occupied: true,
        // NO broadcaster.id — mergeRuns is id-authoritative, so id-less same-name
        // consecutive slots collapse to one Car (the back-to-back set).
        broadcaster: { displayName: dj.h || '—', image: '' },
      });
      order += 1;
    }
  });

  return {
    title: model?.t || 'My Raid Train',
    description: '',
    status: true,
    starttime: start,
    endtime: new Date(start.getTime() + order * slotMs),
    slotDurationMins: base,
    organiser: {
      displayName: model?.o?.n || 'You',
      image: model?.o?.i || '',
      link: '',
      timezone: model?.z || 'UTC',
    },
    raidpalLink: '',
    slots,
  };
}
