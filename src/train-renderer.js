/**
 * train-renderer: the Theme host. Owns the Theme-agnostic shell — the Stage
 * (vertical position), the Track (Mode traversal), and the marquee copies — and
 * dispatches the actual art to a Theme by `config.theme`.
 *
 * Two motion layers: the Mode traversal here translates the whole
 * Train across a stationary Track; each Theme owns its ambient animation (wheel
 * spin, smoke, per-Car undulation), which the base CSS below provides the shared
 * keyframes for. Adding a Theme touches only src/themes/ and the registry.
 */
import classic from './themes/classic.js';
import flat from './themes/flat.js';
import synthwave from './themes/synthwave.js';
import ticket from './themes/ticket.js';
import wood from './themes/wood.js';
import comic from './themes/comic.js';
import departures from './themes/departures.js';
import paper from './themes/paper.js';
import tron from './themes/tron.js';
import pixel from './themes/pixel.js';
import highvibes from './themes/highvibes.js';
import jazz from './themes/jazz.js';
import bullet from './themes/bullet.js';
import lava from './themes/lava.js';
// A Theme registers the same way whether it is a single file (./themes/<key>.js) or
// a folder that bundles its own assets (./themes/<key>/index.js) — both are ES
// modules with a default export. `starter` is the folder form: the
// authoring-guide reference Theme (docs/authoring-a-theme.md), which bundles
// badge.svg and resolves it via import.meta.url (subpath-safe, no build step).
import starter from './themes/starter/index.js';

/** The shipped Theme roster; a key must match config's `theme` enum to be selectable
 *  via the URL/Configurator. Single-file and folder-form Themes register identically.
 *  `starter` is registered (renderable via the manual harness #theme=starter) but
 *  kept out of the user-facing enum — it is the authoring reference, not a roster Theme. */
export const THEMES = { classic, flat, synthwave, ticket, wood, comic, departures, paper, tron, pixel, highvibes, jazz, bullet, lava, starter };

/** config.theme → Theme, falling back to classic for unknown/unshipped keys. */
export function resolveTheme(key) {
  return THEMES[key] ?? THEMES.classic;
}

/** The roster offered for selection + `theme=shuffle` cycling — every Theme
 *  except `starter` (an authoring reference, not a roster Theme). */
export const SHIPPED_THEMES = Object.keys(THEMES).filter((key) => key !== 'starter');

/**
 * Theme-agnostic CSS, injected once. The Stage owns vertical position
 * (translateY); the Track owns the Mode's horizontal motion (translateX) —
 * separate elements so the two transforms never clobber each other. The ambient
 * primitives (undulation, wheel spin, smoke, pointer bob) are shared keyframes
 * every Theme's markup hooks into; reduced-motion disables them.
 */
