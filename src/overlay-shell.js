/**
 * overlay shell: thin wiring only — config → event-feed → lineup-engine →
 * train-renderer. The feed owns fetch resilience: it renders from a
 * last-good cache when RaidPal is down and, with ?refresh, re-renders on a
 * lineup change. Both failure paths log one clear console error; a cold start
 * with no cache renders nothing (an OBS browser source must never show broken UI).
 *
 * The **Stage choreography** — the Train and the Upcoming card never sharing
 * the Stage — is gap-card.js's, layer and keyframes and Breather switch and
 * all. The shell only reports the two events that move it: a render happened,
 * or the Horizon changed.
 */
import { parseConfig } from './config.js';
import { startEventFeed } from './event-feed.js';
import { startLiveLinkFeed } from './live-link-feed.js';
import { filterUpcoming, shouldSelfReload } from './live-link.js';
import { renderUpcomingCard, retireUpcomingCard } from './upcoming-card.js';
import { createGapCard } from './gap-card.js';
import { buildTrain } from './lineup-engine.js';
import { renderTrain } from './train-renderer.js';
import { SHIPPED_THEMES, isThemeLoaded, loadTheme } from './themes/registry.js';
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

// theme=shuffle: cycle the roster pseudo-randomly. A shuffle bag draws every
// Theme once before any repeat, reshuffles when empty, and never repeats across
// the seam — fair exposure, no obvious loop. `shownTheme` is the real Theme on
// screen; `config.theme` stays 'shuffle' as the mode marker.
//
// This sits ABOVE the locale await below because of the line under it: the art
// is only fetched when someone asks (#89), and asking here puts the request in
// parallel with the catalog and every fetch the feed will make, rather than
// queued behind them. Measured at 7 ms on loopback, where a round trip costs
// nothing — on a real link it is a whole one, at first paint. Not awaited:
// `render` copes if the art has not landed, so this only ever decides whether
// the first paint waits in parallel or in series.
const bag = makeShuffleBag(SHIPPED_THEMES);
let shownTheme = config.theme === 'shuffle' ? bag.next() : config.theme;
loadTheme(shownTheme).catch(() => {}); // the real report is in `render`'s deferral

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
// The between-Pass card: while a train is live, the Upcoming card pulses into
// the empty stage between Passes. Everything that guarantee rests on — its own
// layer beside the Train, the generated opacity keyframe, the card mount and
// the Breather switch — belongs to this module, which takes the same live
// `config` object the rest of the shell re-derives from.
const gapCard = createGapCard({ container, config });
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

  let cycleTimer = null;

  // A Theme's art failing to arrive is a network fault like any other: say so
  // once and leave what is on the Stage alone. An OBS source must never show
  // broken UI, so it must never show a half-torn-down one either.
  const reportArt = (key) => (err) => console.error(
    `RaidTrainOverlay: the "${key}" Theme's art could not be loaded — leaving the Stage as it is.`, err,
  );

  const render = () => {
    if (!current) return;
    // Shuffle's rolling showcase sweeps brisk so each Theme rolls fully past in a few
    // seconds before the next cycles in (a real-speed sweep is ~50s); a single Theme
    // keeps the real roll velocity for study. shuffleRoll only bites under previewRoll.
    const cfg = config.theme === 'shuffle'
      ? { ...config, theme: shownTheme, shuffleRoll: true }
      : config;
    // The art is fetched on demand (#89). If it has not arrived, this render
    // DEFERS — and defers through its own front door, so the retry re-checks
    // `current` (and the Theme showing by then) in the same turn it paints in.
    // Nothing has been torn down at this point: the container still shows
    // whatever it showed, and if the feed goes idle while the art is in flight,
    // the retry's `if (!current) return` stops the stale paint dead. That is
    // exactly the property an `await` inside renderTrain would destroy — see
    // resolveTheme's note.
    if (!isThemeLoaded(cfg.theme)) {
      loadTheme(cfg.theme).then(render, reportArt(cfg.theme));
      return;
    }
    current.view = renderTrain(buildTrain(current.event, new Date(), cfg), container, cfg);
    // A render re-seeded the Train's own keyframe, so the card's is re-seeded
    // with it — the handle carries both the timing it must share and the
    // Breather switch bound to the Stage just built.
    gapCard.restart(current.view, liveHorizon);
  };

  const cycle = () => {
    if (config.theme !== 'shuffle') return;
    shownTheme = bag.next();
    render();
    // Warm the NEXT Theme while this one is on screen, so the swap itself never
    // waits on the network — the deferral above is the safety net, not the plan.
    loadTheme(bag.peek()).catch(() => {});
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
        // The gap card belongs to a running train, and none is running: hand the
        // choreographer no Stage at all. It lets the outgoing one back up out of
        // its Breather on the way past, so the drop below can happen in any order.
        gapCard.restart(null, []);
        current = null;
        liveHorizon = [];
        renderUpcomingCard(container, filterUpcoming(upcoming, spec, new Date()), config);
      },
      onHorizon({ upcoming }) {
        // A train is running, and these are the OTHER trains — the material the
        // between-Pass card shows in the gaps. A refresh, never a restart: the
        // Train's keyframe did not move, so the card's must not either.
        liveHorizon = filterUpcoming(upcoming, config.upcoming ?? null, new Date());
        gapCard.refresh(liveHorizon);
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
  const refill = () => {
    if (bag.length > 0) return;
    bag = items.slice();
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag[0] === last && bag.length > 1) [bag[0], bag[1]] = [bag[1], bag[0]];
  };
  return {
    next() {
      refill();
      last = bag.shift();
      return last;
    },
    /** Which Theme `next()` would draw — so the art can be warmed before the
     *  swap needs it. Refills first, so a peek at an empty bag is still an
     *  answer and not a null the caller has to special-case. */
    peek() {
      refill();
      return bag[0];
    },
  };
}
