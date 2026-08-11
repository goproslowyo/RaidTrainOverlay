/**
 * gap-card: the **Stage choreography** — the Train and the **Upcoming card**
 * never share the **Stage**.
 *
 * That guarantee is ONE generated opacity keyframe sharing the **Pass** period:
 * synchronised with the Train by construction, so it cannot drift over a stream
 * that runs for days, and costing no per-frame JavaScript (the OBS mandate).
 * The whole rule set that makes it hold lives here, in two halves.
 *
 * The plan half (`gapCardPlan`) is every rule about whether the card may take
 * the Stage at all while a Train runs, and — when it may — the schedule it
 * appears on. Each is a predicate over values the caller already holds: the
 * tagged timing the render handed back, how long the **Horizon** is, and the
 * config. None of it needs a DOM, a clock or storage, so it is pure and
 * unit-testable — which is the point, since it used to live in the shell's
 * wiring where nothing could import it.
 *
 * The apply half (`createGapCard`) owns the card's layer, the generated
 * keyframes, the card mount and the **Breather** switch, and states the phase
 * rule as two verbs rather than a flag. A caller that could pass a `restart`
 * boolean wrongly would put the card on screen ON a Train — the one failure
 * this design exists to prevent — so there is no boolean to pass.
 *
 * This sits beside `gap-choreography.js` rather than inside it: the
 * choreography answers "given an empty stretch, when and for how long", and is
 * shared with marquee; this answers "is there an empty stretch to use, may we
 * use it, and where does the card go", which is the Overlay's question alone.
 */
import { gapSchedule, windowKeyframes } from './gap-choreography.js';
import { upcomingPages } from './live-link.js';
import { renderUpcomingCard, retireUpcomingCard } from './upcoming-card.js';

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

/** The class that IS the card's presence: one generated opacity keyframe. */
const ON_CLASS = 'rt-gap-card--on';
const STYLE_ID = 'rt-gap-card-style';

/**
 * This module's own generated stylesheet, injected once by id. Kept here rather
 * than in some module that owns "all generated CSS": four of these are injected
 * across three modules and they have nothing to do with one another, so such a
 * module would have an interface as wide as its implementation. All that is
 * worth sharing is this three-line ensure-an-element helper, and it is cheaper
 * to keep than to depend on.
 */
