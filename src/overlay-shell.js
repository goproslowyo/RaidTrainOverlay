/**
 * overlay shell: thin wiring only — config → event-feed → lineup-engine →
 * train-renderer. The feed owns fetch resilience: it renders from a
 * last-good cache when RaidPal is down and, with ?refresh, re-renders on a
 * lineup change. Both failure paths log one clear console error; a cold start
 * with no cache renders nothing (an OBS browser source must never show broken UI).
 */
import { parseConfig } from './config.js';
import { startEventFeed } from './event-feed.js';
import { startLiveLinkFeed } from './live-link-feed.js';
import { filterUpcoming, shouldSelfReload, upcomingPages } from './live-link.js';
import { renderUpcomingCard, retireUpcomingCard } from './upcoming-card.js';
import { gapSchedule, windowKeyframes } from './gap-choreography.js';
import { buildTrain } from './lineup-engine.js';
import { renderTrain } from './train-renderer.js';
import { SHIPPED_THEMES } from './themes/registry.js';
import { DEMO_SLUG, DEMO_SPOTLIGHT, makeDemoEvent } from './demo-event.js';
import { decodeLineup } from './lineup-codec.js';
import { makeManualEvent } from './manual-lineup.js';
import { resolveLocale, loadMessages, makeT } from './i18n/index.js';

const config = parseConfig(window.location.search);
const LOADED_AT = Date.now(); // page age, for the Live Link idle self-reload
// Preview/showcase (?preview=1): a static, centred Train (no traversal) for the
// Configurator's live preview and for screenshotting an overlay. Read raw so it
// stays out of the URL schema (parseConfig) and the Configurator's copied link.
config.preview = ['1', 'true', 'on', 'yes'].includes((new URLSearchParams(window.location.search).get('preview') ?? '').toLowerCase());

// Resolve the display locale once and bind a translator onto config: the engine
// and every Theme read their words through config.t / config.locale. ?lang= wins,
// else the browser's preference. Top-level await so the catalog is ready before
// the first render — an OBS source must never flash English then swap.
await applyLocale(resolveLocale(config.lang, navigator.languages));
async function applyLocale(locale) {
  config.locale = locale;
  config.t = makeT(await loadMessages(locale));
  document.documentElement.lang = locale;
}
const container = document.getElementById('train');
// The between-Pass card shares the canvas with a rendered Train, so it cannot
// mount into #train: the card's own render dissolves whatever else holds that
// container, which is the Train. It gets a sibling layer instead — the same
// full-canvas positioning context the anchor grammar expects, never touched by
// the renderer. "Never on stage together" then becomes a timing guarantee
// (the choreography) rather than a lifecycle one (unmounting).
const gapLayer = document.createElement('div');
gapLayer.id = 'gap-card';
gapLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none';
container.insertAdjacentElement('afterend', gapLayer);
// Vertical placement (height param): --train-pos is the height as a
// 0..1 fraction; the renderer's .rt-stage clamps the Train within the canvas so
// it stays fully on-screen (0 = top-flush, 1 = bottom-flush, 0.5 = centred).
container.style.setProperty('--train-pos', String(config.height / 100));
// Size multiplier (scale param): the renderer multiplies the
// --train-height baseline by this; inherits down to the Train SVG.
container.style.setProperty('--train-scale', String(config.scale));

