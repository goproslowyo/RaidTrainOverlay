/**
 * gap-choreography: when the Upcoming card may take the stage while a train is
 * live, and for how long. Pure arithmetic — no DOM, no layout, no clock — so
 * the whole rule set is unit-testable and both consumers stay thin.
 *
 * Two consumers, which is why this is its own module rather than a corner of
 * either: the card turns the returned windows into one generated opacity
 * keyframe, and marquee turns the same numbers into its cycle-stretch and the
 * Track's fade. Putting the maths in either would make the other depend on it
 * sideways.
 *
 * The output is a schedule of appearance windows expressed as PERCENTAGES of
 * one cycle, because presence is a single CSS keyframe generated per render:
 * synchronised with the Train by construction, drift-free over a stream that
 * runs for days, and costing no per-frame JavaScript (the OBS mandate).
 */

/** After the Track has finished fading out, before the card may appear. */
export const BEAT_SEC = 3;
/** The card is fully gone this long before the Track begins fading back in. */
export const LEAD_SEC = 3;
/** The card's own fade, each way. */
export const CARD_FADE_SEC = 0.9;
/** One appearance per this much usable gap. Derived, never dialed. */
export const CADENCE_SEC = 180;
/** However long a Breather runs, the Train still gets this much crawl between them. */
const MIN_CRAWL_SEC = 60;

/**
 * How long one appearance lasts: the hold plus a fade each way. The hold is
 * always WHOLE units — whole pages, or whole ticker laps — because a partial
 * page teases rather than informs.
 */
function stintFor(units, unitSec) {
  return units * unitSec + 2 * CARD_FADE_SEC;
}

/**
 * The schedule for one cycle.
 *
 * `emptyFromSec`/`emptyToSec` bound the stage's true-empty stretch within the
 * cycle — for a Pass gap, from the rails finishing their fade-out to the moment
 * they begin fading back in. Everything else is derived.
 *
 * Returns `{ cycleSec, windows, appearances, pages, stintSec, rung }` where
 * `rung` names which step of the degradation ladder was taken:
 * `full` → `capped` → `one-page` → `sit-out`, plus `off` for the opt-out.
 */
export function gapSchedule({
  periodSec,
  emptyFromSec,
  emptyToSec,
  pageCount = 1,
  upcycleSec = 12,
  style = 'card',
  upscrollSec = 34,
  enabled = true,
  cadenceSec = CADENCE_SEC,
}) {
  const none = (rung) => ({
    cycleSec: periodSec, windows: [], appearances: 0, pages: 0, stintSec: 0, rung,
  });
  if (!enabled) return none('off');

  // The card owns the true-empty middle, inset by the beat and the lead.
  const usableFrom = emptyFromSec + BEAT_SEC;
  const usableTo = emptyToSec - LEAD_SEC;
  const usable = usableTo - usableFrom;

  // The ticker's unit is a whole scroll lap; the paged card's is a whole page.
  const ticker = style === 'ticker';
  const unitSec = ticker ? upscrollSec : upcycleSec;
  const maxUnits = ticker ? 1 : Math.max(1, pageCount);

  // A Breather sizes its gap to hold exactly one unit, so this comparison sits
  // right on the knife edge and binary rounding alone could send it to sit-out
  // — hence the epsilon. A Pass gap is never this tight.
  const EPS = 1e-6;
  if (!(usable > 0) || usable < stintFor(1, unitSec) - EPS) return none('sit-out');

  // Cadence first — one appearance per ~3 minutes of usable gap, floored at one
  // whenever a single unit fits at all. Then fit the stint into each
  // appearance's share, capping pages rather than dropping appearances.
  let appearances = Math.max(1, Math.floor(usable / cadenceSec));
  let units = 0;
  while (appearances >= 1) {
    const share = usable / appearances;
    units = Math.min(maxUnits, Math.floor((share - 2 * CARD_FADE_SEC) / unitSec + EPS));
    if (units >= 1) break;
    appearances -= 1; // even one unit will not fit this many times
  }
  if (appearances < 1 || units < 1) return none('sit-out');

  const stintSec = stintFor(units, unitSec);
  // Evenly spaced: each appearance is centred in its own equal share of the
  // usable stretch, so windows can never touch, let alone overlap.
  const share = usable / appearances;
  const windows = [];
  for (let i = 0; i < appearances; i += 1) {
    const startSec = usableFrom + i * share + (share - stintSec) / 2;
    windows.push({
      fromPct: (startSec / periodSec) * 100,
      toPct: ((startSec + stintSec) / periodSec) * 100,
    });
  }

  const rung = ticker ? 'full'
    : units === maxUnits ? 'full'
      : units === 1 ? 'one-page' : 'capped';

  return { cycleSec: periodSec, windows, appearances, pages: units, stintSec, rung };
}