function setGapStyle(doc, cssText) {
  let style = doc.getElementById(STYLE_ID);
  if (!style) {
    style = doc.createElement('style');
    style.id = STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = cssText;
}

/**
 * Take over the **Stage choreography** for an Overlay mounted at `container`.
 *
 * The card gets a full-canvas layer of its own, laid as a SIBLING of the
 * Train's container: the card's own render dissolves whatever else holds the
 * container it mounts into, and inside `#train` that would be the Train. The
 * layer is the same positioning context the anchor grammar expects, and the
 * renderer never touches it — which is exactly what lets "never on stage
 * together" be a timing guarantee rather than a mount-and-unmount one.
 *
 * Two entry points, because the phase rule is not a parameter:
 *
 *   restart(view, horizon)  a render just built a Stage (or, with `null`,
 *                           nothing is running any more) and re-seeded the
 *                           Train's own keyframe — re-seed ours with it.
 *   refresh(horizon)        the Horizon changed. A changed schedule reaches the
 *                           card through the keyframe text, which CSS re-reads
 *                           without restarting.
 *
 * The rule the two of them keep is not "only a render re-seeds" but the one the
 * glossary states: the card re-seeds exactly when the PERIOD IT IS TIMED
 * AGAINST re-seeds, and never at any other moment. A render is one such event.
 * A returning **Breather** is the other, and it arrives through `refresh`:
 * `rt-stage--breather` carries the `rt-breather` keyframe, so switching the
 * Breather back on restarts the marquee card's whole period from 0%. Re-seeding
 * on anything else — or failing to re-seed on either of these — slides the card
 * out of phase with the Pass or Breather it shares, and it can then appear ON a
 * Train.
 *
 * `view` is renderTrain's handle. It carries the tagged `timing` and the
 * `setBreather` switch together because both belong to the Stage that render
 * built — the switch is the reason the handle is taken whole rather than the
 * timing alone. A Breather with nothing to put in it is just the Train
 * vanishing for no reason, so it is switched on only alongside a card that is
 * actually going to appear in it.
 */
export function createGapCard({ container, config }) {
  // The Document comes from the mount, like every other DOM module here, so an
  // Overlay built into a constructed Document or an iframe keeps all of its
  // parts — layer, card, stylesheet — in the one document.
  const doc = container.ownerDocument ?? document;
  const layer = doc.createElement('div');
  layer.id = 'gap-card';
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  container.insertAdjacentElement('afterend', layer);

  // The Stage the card is currently timed against, and when the period it
  // shares last started. The handle is held rather than the timing alone so the
  // Breather can still be switched off on the Stage that is on screen at the
  // moment it is dropped.
  let view = null;
  let seededAt = 0;
  // Whether the Breather is currently switched ON, on the Stage `view` built.
  // Worth tracking because on marquee the Breather IS the period the card
  // shares: `rt-stage--breather` carries the `rt-breather` keyframe, so the
  // class landing restarts that period from 0%. Its comings and goings are
  // therefore re-seeds, and the card's own seed has to move with them.
  let breatherOn = false;

  /** Throw the Breather switch on the current Stage, and remember which way. */
  const setBreather = (on) => {
    view?.setBreather(on);
    // A Pass Stage has no Breather to be on: its switch is a no-op, and the
    // period the card shares there is `rt-pass`, which only a render restarts.
    breatherOn = Boolean(on) && view?.timing?.kind === 'breather';
  };

  const clear = () => {
    retireUpcomingCard(layer);
    layer.classList.remove(ON_CLASS);
    layer.style.animationDelay = '';
    setBreather(false);
  };

  /**
   * Plan for this moment and apply it. `reseed` is not a mode: it is which of
   * the two entry points called, and only the one that follows a render passes
   * it. See the phase rule above.
   */
  const apply = (horizon, reseed) => {
    const plan = gapCardPlan({ timing: view?.timing, horizonLength: horizon.length, config });
    if (!plan.show) return clear();
    const { schedule } = plan;
    setGapStyle(doc, `
      @keyframes rt-gap-card { ${windowKeyframes(schedule)} }
      .${ON_CLASS} { animation: rt-gap-card ${schedule.cycleSec}s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        /* The whole occasion IS the motion: a card that pulses in and out over
           a live stream. Reduced motion keeps the Train and drops the pulse
           rather than leaving the card parked over the Train at full opacity. */
        .${ON_CLASS} { animation: none; opacity: 0; }
      }`);
    renderUpcomingCard(layer, horizon, config);
    // A Breather that was off and is now on has just restarted `rt-breather`
    // from 0%, which on marquee is the period the card is timed against. That
    // is a re-seed of the period, exactly as a render is a re-seed of the Pass,
    // so the card's seed moves to this instant too. Without it the two are
    // timed to different epochs — measured at ~2.4s apart on a Horizon that
    // emptied and refilled — and the card can appear ON a Train.
    const breatherWasOff = !breatherOn;
    setBreather(true);
    if (breatherOn && breatherWasOff) seededAt = Date.now();
    if (reseed) {
      layer.classList.remove(ON_CLASS);
      layer.style.animationDelay = '';
      void layer.offsetWidth; // commit, so the restart re-seeds with the Pass
    } else if (!layer.classList.contains(ON_CLASS)) {
      // Presence is off and the Horizon has just arrived — which is the normal
      // way round, since the feed resolves the other trains after the render.
      // Switching on from 0% would time the card against this instant instead
      // of against the Pass, so it starts where the Pass has got to by now. One
      // clock read, at the only moment the phase is not already right; nothing
      // per-frame, and nothing that ticks.
      // Floored, so a machine whose clock steps backwards mid-stream starts the
      // card at the top of the cycle rather than writing a delay CSS will drop.
      const elapsed = Math.max(0, (Date.now() - seededAt) / 1000) % schedule.cycleSec;
      layer.style.animationDelay = `-${elapsed.toFixed(3)}s`;
    }
    layer.classList.add(ON_CLASS);
  };

  return {
    restart(nextView, horizon) {
      // The Stage being replaced may still be on screen (idle arrives with the
      // last render painted), and its Breather switch dies with its handle, so
      // it is let back up before the handle goes.
      if (nextView !== view) setBreather(false);
      view = nextView ?? null;
      seededAt = Date.now();
      apply(horizon, true);
    },
    refresh(horizon) {
      apply(horizon, false);
    },
  };
}
