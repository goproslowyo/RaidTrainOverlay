/**
 * lineup-engine: pure functions from (normalized Event, now, config) to Train
 * view state. No DOM, no I/O. `config` is unused until config-derived state
 * lands, but is part of the signature from day one.
 */
/**
 * Relative time string for an upcoming Slot ("in 45m"). Future-only contract:
 * the current Slot reads "NOW" and departed Slots read "" via buildTrain, so
 * this never sees a non-positive delta. Minutes round up — never "in 0m".
 */
export function formatRelativeTime(starttime, now) {
  const minutes = Math.ceil((starttime.getTime() - now.getTime()) / 60_000);
  if (minutes < 60) return `in ${minutes}m`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `in ${h}h` : `in ${h}h${m}m`;
  }
  // Beyond a day, leftover minutes are noise on a fixed-size Car.
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return h === 0 ? `in ${d}d` : `in ${d}d${h}h`;
}

/**
 * Absolute wall-clock time of an instant in an IANA zone ("2:00 PM"). DST is
 * automatic: the same instant formatted in a region zone yields the right
 * offset for that date. Locale is fixed to en-US in v1 (12-hour); i18n is a
 * future param.
 */
export function formatAbsoluteTime(date, zone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function buildTrain(event, now, config) {
  const slotMs = event.slotDurationMins * 60_000;
  const nowMs = now.getTime();
  // The Slot window is [starttime, starttime + slot_duration_mins): inclusive
  // start, exclusive end. Derived from the timetable, never broadcaster_live.
  const slotEndMs = (slot) => slot.starttime.getTime() + slotMs;
  const isCurrentSlot = (slot) => slot.starttime.getTime() <= nowMs && nowMs < slotEndMs(slot);
  const isDepartedSlot = (slot) => nowMs >= slotEndMs(slot);
  // Current reads "NOW"; departed reads "" — dimming is the departed signal.
  const relativeTime = (slot) => {
    if (isCurrentSlot(slot)) return 'NOW';
    if (isDepartedSlot(slot)) return '';
    return formatRelativeTime(slot.starttime, now);
  };

  // With tz set, upcoming Cars show absolute multi-zone times (flyer parity);
  // current ("NOW") and departed ("") states are untouched — dimming, not a
  // timestamp, is the departed signal. Empty tz → the relative line.
  const tz = config.tz ?? [];
  const timeLines = (slot) => {
    if (tz.length === 0) return [relativeTime(slot)];
    if (isCurrentSlot(slot)) return ['NOW'];
    if (isDepartedSlot(slot)) return [''];
    return tz.map(({ token, zone }) => `${formatAbsoluteTime(slot.starttime, zone)} ${token}`);
  };

  // The Caboose is the last Broadcaster's Car — the highest-order occupied
  // Slot — never an Open Slot, even when an Open Slot sorts after it.
  const cabooseSlot = [...event.slots]
    .filter((slot) => slot.occupied)
    .sort((a, b) => a.order - b.order)
    .at(-1);

  // Open Slots are hidden by default; config.openslots opts them in as Cars.
  // With hidefinished, departed Slots drop out entirely (vs. the default dim).
  const includeSlot = (slot) =>
    (slot.occupied || config.openslots) && !(config.hidefinished && isDepartedSlot(slot));

  // Spotlight: case-insensitive match on the decoded Broadcaster name. Names
  // are lowercased by parseConfig, so we lowercase the display name to match.
  const spotlight = config.spotlight ?? [];
  const isSpotlit = (slot) => spotlight.includes(slot.broadcaster.displayName.toLowerCase());

  // One Slot → its Car view-model.
  const toCar = (slot) => {
    const base = {
      slotOrder: slot.order,
      isCaboose: slot === cabooseSlot,
      isCurrent: isCurrentSlot(slot),
      isDeparted: isDepartedSlot(slot),
      relativeTime: relativeTime(slot),
      timeLines: timeLines(slot),
    };
    // Open Slot Cars carry no Broadcaster — just an "OPEN" label and a time.
    return slot.occupied
      ? {
          ...base,
          isOpen: false,
          isSpotlit: isSpotlit(slot),
          broadcaster: {
            displayName: slot.broadcaster.displayName,
            image: slot.broadcaster.image,
          },
        }
      : { ...base, isOpen: true, isSpotlit: false, broadcaster: null, displayName: 'OPEN' };
  };

  const displayed = event.slots.filter(includeSlot).sort((a, b) => a.order - b.order).map(toCar);

  // The ORGANISER drives the locomotive — the conductor of the raid train. Every
  // booked streamer is a passenger Car: the first one kicks off the stream but is
  // not the loco. So the Engine carries no Broadcaster — toVehicles paints the
  // Organiser onto the loco and draws no separate tender — and every displayed Slot
  // (including the first streamer) is a Car.
  const cars = displayed;

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
