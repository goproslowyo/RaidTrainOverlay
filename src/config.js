/**
 * The query-param schema: the Overlay's public configuration API.
 * Parses a query string; never reads window.location itself.
 */
/** A finite number > 0, or the default — the tolerance contract for numerics. */
function positiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** A truthy flag string ("1"/"true"/"on"/"yes", case-insensitive) → boolean. */
function boolean(value) {
  return ['1', 'true', 'on', 'yes'].includes((value ?? '').toLowerCase());
}

/** One of `allowed` (case-insensitive), else the default — the enum contract. */
function oneOf(value, allowed, fallback) {
  const lowered = (value ?? '').toLowerCase();
  return allowed.includes(lowered) ? lowered : fallback;
}

/**
 * A finite number within [min, max], or the default. Distinct from
 * positiveNumber: 0 is a legal value here and there's an upper bound.
 */
function boundedNumber(value, min, max, fallback) {
  // Absent/blank must fall back — Number(null) and Number('') are 0, which
  // would otherwise pass a min of 0 and mask the default.
  if (value == null || value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/**
 * Auto-refresh minutes: 0 means off — fetch on load only — for absent,
 * blank, non-numeric, or non-positive input. Any positive value is floored to 15 to
 * stay gentle on the shared, flaky RaidPal API.
 */
function refreshMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(15, n);
}

/**
 * A comma list of names → trimmed, lowercased, blanks dropped. Lowercasing
 * here makes Spotlight matching case-insensitive downstream. (A name with a
 * literal comma can't be expressed in v1 — accepted limitation.)
 */
function nameList(value) {
  return (value ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== '');
}

/**
 * Curated abbreviation → IANA region map. Region zones (not fixed offsets) so
 * Intl applies the right DST rules for any given instant. Common stream zones;
 * raw IANA names pass through resolveZone for anything not listed here.
 */
const TZ_ABBREVIATIONS = {
  PT: 'America/Los_Angeles',
  MT: 'America/Denver',
  CT: 'America/Chicago',
  ET: 'America/New_York',
  GMT: 'UTC',
  UTC: 'UTC',
  CET: 'Europe/Paris',
  BST: 'Europe/London',
  JST: 'Asia/Tokyo',
  AEST: 'Australia/Sydney',
};

/**
 * One tz token → `{ token, zone }` or null. Abbreviations resolve via the
 * curated map (case-insensitive, token uppercased); anything else is tried as
 * a raw IANA zone and passed through if Intl accepts it; invalid → null.
 * Exported so the manual harness shares one source of truth (no map drift).
 */
export function resolveZone(token) {
  const trimmed = (token ?? '').trim();
  if (trimmed === '') return null;
  const upper = trimmed.toUpperCase();
  if (upper in TZ_ABBREVIATIONS) return { token: upper, zone: TZ_ABBREVIATIONS[upper] };
  try {
    // Construction throws RangeError on an unknown zone — the validation.
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed });
    return { token: trimmed, zone: trimmed };
  } catch {
    return null;
  }
}

/** A comma list of tz tokens → resolved `{token, zone}` pairs, max 3 (flyer parity). */
function zoneList(value) {
  return (value ?? '')
    .split(',')
    .map(resolveZone)
    .filter(Boolean)
    .slice(0, 3);
}

/** Old Theme keys that map to a current one (the mockup's `neon` → `synthwave`). */
const THEME_ALIASES = { neon: 'synthwave', smoke: 'highvibes', coltrane: 'jazz', shinkansen: 'bullet', lavalamp: 'lava' };

