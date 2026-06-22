/**
 * lineup-engine: pure functions from (normalized Event, now, config) to Train
 * view state. No DOM, no I/O. The display locale rides on `config`: `config.t`
 * is a bound translator (i18n/index.makeT) and `config.locale` a BCP-47 tag,
 * both attached by the overlay shell after it resolves the locale. When absent
 * (unit tests, a cold call) the engine falls back to English so its output is
 * unchanged — this is why DEFAULT_T below mirrors the en catalog's time keys.
 */

/** The English fallback for the handful of keys the engine localizes, so the
 *  engine stays self-contained and its no-config output is exactly as before. */
const DEFAULT_STRINGS = {
  'overlay.now': 'NOW',
  'overlay.open': 'OPEN',
  'time.in': 'in {v}',
  'time.d': 'd',
  'time.h': 'h',
  'time.m': 'm',
};
function defaultT(key, params) {
  let s = DEFAULT_STRINGS[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/**
 * Relative time string for an upcoming Slot ("in 45m"). Future-only contract:
 * the current Slot reads "NOW" and departed Slots read "" via buildTrain, so
 * this never sees a non-positive delta. Minutes round up — never "in 0m".
 *
 * Localized via `t`: the "in {v}" wrapper and the compact d/h/m unit tokens come
 * from the catalog; the numeric assembly (e.g. "2h30m") stays here so the line
 * fits the fixed-width Car. `t` defaults to English, so a 2-arg call is unchanged.
 */
export function formatRelativeTime(starttime, now, t = defaultT) {
  const minutes = Math.ceil((starttime.getTime() - now.getTime()) / 60_000);
  const [D, H, M] = [t('time.d'), t('time.h'), t('time.m')];
  let value;
  if (minutes < 60) {
    value = `${minutes}${M}`;
  } else if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    value = m === 0 ? `${h}${H}` : `${h}${H}${m}${M}`;
  } else {
    // Beyond a day, leftover minutes are noise on a fixed-size Car.
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    value = h === 0 ? `${d}${D}` : `${d}${D}${h}${H}`;
  }
  return t('time.in', { v: value });
}

/**
 * Absolute wall-clock time of an instant in an IANA zone ("2:00 PM"). DST is
 * automatic: the same instant formatted in a region zone yields the right
 * offset for that date. The locale drives both the digits and 12-vs-24-hour:
 * `hour12` is no longer forced, so en-US/es-MX render 12-hour and de/nl/da/lt/
 * fr/it/es-ES render 24-hour. Defaults to en-US so a 2-arg call is unchanged.
 */
export function formatAbsoluteTime(date, zone, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

/**
 * Collapse contiguous same-Broadcaster occupied Slots into Sets. RaidPal lets a
 * streamer hold several Slots in a row (a multi-hour set); each such run becomes a
 * single Set spanning the combined window, so the streamer draws ONE Car instead of
 * one per Slot (the "double-train"). A run is broken by a different Broadcaster, an
 * Open Slot, or a gap in `order` — non-adjacent Slots are two genuine sets. Open and
 * lone Slots pass through as span-1 Sets, so nothing else changes. Input must be
 * order-sorted. Each Set carries the first Slot's start; its window is span × a Slot.
 *
 * Identity is id-AUTHORITATIVE: a present Broadcaster id wins on EITHER side — if
 * one Slot is identified and the next is not, they are not provably the same person
 * (a shared display name isn't proof), so they stay apart. The display-name fallback
 * fires ONLY when NEITHER Slot carries an id, so hand-built lineups (which may have
 * no ids) still merge by name. RaidPal occupied slots always carry ids.
 */
function mergeRuns(slots) {
  const sameBroadcaster = (a, b) => {
    if (!a.occupied || !b.occupied) return false;
    const idA = a.broadcaster.id, idB = b.broadcaster.id;
    if (idA || idB) return idA === idB; // a present id is authoritative — both must match
    return a.broadcaster.displayName === b.broadcaster.displayName;
  };
  const sets = [];
  for (const slot of slots) {
    const prev = sets.at(-1);
    if (prev && slot.order === prev.lastOrder + 1 && sameBroadcaster(prev, slot)) {
      prev.span += 1;
      prev.lastOrder = slot.order;
      continue;
    }
    sets.push({
      order: slot.order,
      lastOrder: slot.order,
      starttime: slot.starttime,
      span: 1,
      occupied: slot.occupied,
      broadcaster: slot.broadcaster,
    });
  }
  return sets;
}

export function buildTrain(event, now, config) {
  // Display locale rides on config (attached by the overlay shell); absent in
  // unit tests, where the English fallbacks keep output identical.
  const t = config.t ?? defaultT;
  const locale = config.locale ?? 'en-US';
  const NOW = t('overlay.now');

  const slotMs = event.slotDurationMins * 60_000;
  const nowMs = now.getTime();

  // A Broadcaster can hold several Slots in a row (a multi-hour set). Collapse each
  // contiguous same-Broadcaster run into ONE Set so the streamer draws a single Car
  // spanning the combined window — otherwise they render 2–3 times in a row (the
  // double-train). Open and lone Slots pass through as span-1 Sets, so every flag
  // below is unchanged for an ordinary single-Slot streamer.
  const sets = mergeRuns([...event.slots].sort((a, b) => a.order - b.order));

  // A Set's window is [starttime, starttime + span × slot_duration_mins): inclusive
  // start, exclusive end. Span is 1 for an ordinary Slot, so the math is unchanged
  // there. Derived from the timetable, never broadcaster_live.
  const setEndMs = (set) => set.starttime.getTime() + set.span * slotMs;
  const isCurrentSet = (set) => set.starttime.getTime() <= nowMs && nowMs < setEndMs(set);
  const isDepartedSet = (set) => nowMs >= setEndMs(set);
  // Current reads "NOW"; departed reads "" — dimming is the departed signal. The
  // relative time counts from the Set's FIRST Slot (when the streamer goes live).
  const relativeTime = (set) => {
    if (isCurrentSet(set)) return NOW;
    if (isDepartedSet(set)) return '';
    return formatRelativeTime(set.starttime, now, t);
  };

  // With tz set, upcoming Cars show absolute multi-zone times (flyer parity);
  // current ("NOW") and departed ("") states are untouched — dimming, not a
  // timestamp, is the departed signal. Empty tz → the relative line.
  const tz = config.tz ?? [];
  const timeLines = (set) => {
    if (tz.length === 0) return [relativeTime(set)];
    if (isCurrentSet(set)) return [NOW];
    if (isDepartedSet(set)) return [''];
    return tz.map(({ token, zone }) => `${formatAbsoluteTime(set.starttime, zone, locale)} ${token}`);
  };

  // The Caboose is the last Broadcaster's Car — the highest-order occupied Set —
  // never an Open Slot, even when an Open Slot sorts after it. `sets` is already
  // order-sorted, so the last occupied Set is the Caboose.
  const cabooseSet = sets.filter((set) => set.occupied).at(-1);

  // Open Slots are hidden by default; config.openslots opts them in as Cars.
  // With hidefinished, departed Sets drop out entirely (vs. the default dim).
  const includeSet = (set) =>
    (set.occupied || config.openslots) && !(config.hidefinished && isDepartedSet(set));

  // Spotlight: case-insensitive match on the decoded Broadcaster name. Names
  // are lowercased by parseConfig, so we lowercase the display name to match.
  const spotlight = config.spotlight ?? [];
  const isSpotlit = (set) => spotlight.includes(set.broadcaster.displayName.toLowerCase());

  // One Set → its Car view-model.
  const toCar = (set) => {
    const base = {
      slotOrder: set.order,
      isCaboose: set === cabooseSet,
      isCurrent: isCurrentSet(set),
      isDeparted: isDepartedSet(set),
      relativeTime: relativeTime(set),
      timeLines: timeLines(set),
    };
    // Open Slot Cars carry no Broadcaster — just an "OPEN" label and a time.
    return set.occupied
      ? {
          ...base,
          isOpen: false,
          isSpotlit: isSpotlit(set),
          broadcaster: {
            displayName: set.broadcaster.displayName,
            image: set.broadcaster.image,
          },
        }
      : { ...base, isOpen: true, isSpotlit: false, broadcaster: null, displayName: t('overlay.open') };
  };

  // The ORGANISER drives the locomotive — the conductor of the raid train. Every
  // booked streamer is a passenger Car: the first one kicks off the stream but is
  // not the loco. So the Engine carries no Broadcaster — toVehicles paints the
  // Organiser onto the loco and draws no separate tender — and every displayed Set
  // (including the first streamer) is a Car.
  const cars = sets.filter(includeSet).map(toCar);

  // Phase comes from the full timetable (Open Slots included) so it can never
  // disagree with the per-Car flags. Empty timetable reads as pre-event.
  const startTimes = event.slots.map((slot) => slot.starttime.getTime());
  let phase = 'pre';
  if (startTimes.length > 0 && nowMs >= Math.min(...startTimes)) {
    phase = nowMs >= Math.max(...startTimes) + slotMs ? 'post' : 'live';
  }

  // The locomotive (the Organiser) reacts only to the Event ENDING per
  // config.enginedim: it has no Slot of its own, so it never goes live or departed —
  // it just leads, then 'over' (default) dims it post-event, 'never' leaves it,
  // 'finished' follows hidefinished.
  const enginedim = config.enginedim ?? 'over';
  const eventOver = phase === 'post';
  const engineHidden = eventOver && enginedim === 'finished' && Boolean(config.hidefinished);
  const engineDimmed = eventOver && enginedim !== 'never' && !engineHidden;

  return {
    phase,
    title: event.title,
    // The Organiser drives the loco; toVehicles reads this to paint it on.
    organiser: {
      displayName: event.organiser.displayName,
      image: event.organiser.image,
    },
    // The Engine IS the Organiser — a Broadcaster-less shell that toVehicles paints
    // the Organiser onto. It has no Slot, so no live/departed/spotlight state of its
    // own; only its post-event dim/hide (enginedim above) applies.
    engine: {
      broadcaster: null,
      slotOrder: null,
      isCurrent: false,
      isSpotlit: false,
      isDeparted: false,
      isCaboose: false,
      relativeTime: '',
      timeLines: [''],
      isDimmed: engineDimmed,
      isHidden: engineHidden,
    },
    cars,
  };
}
