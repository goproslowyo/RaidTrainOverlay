/**
 * gap-card: the **Stage choreography** — the Train and the **Upcoming card**
 * never share the **Stage**.
 *
 * That guarantee is ONE generated opacity keyframe sharing the **Pass** period:
 * synchronised with the Train by construction, so it cannot drift over a stream
 * that runs for days, and costing no per-frame JavaScript (the OBS mandate).
 * The whole rule set that makes it hold lives here, in three named pieces: the
 * plan (`gapCardPlan`), the phase rule (`reseedsKeyframe`), and the apply half
 * (`createGapCard`) that keeps them.
 *
 * The plan half (`gapCardPlan`) is every rule about whether the card may take
 * the Stage at all while a Train runs, and — when it may — the schedule it
 * appears on. Each is a predicate over values the caller already holds: the
 * tagged timing the render handed back, how long the **Horizon** is, and the
 * config. None of it needs a DOM, a clock or storage, so it is pure and
 * unit-testable — which is the point, since it used to live in the shell's
 * wiring where nothing could import it.
 *
 * The phase rule (`reseedsKeyframe`) is the one question the apply half asks of
 * every moment: did the period the card is timed against just start over? It is
 * a predicate over the event, not over the plan, so it is pure and can be asked
 * directly by a test — the thing the rule lacked while it was three scattered
 * assignments and a comment.
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
import { stageClock } from './stage-clock.js';
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

/**
 * The phase half of the **Stage choreography**: may this moment move the card's
 * epoch?
 *
 * The card re-seeds exactly when the period it is timed against re-seeds, and
 * at no other moment. There are two such events and no more. A render is one:
 * `rt-pass` starts again with the Stage it built. A **Breather** switched back
 * on is the other: `rt-breather` starts when `rt-stage--breather` lands, and a
 * card held at its old epoch through that measured ~2.4s out of phase with the
 * Breather it shares — enough to fade in over a Train that has not finished
 * fading out (#85). Everything else is a **Horizon** refresh under a period
 * that kept running, where the card must not start over but come back at the
 * phase the **Pass** has reached by now.
 *
 * `rendered` is whether a render just built the Stage; `timingKind` is that
 * Stage's tagged timing, and `breatherWasOn` whether the Breather was already
 * switched on before this moment. Pure, and safe on nothing at all: an unknown
 * moment moves no epoch.
 */
export function reseedsKeyframe({ rendered = false, timingKind = null, breatherWasOn = false } = {}) {
  if (rendered) return true;
  return timingKind === 'breather' && !breatherWasOn;
}