function ensureBaseStyles() {
  if (document.getElementById('rt-train-style')) return;
  const style = document.createElement('style');
  style.id = 'rt-train-style';
  style.textContent = `
    .rt-stage {
      position: absolute;
      left: 0;
      right: 0;
      /* Effective Train height = the --train-height baseline (overlay.html) ×
         the --train-scale multiplier (scale param). */
      --rt-th: calc(var(--train-height, 28vh) * var(--train-scale, 1));
      /* Clamp the Train within the canvas: --train-pos (0..1, the
         height param / 100) places it from top-flush (0) to bottom-flush (1),
         centred at 0.5. The Train is always fully on-canvas and a lower-third
         stays put when resized — no centre-anchored vertical clip. */
      top: calc(var(--train-pos, 0.5) * (100vh - var(--rt-th)));
    }
    .rt-track {
      display: flex;
      align-items: center;
      width: max-content;
      /* Modes animate transform only — one composited layer, no layout work. */
      will-change: transform;
      /* Sit above the stationary Track. will-change already makes a stacking
         context, but z-index on a static box is ignored, so position it. */
      position: relative;
      z-index: 1;
    }
    /* The stationary Track (rails/ties) the Train rolls over:
       a full-canvas-width sibling of .rt-track, painted behind the Train and never
       given the Mode transform. The Theme owns its look + vertical placement (it
       inherits --rt-th here); this only fixes it stationary, full-width, behind. */
    .rt-rails {
      position: absolute;
      left: 0;
      width: 100vw;
      z-index: 0;
      pointer-events: none;
    }
    .rt-track > svg {
      flex: none;
      /* width:auto keeps the aspect ratio, so everything inside the viewBox
         scales together with the effective height. */
      height: var(--rt-th);
      width: auto;
      /* Let an undulating edge Car (Caboose right / Engine left) draw past the
         viewBox instead of being clipped by the SVG's own bounds. The
         viewBox has vertical headroom but no horizontal margin, and the layout
         box (which the marquee/pass timing measure via getBoundingClientRect)
         stays the viewBox width — so spacing is unchanged; only the few px of
         sway bleed past, into the wide marquee gap (the canvas edge still clips
         via overlay.html's overflow:hidden). Theme-agnostic: every Theme shares
         this undulation, so the headroom belongs here, not per-Theme. */
      overflow: visible;
    }

    /* The Now Marker pointer is always rendered; the current Car reveals it. */
    .rt-pointer { visibility: hidden; }
    .rt-car--current .rt-pointer { visibility: visible; }

    /* Conductor badge: pinned by the renderer over the Engine (every Theme), so the
       Organiser driving the loco reads clearly. Understated — a muted pill, not a
       bright slab, so it marks without overpowering the art. */
    .rt-lead {
      position: absolute; z-index: 5; pointer-events: none; white-space: nowrap;
      /* Anchored at the loco body top (pinLeadBadges); -108% sits the badge a small,
         size-scaled gap just above it — no longer floating high off the old -118%. */
      transform: translate(-50%, -108%);
      font: 700 calc(var(--rt-th) / 19) system-ui, "Segoe UI", sans-serif; letter-spacing: 0.08em;
      padding: 0.12em 0.6em; border-radius: 1em; background: rgba(18, 20, 26, 0.8);
      color: #f6cf5a; border: 1px solid rgba(244, 196, 48, 0.45); box-shadow: 0 0.1em 0.3em #0006;
    }
    /* Once the whole Event is over, the lead loco dims deeper than a played coach,
       so it reads clearly as finished (a played coach stays light + stamped). */
    .rt-stage [data-engine].rt-car--departed { opacity: 0.45; }
    /* The locomotive IS the organiser — it has no Slot, so it never "plays" one and
       must never carry a per-slot stamp. Some Themes render their stamp inside every
       car (incl. the loco) and reveal it on .rt-car--departed; post-event the engine
       gets that class (to dim, above) and the stamp would ride along. Suppress any
       stamp on the engine here, Theme-agnostically: every Theme names its stamp
       *-stamp (cl-stamp, hv-stamp, tk-stamp, dp-stamp, …). The engine still dims;
       it just isn't stamped. (Coaches are unaffected — this is scoped to [data-engine].) */
    .rt-stage [data-engine] [class*="-stamp"] { display: none !important; visibility: hidden !important; }

    /* Ambient animation: per-Car undulation, spinning spoked wheels,
       puffing smoke, and the Now Marker's bob. Compositor-only (transform/opacity).
       Undulation is a gentle side-to-side SWAY + a small ROCK about the wheel line
       — never a vertical bob (a train rides the rails, it doesn't bounce off them).
       transform-box/-origin pin the rock to each Car's own wheels so it can't turn
       into a position-dependent "wave" across the whole Train. The per-Car phase
       stagger (set after attach, softened in undulate() for long Trains) makes
       neighbours flex like an accordion without an exaggerated wave down the tail. */
    .rt-car {
      transform-box: fill-box; transform-origin: 50% 94%;
      animation: rt-undulate var(--rt-period, 3s) ease-in-out infinite;
    }
    /* Organic per-Car undulation. Sway (translateX) peaks at 0/50/100%
       and rock (rotate about the wheel line) at 25/75% — decorrelated WITHIN the
       cycle, so a Car rolls instead of sway-rocking in lock-step. Amplitude
       (--rt-sway/--rt-rock), period (--rt-period) and phase (animation-delay) are
       per-Car, set by undulate() with stable-random variation and scaled by the
       per-Theme Ride character (--rt-ride); that per-Car period spread is what
       decoheres the old mechanical travelling-wave. */
    @keyframes rt-undulate {
      0%   { transform: translateX(var(--rt-sway, 2.5px)) rotate(0deg); }
      25%  { transform: translateX(0) rotate(var(--rt-rock, 0.6deg)); }
      50%  { transform: translateX(calc(-1 * var(--rt-sway, 2.5px))) rotate(0deg); }
      75%  { transform: translateX(0) rotate(calc(-1 * var(--rt-rock, 0.6deg))); }
      100% { transform: translateX(var(--rt-sway, 2.5px)) rotate(0deg); }
    }
    .rt-wheel { transform-box: fill-box; transform-origin: 50% 50%; animation: rt-spin 2.1s linear infinite; }
    @keyframes rt-spin { to { transform: rotate(-360deg); } }
    /* transform-box/-origin pin each puff's scale to its OWN centre; without them
       an SVG puff scales about the viewBox origin, so it drifts back toward the
       chimney as it shrinks — reading as smoke going IN, not out (restores the
       mockup's .rt-smoke>* rule). */
    .rt-smoke > * { transform-box: fill-box; transform-origin: center; animation: rt-puff 2.1s ease-out infinite; opacity: 0; }
    .rt-smoke > *:nth-child(2) { animation-delay: 0.42s; }
    .rt-smoke > *:nth-child(3) { animation-delay: 0.84s; }
    .rt-smoke > *:nth-child(4) { animation-delay: 1.26s; }
    .rt-smoke > *:nth-child(5) { animation-delay: 1.68s; }
    @keyframes rt-puff {
      0% { transform: translateY(4px) scale(0.45); opacity: 0.9; }
      100% { transform: translateY(-30px) scale(1.55); opacity: 0; }
    }
    .rt-now-bob { animation: rt-bob 1.1s ease-in-out infinite; }
    @keyframes rt-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

    @media (prefers-reduced-motion: reduce) {
      .rt-car, .rt-wheel, .rt-smoke > *, .rt-now-bob { animation: none !important; }
      .rt-smoke > * { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/** Per-render generated keyframes (durations depend on measured track width). */
function setModeStyle(cssText) {
  let style = document.getElementById('rt-train-mode-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'rt-train-mode-style';
    document.head.appendChild(style);
  }
  style.textContent = cssText;
}

// Base traversal velocity: 5.4% of the canvas width per second, times `speed`.
// Viewport-relative like everything else: the same Event crosses a
// 720p and a 1080p source in the same wall-clock time. Eased 10% → 8% → 6% → 5.4%
// (the last after real-OBS testing) so a Broadcaster's name is readable
// as the Train rolls by; `speed` scales from here, default 1 = this pace.
const BASE_VELOCITY_VW_PER_SEC = 0.054;
// Gap between marquee Train copies, as a fraction of the canvas width.
const MARQUEE_GAP_VW = 0.04;

/**
 * Start the Mode animation on the track. Reads layout once (one measure, then
 * writes) — keyframes are generated because durations depend on Train length.
 *
 * `mode=pass`: one infinite animation whose period is the Pass interval; the
 * traversal occupies the leading fraction of the keyframes and the Train holds
 * off-screen for the rest, so "one Pass every N minutes" is pure CSS — no
 * timers to drift or be throttled. An interval shorter than the traversal
 * clamps to back-to-back Passes.
 *
 * `mode=marquee`: enough Train copies to cover the canvas plus one, translated
 * by exactly one repeating unit (copy + gap) per loop — at the loop point the
 * next copy occupies the first one's start position, so the jump is invisible.
 */
function applyMode(track, config, buildCopy) {
  // Preview ROLL (Configurator + preview page): a continuous right-to-left sweep so you
  // can watch the whole Train roll past, looping at once rather than waiting the Pass
  // interval (minutes). A single Theme rolls at the real traversal velocity; Shuffle's
  // showcase rolls brisk so each Theme sweeps fully past in a few seconds before the
  // next cycles in. Mode-agnostic; it just shows the motion and the art rolling by.
  if (config?.previewRoll) {
    const rollSpeed = config?.speed > 0 ? config.speed : 1;
    const boost = config?.shuffleRoll ? 3 : 1;
    const vw = window.innerWidth;
    const rollVelocity = BASE_VELOCITY_VW_PER_SEC * vw * rollSpeed * boost;
    const sweepSec = (track.getBoundingClientRect().width + vw) / rollVelocity;
    setModeStyle(`
      @keyframes rt-preview-roll {
        from { transform: translateX(100vw); }
        to { transform: translateX(-100%); }
      }
      .rt-track--proll { animation: rt-preview-roll ${sweepSec}s linear infinite; }
    `);
    track.style.transform = 'translateX(100vw)';
    track.classList.add('rt-track--proll');
    return;
  }

  // Preview/showcase (?preview=1): a STILL, centred Train that never traverses, so
  // the whole Train is visible to study (or screenshot). The per-Car ambient motion
  // (undulation, wheels, smoke) still plays — only the Mode traversal is suppressed.
  if (config?.preview) {
    const trackWidth = track.getBoundingClientRect().width;
    const tx = Math.max((window.innerWidth - trackWidth) / 2, 8);
    track.style.transform = `translateX(${tx}px)`;
    return;
  }

  const speed = config?.speed > 0 ? config.speed : 1;
  const viewportWidth = window.innerWidth;
  const velocity = BASE_VELOCITY_VW_PER_SEC * viewportWidth * speed;

  if (config?.mode === 'marquee') {
    const gapPx = MARQUEE_GAP_VW * viewportWidth;
    track.style.gap = `${MARQUEE_GAP_VW * 100}vw`;
    const unitWidth = track.getBoundingClientRect().width + gapPx;
    const copies = Math.max(2, Math.ceil(viewportWidth / unitWidth) + 1);
    for (let i = 1; i < copies; i += 1) track.appendChild(buildCopy());
    setModeStyle(`
      @keyframes rt-marquee {
        from { transform: translateX(0); }
        to { transform: translateX(${-unitWidth}px); }
      }
      .rt-track--marquee { animation: rt-marquee ${unitWidth / velocity}s linear infinite; }
    `);
    track.classList.add('rt-track--marquee');
    return;
  }

  const intervalMins = config?.interval > 0 ? config.interval : 15;
  const trackWidth = track.getBoundingClientRect().width;
  const traversalSec = (trackWidth + viewportWidth) / velocity;
  const periodSec = Math.max(intervalMins * 60, traversalSec);
  const holdFrom = (traversalSec / periodSec) * 100;
  // visibility flips to hidden exactly at the hold boundary so the held-off-screen
  // Train can't peek back into view: at translateX(-100%) the Caboose's trailing
  // edge sits at the left viewport edge, and its ambient sway (plus the edge-Car
  // overflow:visible bleed) would otherwise show a stray sliver during the hold.
  // The CSS visibility step keeps it `visible` through the whole traversal (0→hold)
  // and only goes `hidden` for the off-screen hold (hold→100); 0% restores visible.
  let css = `
    @keyframes rt-pass {
      0% { transform: translateX(100vw); visibility: visible; }
      ${holdFrom}%, 100% { transform: translateX(-100%); visibility: hidden; }
    }
    .rt-track--pass { animation: rt-pass ${periodSec}s linear infinite; }
  `;
  // Periodic Track visibility (track=periodic): fade the stationary rails OUT
  // during the off-screen hold between Passes, and back IN just before the next
  // Pass enters — so the Overlay goes fully empty between Passes. Opacity-only,
  // on the same period as rt-pass (own animation name, so the shuffle
  // rt-pass-boundary listener ignores it). The Track never moves: this is a fade,
  // not a slide. A no-op when the Theme draws no rails, or when the interval is
  // so short there's effectively no gap to fade into.
  const rails = track.parentElement?.querySelector('.rt-rails');
  const holdPct = 100 - holdFrom; // the empty gap, as a % of the period
  if (config?.track === 'periodic' && rails && holdPct > 1) {
    // Fade durations (seconds) come from config — trackfadein / trackfadeout,
    // default 15 in / 10 out — each clamped to ≤40% of the gap so a sliver of
    // true-empty always survives even at short intervals (graceful degradation).
    const fadeInSec = Number.isFinite(config?.trackfadein) ? config.trackfadein : 15;
    const fadeOutSec = Number.isFinite(config?.trackfadeout) ? config.trackfadeout : 10;
    const fadeOutPct = Math.min((fadeOutSec / periodSec) * 100, 0.4 * holdPct);
    const fadeInPct = Math.min((fadeInSec / periodSec) * 100, 0.4 * holdPct);
    // The looping keyframe only fades in AHEAD of later Passes (its tail leads into
    // the next Pass), so on load — and on every shuffle re-render — the rails would
    // pop in at full opacity on the FIRST roll. A one-shot intro fades them up as that
    // first Train rolls in, over the same duration, capped at the traversal so it hands
    // opacity off to the loop (which holds 1 while the Train crosses) with no jump. It's
    // listed last so it wins over the loop while it runs; skipped when fade-in is 0.
    const introSec = Math.min((fadeInPct / 100) * periodSec, traversalSec);
    const intro = fadeInSec > 0;
    css += `
      @keyframes rt-rails-periodic {
        0%, ${holdFrom}% { opacity: 1; }
        ${holdFrom + fadeOutPct}%, ${100 - fadeInPct}% { opacity: 0; }
        100% { opacity: 1; }
      }
      ${intro ? '@keyframes rt-rails-intro { from { opacity: 0; } to { opacity: 1; } }' : ''}
      .rt-rails--periodic { animation: rt-rails-periodic ${periodSec}s linear infinite${intro ? `, rt-rails-intro ${introSec}s linear` : ''}; }
    `;
    rails.classList.add('rt-rails--periodic');
  }
  setModeStyle(css);
  // Frame one is off-screen right — a Pass begins immediately on load.
  track.style.transform = 'translateX(100vw)';
  track.classList.add('rt-track--pass');
}

/**
 * Render the Train into `container`, replacing previous content. The selected
 * Theme builds the art; this host wires up the Stage/Track and the Mode. Built
 * once; the returned handle updates time state in place (per copy) so a timer
 * tick never restarts a running Mode or ambient animation. Structural changes
 * (lineup edits) call renderTrain again — an animation restart is fine there.
 */
export function renderTrain(train, container, config) {
  const theme = resolveTheme(config?.theme);
  ensureBaseStyles();
  theme.ensureStyles();
  container.replaceChildren();

  // The Stage fixes vertical position (height param → translateY); the Track
  // carries the Mode's horizontal motion (translateX). The Train never moves
  // within the Track. Two elements so the transforms compose without clobbering.
  const stage = document.createElement('div');
  stage.className = 'rt-stage';
  const track = document.createElement('div');
  track.className = 'rt-track';

  // tz zone count reserves vertical room for the stacked time block per Car.
  const maxTimeLines = config?.tz?.length || 1;
  // Every built copy (the first, plus any marquee duplicates) is collected so a
  // time tick updates all of them — and afterAttach runs once each are in the DOM.
  const built = [];
  const buildCopy = () => {
    const copy = theme.build(train, { config, maxTimeLines });
    built.push(copy);
    return copy.node;
  };
  track.appendChild(buildCopy());
  // The stationary Track (rails/ties) the Train rolls over.
  // Built once — never inside buildCopy, so marquee never duplicates it — and added
  // as a sibling behind .rt-track (a Theme may omit it; the renderer tolerates that).
  const rails = theme.buildTrack?.({ config, maxTimeLines });
  if (rails) stage.appendChild(rails);
  stage.appendChild(track);
  container.appendChild(stage);
  applyMode(track, config, buildCopy);
  requestAnimationFrame(() => {
    for (const copy of built) copy.afterAttach?.();
    pinLeadBadges(track, config);
  });

  return {
    /** In-place time-state update: classes and text only, never structure. */
    updateTime(nextTrain) {
      for (const copy of built) copy.update(nextTrain);
    },
  };
}

/** Pin a LEAD badge over each Engine Car (incl. marquee copies) so the first
 *  streamer reads clearly as the lead on any Theme. It lives in the moving Track
 *  so it rides along, and is measured after layout so it sits over the loco art
 *  whatever shape the Theme drew. */
function pinLeadBadges(track, config) {
  const conductor = config?.t ? config.t('overlay.conductor') : 'CONDUCTOR';
  const trackRect = track.getBoundingClientRect();
  for (const engine of track.querySelectorAll('[data-engine]')) {
    // Anchor the badge to the loco BODY itself — the `-art` group, which is the loco's
    // drawn body and (crucially) EXCLUDES the smoke/front layers and the always-in-DOM
    // (hidden) NOW pointer that inflate the car's bounding box. Earlier this anchored to
    // the first COACH's top, but that line varies per Theme and is polluted by those
    // hidden/tall elements, so the badge floated far above the loco (comic/paper/bullet)
    // or dropped onto a coach's sign (departures). The body top + a small CSS gap
    // (translateY in .rt-lead) puts it a consistent hair above every loco. Falls back to
    // the whole car only for Themes with no `-art` group (their car top is the body top).
    // A Theme whose loco art is tall in an awkward way (e.g. classic's smokestack
    // sits high in cl-art) can place an explicit, invisible `.rt-lead-anchor` at the
    // exact line the badge should sit above; otherwise use the loco body (`-art`).
    const body = engine.querySelector('.rt-lead-anchor') ?? engine.querySelector('[class$="-art"]') ?? engine;
    const rect = body.getBoundingClientRect();
    if (!rect.width) continue;
    const badge = document.createElement('div');
    badge.className = 'rt-lead';
    badge.textContent = conductor;
    badge.style.left = `${rect.left - trackRect.left + rect.width / 2}px`;
    badge.style.top = `${rect.top - trackRect.top}px`;
    track.appendChild(badge);
  }
}
