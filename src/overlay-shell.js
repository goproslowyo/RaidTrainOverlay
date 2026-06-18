/**
 * overlay shell: thin wiring only — config → event-feed → lineup-engine →
 * train-renderer. The feed owns fetch resilience: it renders from a
 * last-good cache when RaidPal is down and, with ?refresh, re-renders on a
 * lineup change. Both failure paths log one clear console error; a cold start
 * with no cache renders nothing (an OBS browser source must never show broken UI).
 */
import { parseConfig } from './config.js';
import { startEventFeed } from './event-feed.js';
import { buildTrain } from './lineup-engine.js';
import { renderTrain, SHIPPED_THEMES } from './train-renderer.js';
import { DEMO_SLUG, DEMO_SPOTLIGHT, makeDemoEvent } from './demo-event.js';
import { resolveLocale, loadMessages, makeT } from './i18n/index.js';

const config = parseConfig(window.location.search);
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
// Vertical placement (height param): --train-pos is the height as a
// 0..1 fraction; the renderer's .rt-stage clamps the Train within the canvas so
// it stays fully on-screen (0 = top-flush, 1 = bottom-flush, 0.5 = centred).
container.style.setProperty('--train-pos', String(config.height / 100));
// Size multiplier (scale param): the renderer multiplies the
// --train-height baseline by this; inherits down to the Train SVG.
container.style.setProperty('--train-scale', String(config.scale));

if (!config.event) {
  console.error('RaidTrainOverlay: missing required ?event=<slug> query param — nothing to render.');
} else {
  // The most recent Event + its rendered view. The feed re-renders on a lineup
  // change; the time tick re-derives from it; theme=shuffle re-renders with a
  // fresh Theme each cycle.
  let current = null;

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

  if (config.event === DEMO_SLUG) {
    // Built-in demo lineup (event=demo): a contrived Event rendered with no RaidPal
    // fetch — so the preview/landing page always has something live-looking to show.
    // Spotlight the demo VIPs unless the viewer set their own spotlight.
    if (config.spotlight.length === 0) config.spotlight = DEMO_SPOTLIGHT;
    current = { event: makeDemoEvent(new Date()), view: null };
    render();
  } else {
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