/** The class that IS the card's presence: one generated opacity keyframe. */
const ON_CLASS = 'rt-gap-card--on';
const LAYER_ID = 'gap-card';
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
 * The rule the two of them keep is not "only a render re-seeds": a returning
 * **Breather** re-seeds too, and it arrives through `refresh`. Which entry
 * point was used is therefore only half of the question, and the whole of it is
 * `reseedsKeyframe` — asked once, at the top of `apply`.
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
  // Resolved once, from THIS mount's Document, so the epoch and the read that
  // measures against it can never turn out to be two different clocks. It is
  // the clock `rt-gap-card` itself runs on — see src/stage-clock.js, which the
  // renderer's Breather epoch also takes its clock from.
  const now = stageClock(doc);
  const layer = doc.createElement('div');
  layer.id = LAYER_ID;
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
   * Plan for this moment and apply it. `rendered` is not a mode: it is which of
   * the two entry points called, and only the one that follows a render passes
   * it. See the phase rule above.
   */
  const apply = (horizon, rendered) => {
    // The phase question is asked of the EVENT, before the plan is asked
    // anything: whether the period the card shares just started over is a fact
    // about this moment, not about what the plan decides to do with it. A
    // render that shows nothing still re-seeded the Pass.
    if (reseedsKeyframe({ rendered, timingKind: view?.timing?.kind, breatherWasOn: breatherOn })) {
      seededAt = now();
    }
    const plan = gapCardPlan({ timing: view?.timing, horizonLength: horizon.length, config });
    if (!plan.show) return clear();
    const { schedule } = plan;
    setGapStyle(doc, `
      /* The layer's own opacity is NOTHING. Presence is the keyframe and only
         the keyframe, so a layer without it has to look emptied rather than
         fall back to the base 1 every element has — which is what painted the
         card a clear is retiring at FULL opacity over the live Train for the
         whole of its dissolve, at every empty-Horizon tick outside a window
         (#90, measured 0 -> 1 in one frame, held for a browser-measured 460ms;
         upcoming-card's own constants put the dissolve at 510-530ms, so the
         460 is what Chrome painted, not a number derived from them).

         NEVER !important here. A CSS animation outranks any normal author
         declaration whatever its specificity, which is the only reason an id
         rule can sit under a class's keyframe — but !important outranks the
         animation, so an important base would hold the layer at 0 forever and
         the Upcoming card would never appear again. Chrome reads the card's
         mid-window opacity down from 1.000 to 0. The suite was blind to that
         for as long as it matched a substring of the whole sheet; it is not
         now — test/gap-card.test.js asserts the exact declaration, asserts it
         is outside EVERY at-rule, and refuses !important anywhere in this
         sheet however it is spelled. The same block below is asserted for what
         it must contain, not only for what it must not.

         It belongs in this stylesheet rather than inline on the layer, and the
         two are equally correct: the sheet keeps the base beside the keyframe
         it completes, so one place says the whole of what the layer paints, at
         the cost of not existing until the first showing plan injects it — a
         fresh layer reads 1 until then, which is harmless only because nothing
         is on it yet. Inline would swap those two properties round.

         The residual, named rather than fixed: the card LEAVES on a cut. A
         transition on the layer would be inert, not merely unsafe — the
         underlying opacity is 0 both before and after presence comes off, and
         there is nothing to transition between. Under a Breather that cut is
         right (the Stage is coming back and the card must be gone). Under a
         Pass, mid-window, there is no Train on stage, so a fade would have been
         safe and free there — and a card blinking out of an otherwise empty
         Overlay reads as a glitch. Fixing it means a second element or a second
         source of opacity, which is the design this module exists to avoid. */
      #${LAYER_ID} { opacity: 0; }
      @keyframes rt-gap-card { ${windowKeyframes(schedule)} }
      .${ON_CLASS} { animation: rt-gap-card ${schedule.cycleSec}s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        /* The whole occasion IS the motion: a card that pulses in and out over
           a live stream. Reduced motion keeps the Train and drops the pulse
           rather than leaving the card parked over the Train at full opacity.
           The opacity: 0 is redundant with the id rule above and kept as the
           statement of what this block wants on its own — if the id rule is
           ever scoped to something narrower, this block must not go with it. */
        .${ON_CLASS} { animation: none; opacity: 0; }
      }`);
    // AFTER setGapStyle, and that precedence is load-bearing rather than
    // incidental: the base above does not exist until a showing plan injects
    // it, so a layer that got a card first would hold it at the base 1 every
    // element has until the sheet landed. One statement apart in one function,
    // which is why it is a comment and a test rather than a mechanism.
    renderUpcomingCard(layer, horizon, config);
    // The card is going to appear, so the Stage gets its Breather. Whether that
    // switch also moved the epoch was settled above, by the phase rule.
    setBreather(true);
    if (rendered) {
      layer.classList.remove(ON_CLASS);
      layer.style.animationDelay = '';
      // A forced layout, and the only thing that makes the two lines above a
      // RESTART rather than nothing at all: without it the class comes off and
      // goes back on within one task, style resolves once, and the browser
      // never sees the animation end — so the card keeps the phase it had while
      // the Pass it is timed against started over, which is #85. Measured by
      // deleting it: the re-seed moved the card's zero-progress moment by 0ms,
      // against 916.7ms on the shipped build. `linkedom` has no layout engine,
      // so `offsetWidth` is `undefined` there — not 0 — and the suite cannot
      // see any of this: it is browser-only, and the reason it looks like a
      // line with no effect.
      void layer.offsetWidth;
    } else if (!layer.classList.contains(ON_CLASS)) {
      // Presence is off and the Horizon has just arrived — which is the normal
      // way round, since the feed resolves the other trains after the render.
      // Switching on from 0% would time the card against this instant instead
      // of against the Pass, so it starts where the Pass has got to by now. One
      // clock read, at the only moment the phase is not already right; nothing
      // per-frame, and nothing that ticks.
      //
      // The floor is NOT skew protection and must never be read as any. This
      // value is written as `animation-delay` on `rt-gap-card`, which runs on
      // the document timeline; measured against the wall-clock build in
      // headless Chrome, driving the skew at the moment the Horizon refills, a
      // backward step floored elapsed to zero and started the card at the top
      // of a cycle the Pass was minutes into — a suspend-resume of -1h put the
      // card over the live Train for 50.7% of the Train's time on stage, and on
      // a 60s Pass a -30s step over 20s elapsed put it there for 100% of the
      // traversal, at full opacity. That is the one failure this module exists
      // to prevent. `now` is monotonic (src/stage-clock.js), so elapsed cannot
      // run backwards; the floor survives only as a guard on a nonsense epoch.
      const elapsed = Math.max(0, (now() - seededAt) / 1000) % schedule.cycleSec;
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
      apply(horizon, true);
    },
    refresh(horizon) {
      apply(horizon, false);
    },
  };
}
