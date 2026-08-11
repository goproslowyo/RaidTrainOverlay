/**
 * gap-card: whether the **Upcoming card** may take the **Stage** at all while a
 * Train is running, and — when it may — the schedule it appears on.
 *
 * Every rule here is a settled product rule, and every one of them is a
 * predicate over values the caller already holds: the tagged timing the render
 * handed back, how long the **Horizon** is, and the config. None of it needs a
 * DOM, a clock or storage, so the whole rule set is pure and unit-testable —
 * which is the point, since it used to live in the shell's wiring where nothing
 * could import it.
 *
 * This sits beside `gap-choreography.js` rather than inside it: the
 * choreography answers "given an empty stretch, when and for how long", and is
 * shared with marquee; this answers "is there an empty stretch to use, and may
 * we use it", which is the Overlay's question alone.
 *
 * The apply half — mounting the card, switching the **Breather**, writing the
 * generated keyframe — stays with the caller.
 */
import { gapSchedule } from './gap-choreography.js';
import { upcomingPages } from './live-link.js';

/** Nothing to show; the caller clears whatever is on the layer. */
const NO = Object.freeze({ show: false });

/**
 * The plan for one moment.
 *
 * `timing` is the render handle's tagged timing (`pass` / `breather` / `none`),
 * or null/undefined when nothing is running at all. `horizonLength` is how many
 * other trains the card has to list. `config` is the parsed query.
 *
 * Returns `{ show: false }`, or `{ show: true, schedule }` where `schedule` is
 * `gapSchedule`'s — the appearance windows as percentages of one cycle, which
 * the caller bakes into a single opacity keyframe.
 */
export function gapCardPlan({ timing, horizonLength, config }) {
  // Live Link only — nothing else can know about other trains. Never on an
  // upcoming-only source, whose whole scene is the card. Never when the
  // streamer asked for no card at all (no `upcoming`), and never when they
  // opted this occasion out (`upgap=0`).
  if (!config.user || config.uponly || !config.upcoming || !config.upgap) return NO;
  // Nothing running: no Stage was built, so there is no gap to plan into. And
  // `none` covers a render that built one but has no empty stretch to offer —
  // both preview paths, and a marquee whose Breather is opted out.
  if (!timing || timing.kind === 'none') return NO;
  // An empty Horizon would be an empty slab; show nothing instead.
  if (!horizonLength) return NO;

  // A Breather holds exactly one **Page** — its length is ours to choose, so it
  // stays short and constant, and the card's free-running pager walks the rest
  // of the Horizon across successive Breathers. A Pass gap is imposed on us
  // instead, so the card uses as much of it as whole Pages allow.
  const breather = timing.kind === 'breather';
  const schedule = gapSchedule({
    periodSec: timing.periodSec,
    emptyFromSec: timing.emptyFromSec,
    emptyToSec: timing.emptyToSec,
    // The page count depends on nothing but how many trains there are.
    pageCount: breather ? 1 : upcomingPages(new Array(horizonLength)),
    upcycleSec: config.upcycle,
    style: config.upstyle,
    upscrollSec: config.upscroll,
  });
  // A stretch too short for one whole Page (or one whole **Lap**): sit it out
  // entirely rather than flash part of one.
  if (schedule.windows.length === 0) return NO;
  return { show: true, schedule };
}