export function parseConfig(queryString) {
  const params = new URLSearchParams(queryString);
  const event = (params.get('event') ?? '').trim();
  // A hand-built lineup carried in the URL (base64url blob, decoded by the shell, not
  // here — parseConfig stays codec-free). The alternative Event source to `event`.
  const lineup = (params.get('lineup') ?? '').trim();
  const mode = (params.get('mode') ?? '').toLowerCase();
  const lang = (params.get('lang') ?? '').trim();
  return {
    event: event === '' ? null : event,
    lineup: lineup === '' ? null : lineup,
    // The display locale, kept as the raw requested tag (or null). Resolution to
    // a supported locale + the navigator fallback happen in the overlay shell so
    // parseConfig stays pure (no `navigator`); the Configurator's selector sets it.
    lang: lang === '' ? null : lang,
    mode: mode === 'marquee' ? 'marquee' : 'pass',
    interval: positiveNumber(params.get('interval'), 15),
    speed: positiveNumber(params.get('speed'), 1),
    // Track visibility: `always` shows the rails the whole time (default);
    // `periodic` fades them out between Passes so the Overlay goes fully empty,
    // then back in before the next Pass. A pass-Mode concept (no-op otherwise).
    track: oneOf(params.get('track'), ['always', 'periodic'], 'always'),
    // Track fade durations in seconds (track=periodic only): how long the rails
    // take to fade in before a Pass and out after it. 0 = an instant cut. Both
    // are clamped to the available gap at render, so a long value degrades gracefully.
    trackfadein: boundedNumber(params.get('trackfadein'), 0, 120, 15),
    trackfadeout: boundedNumber(params.get('trackfadeout'), 0, 120, 10),
    // Size multiplier on the default --train-height. Distinct from
    // `height` (vertical position): `scale` is how big, `height` is where.
    // Bounded 0.5..2 (×28vh baseline = 14..56vh); 1 is the no-op default.
    scale: boundedNumber(params.get('scale'), 0.5, 2, 1),
    openslots: boolean(params.get('openslots')),
    spotlight: nameList(params.get('spotlight')),
    tz: zoneList(params.get('tz')),
    // Vertical placement, 0..100: 0 = top-flush, 100 = bottom-flush,
    // 50 = centred. Default 100 sits the Train at the bottom edge (tuned vs real OBS).
    height: boundedNumber(params.get('height'), 0, 100, 100),
    // Departed Cars dim by default; hidefinished removes them instead.
    hidefinished: boolean(params.get('hidefinished')),
    // How the Engine reacts once the Event is over: dim (default), follow the
    // hidefinished rule, or never change.
    enginedim: oneOf(params.get('enginedim'), ['over', 'finished', 'never'], 'over'),
    // Auto-refresh poll cadence in minutes; 0 = fetch on load only (default).
    refresh: refreshMinutes(params.get('refresh')),
    // Which Theme paints the Train. Enum over the shipped Theme keys,
    // plus `shuffle` (cycle the whole roster — the overlay picks the real Theme).
    // Unknown keys fall back to the default. Aliases (THEME_ALIASES) map friendly
    // names to canonical keys: `neon`→synthwave, `smoke`→highvibes, `coltrane`→jazz,
    // `shinkansen`→bullet, `lavalamp`→lava.
    theme: oneOf(
      THEME_ALIASES[(params.get('theme') ?? '').toLowerCase()] ?? params.get('theme'),
      ['classic', 'flat', 'synthwave', 'ticket', 'wood', 'comic', 'departures', 'paper', 'tron', 'pixel', 'highvibes', 'jazz', 'bullet', 'lava', 'shuffle'],
      'classic',
    ),
  };
}

/**
 * Config → query string (no leading `?`), the inverse of parseConfig for the
 * Configurator. Only non-default params are emitted, so a default config
 * round-trips back to a minimal `event=slug`. tz serializes its display
 * tokens (not the IANA zones) so they re-resolve through the curated map.
 */
export function serializeConfig(config) {
  const params = new URLSearchParams();
  if (config.event) params.set('event', config.event);
  // A hand-built lineup is the alternative source. Emitted only when there's no event
  // (event wins if both somehow present — they're mutually exclusive) and in this
  // fixed position (right after event) so serialize∘parse stays idempotent.
  else if (config.lineup) params.set('lineup', config.lineup);
  // Locale: emit only when set and not the default English (matches the
  // omit-defaults contract). The raw requested tag round-trips verbatim.
  if (config.lang && config.lang !== 'en') params.set('lang', config.lang);
  if (config.mode !== 'pass') params.set('mode', config.mode);
  if (config.interval !== 15) params.set('interval', String(config.interval));
  if (config.speed !== 1) params.set('speed', String(config.speed));
  if (config.track !== 'always') params.set('track', config.track);
  // Fade durations serialize on their own non-default value (independent of track,
  // so serialize∘parse stays idempotent); they simply have no effect unless periodic.
  if (config.trackfadein !== 15) params.set('trackfadein', String(config.trackfadein));
  if (config.trackfadeout !== 10) params.set('trackfadeout', String(config.trackfadeout));
  if (config.scale !== 1) params.set('scale', String(config.scale));
  if (config.openslots) params.set('openslots', '1');
  if (config.spotlight.length > 0) params.set('spotlight', config.spotlight.join(','));
  if (config.tz.length > 0) params.set('tz', config.tz.map((zone) => zone.token).join(','));
  if (config.height !== 100) params.set('height', String(config.height));
  if (config.hidefinished) params.set('hidefinished', '1');
  if (config.enginedim !== 'over') params.set('enginedim', config.enginedim);
  if (config.refresh > 0) params.set('refresh', String(config.refresh));
  if (config.theme !== 'classic') params.set('theme', config.theme);
  return params.toString();
}