if (!config.event && !config.lineup && !config.user) {
  console.error('RaidTrainOverlay: missing required ?event=<slug>, ?lineup=<blob>, or ?user=<login> query param — nothing to render.');
} else {
  // The most recent Event + its rendered view. The feed re-renders on a lineup
  // change; the time tick re-derives from it; theme=shuffle re-renders with a
  // fresh Theme each cycle.
  let current = null;
  // The other trains, while one is running — the between-Pass card's material.
  let liveHorizon = [];

  // theme=shuffle: cycle the roster pseudo-randomly. A shuffle bag draws every
  // Theme once before any repeat, reshuffles when empty, and never repeats across
  // the seam — fair exposure, no obvious loop. `shownTheme` is the real Theme on
  // screen; `config.theme` stays 'shuffle' as the mode marker.
  const bag = makeShuffleBag(SHIPPED_THEMES);
  let shownTheme = config.theme === 'shuffle' ? bag.next() : config.theme;
  let cycleTimer = null;

  const render = () => {
    if (!current) return;
    // Shuffle's rolling showcase sweeps brisk so each Theme rolls fully past in a few
    // seconds before the next cycles in (a real-speed sweep is ~50s); a single Theme
    // keeps the real roll velocity for study. shuffleRoll only bites under previewRoll.
    const cfg = config.theme === 'shuffle'
      ? { ...config, theme: shownTheme, shuffleRoll: true }
      : config;
    current.view = renderTrain(buildTrain(current.event, new Date(), cfg), container, cfg);
    renderGapCard({ restart: true });
  };
  // The between-Pass card: while a train is live, the Upcoming card pulses into
  // the empty stage between Passes. Presence is ONE generated opacity keyframe
  // on the card's own layer, sharing the Pass period — synchronised with the
  // Train by construction, so it cannot drift over a stream that runs for days,
  // and costing no per-frame JavaScript. Re-applied on every render because a
  // re-render restarts the Train's own keyframe, and the two must stay in phase.
  const clearGapCard = () => {
    retireUpcomingCard(gapLayer);
    gapLayer.classList.remove('rt-gap-card--on');
    // A Breather with nothing to put in it is just the Train vanishing for no
    // reason, so the empty stretch is suppressed whenever the card is not
    // actually going to appear in it. The switch rides the render's own handle,
    // so it always works the Stage that is actually on screen.
    current?.view?.setBreather(false);
  };
  // `restart` re-seeds the card's keyframe from 0%. Only a render does that,
  // because only a render restarts the Train's own keyframe — restarting the
  // card on its own would slide it out of phase with the Pass it is timed
  // against, and it could then appear ON a Train. A horizon refresh therefore
  // repaints the card's contents and leaves the running animation alone; a
  // changed schedule reaches it through the keyframe text, which CSS re-reads
  // without restarting.
  const renderGapCard = ({ restart = false } = {}) => {
    const spec = config.upcoming;
    // Live Link only (nothing else knows other trains), never on an
    // upcoming-only source (that scene shows the card outright), never while
    // nothing is running, and never when the streamer opted out.
    if (!config.user || config.uponly || !spec || !config.upgap
      || !current?.view || liveHorizon.length === 0) return clearGapCard();
    // A Pass gap, or — in marquee, which has none — the Breather the cycle
    // manufactures instead. Same choreography either way; only the source of
    // the empty stretch differs, and the render that built the Stage says which
    // it handed back. A Breather holds exactly one page, and the card's
    // free-running pager is what walks the horizon across successive Breathers.
    const { timing } = current.view;
    if (timing.kind === 'none') return clearGapCard();
    const breather = timing.kind === 'breather';
    const schedule = gapSchedule({
      periodSec: timing.periodSec,
      emptyFromSec: timing.emptyFromSec,
      emptyToSec: timing.emptyToSec,
      pageCount: breather ? 1 : upcomingPages(liveHorizon),
      upcycleSec: config.upcycle,
      style: config.upstyle,
      upscrollSec: config.upscroll,
    });
    // A gap too short for one whole page: the card sits this one out entirely
    // rather than flashing a partial page.
    if (schedule.windows.length === 0) return clearGapCard();
    let style = document.getElementById('rt-gap-card-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'rt-gap-card-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      @keyframes rt-gap-card { ${windowKeyframes(schedule)} }
      .rt-gap-card--on { animation: rt-gap-card ${schedule.cycleSec}s linear infinite; }
      @media (prefers-reduced-motion: reduce) {
        /* The whole occasion IS the motion: a card that pulses in and out over
           a live stream. Reduced motion keeps the Train and drops the pulse
           rather than leaving the card parked over the Train at full opacity. */
        .rt-gap-card--on { animation: none; opacity: 0; }
      }`;
    renderUpcomingCard(gapLayer, liveHorizon, config);
    current.view.setBreather(true);
    if (restart) {
      gapLayer.classList.remove('rt-gap-card--on');
      void gapLayer.offsetWidth; // commit, so the restart re-seeds with the Pass
    }
    gapLayer.classList.add('rt-gap-card--on');
  };

  const cycle = () => {
    if (config.theme !== 'shuffle') return;
    shownTheme = bag.next();
    render();
  };
  // When to swap to the next Theme. A swap that rides an animation boundary lets the
  // fresh Theme roll all the way in; a timer suits a Train that isn't traversing:
  //   - Pass overlay: ride the off-screen Pass boundary (rt-pass iteration, below).
  //   - Rolling preview: ride the end of each sweep (rt-preview-roll iteration, below),
  //     so a new Theme gets a whole roll-in instead of being cut off mid-roll.
  //   - Still preview (no traversal) + Marquee overlay (no seam): swap on a timer.
  // The iteration listener is permanent + re-checks config, so it survives preview tweaks.
  const applyCadence = () => {
    if (cycleTimer) { clearInterval(cycleTimer); cycleTimer = null; }
    if (config.theme !== 'shuffle') return;
    if (config.preview && !config.previewRoll) {
      cycleTimer = setInterval(cycle, 5_000);
    } else if (!config.preview && config.mode === 'marquee') {
      cycleTimer = setInterval(cycle, Math.max((config.interval || 15) * 60_000, 60_000));
    }
  };
  container.addEventListener('animationiteration', (event) => {
    if (config.theme !== 'shuffle') return;
    // Pass overlay swaps at the off-screen Pass boundary; a rolling preview swaps at the
    // end of each sweep — both give the next Theme a full, uninterrupted roll-in.
    if (event.animationName === 'rt-pass' && !config.preview && config.mode !== 'marquee') cycle();
    else if (event.animationName === 'rt-preview-roll' && config.preview && config.previewRoll) cycle();
  });

  if (config.user) {
    // Live Link: the most specific source wins — one URL keyed to a login that
    // auto-resolves the live/next train. The feed owns which train renders and
    // its effective (mapping-merged) config; the shell just applies each switch.
    if (config.event || config.lineup) {
      console.warn('RaidTrainOverlay: ?user= (Live Link) overrides ?event=/?lineup= — ignoring them.');
    }
    startLiveLinkFeed(window.location.search, {
      fetchImpl: globalThis.fetch.bind(globalThis),
      storage: window.localStorage,
      async onSwitch(slug, effective) {
        // Swap the per-train effective config in wholesale (the preview-path
        // pattern), then re-derive everything config-driven.
        Object.assign(config, effective, { preview: config.preview });
        const nextLocale = resolveLocale(config.lang, navigator.languages);
        if (nextLocale !== config.locale) await applyLocale(nextLocale);
        container.style.setProperty('--train-pos', String(config.height / 100));
        container.style.setProperty('--train-scale', String(config.scale));
        if (config.theme === 'shuffle') shownTheme = bag.next();
        applyCadence();
      },
      onEvent(event) {
        current = { event, view: null };
        // Retire any Upcoming-card state FIRST, every time: it cancels pending
        // dissolve/mount timers (which would wipe or cover the Train after it
        // renders) and starts a standing panel's exit fade — the same manners
        // as the Train dissolving before the panel (upcoming-card.js). The
        // returned wait is that farewell; 0 means render right now.
        const wait = retireUpcomingCard(container);
        if (wait > 0) setTimeout(render, wait);
        else render();
      },
      onIdle({ upcoming }) {
        // Nothing live and nothing near departure. Idle is the ONLY safe
        // moment to self-heal: reload the page once it's over an hour old
        // (JS-leak insurance for always-on sources) — never mid-render,
        // never inside the T-60 lead.
        if (shouldSelfReload({ loadedAt: LOADED_AT, now: Date.now() })) {
          window.location.reload();
          return;
        }
        // Default: fully empty — an ended train must never roll over a live
        // stream. With ?upcoming=, the compact card lists the next trains.
        // An upcoming-only source (?uponly=1) exists to show the card, so an
        // absent horizon falls back to the next 3 instead of nothing.
        const spec = config.upcoming ?? (config.uponly ? { kind: 'count', n: 3 } : null);
        // The gap card belongs to a running train, and none is running. Cleared
        // BEFORE `current` is dropped, because the Breather switch rides that
        // render's handle — it is the Stage still on screen that must be let back
        // up, and after the drop there is nothing left to switch.
        clearGapCard();
        current = null;
        liveHorizon = [];
        renderUpcomingCard(container, filterUpcoming(upcoming, spec, new Date()), config);
      },
      onHorizon({ upcoming }) {
        // A train is running, and these are the OTHER trains — the material the
        // between-Pass card shows in the gaps. Held here, on the sibling layer,
        // so the card can be mounted without disturbing the Train.
        liveHorizon = filterUpcoming(upcoming, config.upcoming ?? null, new Date());
        renderGapCard();
      },
      onError(err) {
        const state = current ? 'showing the last-good state' : 'nothing rendered yet';
        console.error(`RaidTrainOverlay: Live Link for "${config.user}" — ${state}.`, err);
      },
    });
  } else if (config.event === DEMO_SLUG) {
    // Built-in demo lineup (event=demo): a contrived Event rendered with no RaidPal
    // fetch — so the preview/landing page always has something live-looking to show.
    // Spotlight the demo VIPs unless the viewer set their own spotlight.
    if (config.spotlight.length === 0) config.spotlight = DEMO_SPOTLIGHT;
    current = { event: makeDemoEvent(new Date()), view: null };
    render();
  } else if (config.event) {
    startEventFeed(config.event, config, {
      fetchImpl: globalThis.fetch.bind(globalThis),
      storage: window.localStorage,
      onEvent(event) {
        current = { event, view: null };
        render();
      },
      onError(err) {
        const state = current ? 'showing the last-good lineup' : 'nothing rendered yet';
        console.error(`RaidTrainOverlay: RaidPal fetch for "${config.event}" failed — ${state}.`, err);
      },
    });
  } else {
    // Hand-built lineup (?lineup=): decode the URL blob and synthesize the Event with
    // NO RaidPal fetch — the same synchronous render path as the demo. A bad/oversized
    // blob decodes to null and renders nothing (never broken UI), as the codec promises.
    const model = decodeLineup(config.lineup);
    if (!model) {
      console.error('RaidTrainOverlay: ?lineup= blob could not be decoded — nothing to render.');
    } else {
      current = { event: makeManualEvent(model, new Date()), view: null };
      render();
    }
  }
  applyCadence();

  // Time-state tick: re-derive from the already-loaded Event — no refetch. 30s
  // keeps minute-granularity times at most 30s stale, and the in-place update
  // never restarts a running Mode (or shuffle) animation.
  setInterval(() => {
    if (current?.view) current.view.updateTime(buildTrain(current.event, new Date(), config));
  }, 30_000);

  // Configurator live preview (preview=1 only): re-render in place from a config
  // pushed by the parent page — no iframe reload and no refetch, so flipping a
  // theme or knob is instant and nothing trips a browser's auto-hidden chrome
  // (e.g. Zen's sidebar reacting to an iframe navigation). Guarded to same-origin
  // + the preview flag, so it can never affect a real OBS overlay.
  if (config.preview) {
    window.addEventListener('message', async (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'rto-preview-pause') {
        // Freeze/resume the roll sweep IN PLACE: pause only the Track's traversal
        // animation, so the Train holds position while the wheels + undulation keep
        // running (running on the spot). No re-render — that would reset the sweep.
        const track = container.querySelector('.rt-track');
        if (track) track.style.animationPlayState = event.data.paused ? 'paused' : 'running';
        return;
      }
      if (event.data?.type !== 'rto-preview') return;
      const wasShuffle = config.theme === 'shuffle';
      Object.assign(config, parseConfig(event.data.query), { preview: true });
      // A locale change in the Configurator re-loads the catalog before re-render
      // (rare + deliberate, so the async reload is fine here).
      const nextLocale = resolveLocale(config.lang, navigator.languages);
      if (nextLocale !== config.locale) await applyLocale(nextLocale);
      if (config.event === DEMO_SLUG && config.spotlight.length === 0) config.spotlight = DEMO_SPOTLIGHT;
      config.previewRoll = !!event.data.roll; // still showcase ⇄ rolling sweep
      container.style.setProperty('--train-pos', String(config.height / 100));
      container.style.setProperty('--train-scale', String(config.scale));
      if (config.theme === 'shuffle' && !wasShuffle) shownTheme = bag.next();
      applyCadence();
      render();
    });
  }
}

/** Pseudo-random fair Theme order: every Theme appears once per bag before any
 *  repeat; the bag reshuffles when empty and avoids repeating across the seam. */
function makeShuffleBag(items) {
  let bag = [];
  let last = null;
  return {
    next() {
      if (bag.length === 0) {
        bag = items.slice();
        for (let i = bag.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag[0] === last && bag.length > 1) [bag[0], bag[1]] = [bag[1], bag[0]];
      }
      last = bag.shift();
      return last;
    },
  };
}
