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

/**
 * The Upcoming card's Horizon grammar: `N` (next N trains), `Nw`
 * (N weeks), `Nm` (N months), `all`. Anything else — including absence, the
 * default — is null: card off, and a Live Link with no train renders nothing.
 */
function upcomingSpec(raw) {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'all') return { kind: 'all' };
  const match = /^(\d+)(w|m)?$/.exec(value);
  const n = match ? Number(match[1]) : 0;
  if (n <= 0) return null;
  return { kind: match[2] === 'w' ? 'weeks' : match[2] === 'm' ? 'months' : 'count', n };
}

const UPCOMING_SUFFIX = { count: '', weeks: 'w', months: 'm' };

/** The Upcoming card's nine scene anchors: [top|middle|bottom] × [left|centre|right]. */
const UPPOS_ANCHORS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br'];

/** Old Theme keys that map to a current one (the mockup's `neon` → `synthwave`). */
const THEME_ALIASES = { neon: 'synthwave', smoke: 'highvibes', coltrane: 'jazz', shinkansen: 'bullet', lavalamp: 'lava' };

export function parseConfig(queryString) {
  const params = new URLSearchParams(queryString);
  const event = (params.get('event') ?? '').trim();
  // A hand-built lineup carried in the URL (base64url blob, decoded by the shell, not
  // here — parseConfig stays codec-free). The alternative Event source to `event`.
  const lineup = (params.get('lineup') ?? '').trim();
  // Live Link: a Twitch login the Overlay resolves to the live/next train at load,
  // plus the optional per-train mapping blob (slug → settings diff; decoded by the
  // shell like `lineup`). The third — and most specific — Event source.
  const user = (params.get('user') ?? '').trim();
  const trains = (params.get('trains') ?? '').trim();
  const mode = (params.get('mode') ?? '').toLowerCase();
  const lang = (params.get('lang') ?? '').trim();
  return {
    event: event === '' ? null : event,
    lineup: lineup === '' ? null : lineup,
    user: user === '' ? null : user,
    trains: trains === '' ? null : trains,
    upcoming: upcomingSpec(params.get('upcoming')),
    // The Upcoming card's own knobs (Live Link only, like `upcoming`). `uppos`
    // anchors the card in the scene — deliberately decoupled from the Train's
    // `height`: a webcam, chat box or alert layer decides where it can sit.
    // Default bottom-centre, the closest anchor to the shipped placement.
    uppos: oneOf(params.get('uppos'), UPPOS_ANCHORS, 'bc'),
    // Card opacity. Floor 0.3: below that the card is unreadable-but-present,
    // which reads on stream as a rendering bug rather than a choice.
    upop: boundedNumber(params.get('upop'), 0.3, 1, 0.88),
    // Seconds each Page of rows is held before turning (card view only).
    upcycle: boundedNumber(params.get('upcycle'), 3, 120, 12),
    // Seconds for one full Lap (scrolling view only); higher is slower.
    upscroll: boundedNumber(params.get('upscroll'), 10, 120, 34),
    // The card's Footprint: the 3-row card view, or the one-line scrolling
    // view for scenes with no room for a card. The VALUE stays `ticker` — it
    // ships inside copied OBS browser sources — where the word for it has not.
    upstyle: oneOf(params.get('upstyle'), ['card', 'ticker'], 'card'),
    // Upcoming-only mode: this Live Link never renders the Train — it always
    // shows the upcoming card, even while a train is live. A second URL for a
    // separate OBS scene (starting soon / be right back).
    uponly: boolean(params.get('uponly')),
    // The card's **Occasion**: while a train is live, the card also pulses
    // into the empty stage between Passes (and into marquee's Breathers).
    // On by default wherever the card is on — opt-out, not opt-in, since the
    // streamer already asked for upcoming trains during dead air. Only `0`
    // switches it off, which reserves `upgap=<minutes>` as a backwards-
    // compatible future cadence override (`1` stays truthy).
    upgap: (params.get('upgap') ?? '') !== '0',
    // The display locale, kept as the raw requested tag (or null). Resolution to
    // a supported locale + the navigator fallback happen in the overlay shell so
    // parseConfig stays pure (no `navigator`); the Configurator's selector sets it.
    lang: lang === '' ? null : lang,
    mode: mode === 'marquee' ? 'marquee' : 'pass',
    interval: positiveNumber(params.get('interval'), 15),
    speed: positiveNumber(params.get('speed'), 1),
    // Track visibility: `periodic` (default) fades the rails/scene out between
    // Passes so the Overlay goes fully empty once the Train clears — and fades
    // them back in as the next Pass rolls in — so a Theme's scenery never lingers
    // on screen with no Train. `always` keeps the rails/scene up the whole time
    // (a persistent lower-third). A pass-Mode concept (no-op for marquee/preview).
    track: oneOf(params.get('track'), ['always', 'periodic'], 'periodic'),
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
      ['classic', 'flat', 'synthwave', 'ticket', 'wood', 'comic', 'departures', 'paper', 'tron', 'pixel', 'highvibes', 'jazz', 'bullet', 'lava', 'pride', 'shuffle'],
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
  // The three Event sources are mutually exclusive; the most specific intent wins:
  // Live Link (user) beats a pinned event, which beats a hand-built lineup. Fixed
  // emit order so serialize∘parse stays idempotent.
  if (config.user) {
    params.set('user', config.user);
    if (config.trains) params.set('trains', config.trains);
    if (config.upcoming) {
      params.set('upcoming', config.upcoming.kind === 'all' ? 'all' : `${config.upcoming.n}${UPCOMING_SUFFIX[config.upcoming.kind]}`);
    }
    // The Upcoming card's knobs ride only with a Live Link — without `user=`
    // there is no card for them to describe.
    if (config.uppos !== 'bc') params.set('uppos', config.uppos);
    if (config.upop !== 0.88) params.set('upop', String(config.upop));
    if (config.upcycle !== 12) params.set('upcycle', String(config.upcycle));
    if (config.upscroll !== 34) params.set('upscroll', String(config.upscroll));
    if (config.upstyle !== 'card') params.set('upstyle', config.upstyle);
    if (config.uponly) params.set('uponly', '1');
    if (config.upgap === false) params.set('upgap', '0');
  } else if (config.event) params.set('event', config.event);
  else if (config.lineup) params.set('lineup', config.lineup);
  // Locale: emit whenever explicitly set. Even `lang=en` is semantically
  // meaningful because absent `lang` falls back to browser auto-detection.
  // The raw requested tag round-trips verbatim.
  if (config.lang) params.set('lang', config.lang);
  if (config.mode !== 'pass') params.set('mode', config.mode);
  if (config.interval !== 15) params.set('interval', String(config.interval));
  if (config.speed !== 1) params.set('speed', String(config.speed));
  if (config.track !== 'periodic') params.set('track', config.track);
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