/**
 * Marquee has no gap, so it manufactures one: the **Breather**, an empty
 * stretch the cycle carries by construction. A Breather is a Pass gap marquee
 * makes for itself — the cycle this returns feeds the same `gapSchedule`, so
 * there is one choreography rather than a parallel marquee branch.
 *
 * Two things differ from a Pass gap, both deliberate. The whole cycle is the
 * cadence (~3 min), because a marquee lap is only tens of seconds and a
 * Breather every lap would fire far too often. And the
 * Breather's length is OURS to choose rather than externally imposed, so it is
 * short and constant — one page, always — since a marquee viewer chose an
 * always-on Train and its absences should stay brief and predictable. The
 * remaining pages rotate across successive Breathers instead of lengthening
 * any one of them; the card's free-running pager does that by itself.
 *
 * Returns null when the occasion is opted out — marquee then keeps exactly the
 * seamless infinite crawl it has today.
 */
export function breatherCycle({
  upcycleSec = 12,
  style = 'card',
  upscrollSec = 34,
  fadeOutSec = 10,
  fadeInSec = 15,
  cadenceSec = CADENCE_SEC,
  enabled = true,
} = {}) {
  if (!enabled) return null;
  const stintSec = stintFor(1, style === 'ticker' ? upscrollSec : upcycleSec);
  const breatherSec = fadeOutSec + BEAT_SEC + stintSec + LEAD_SEC + fadeInSec;
  // Breathers RECUR every cycle, so it is the CYCLE that must be the cadence:
  // making the crawl the cadence would push each Breather a whole Breather's
  // length further apart than asked. The crawl is what is left over — floored,
  // so a very slow ticker lap shortens the gap between Breathers rather than
  // inverting it.
  const crawlSec = Math.max(MIN_CRAWL_SEC, cadenceSec - breatherSec);
  const cycleSec = crawlSec + breatherSec;
  return {
    cycleSec,
    crawlSec,
    periodSec: cycleSec, // gapSchedule's cycle is the whole Breather cycle
    emptyFromSec: crawlSec + fadeOutSec,
    emptyToSec: cycleSec - fadeInSec,
    fadeOutSec,
    fadeInSec,
  };
}

/**
 * The generated opacity keyframe body for a schedule — the card's whole
 * presence, baked as static percentages so no appearance is ever clipped
 * mid-page. Opacity only; nothing here moves.
 */
export function windowKeyframes(schedule) {
  if (schedule.windows.length === 0) return '0%, 100% { opacity: 0; }';
  const fadePct = (CARD_FADE_SEC / schedule.cycleSec) * 100;
  const steps = ['0% { opacity: 0; }'];
  for (const w of schedule.windows) {
    steps.push(`${w.fromPct.toFixed(4)}% { opacity: 0; }`);
    steps.push(`${(w.fromPct + fadePct).toFixed(4)}% { opacity: 1; }`);
    steps.push(`${(w.toPct - fadePct).toFixed(4)}% { opacity: 1; }`);
    steps.push(`${w.toPct.toFixed(4)}% { opacity: 0; }`);
  }
  steps.push('100% { opacity: 0; }');
  return steps.join(' ');
}
