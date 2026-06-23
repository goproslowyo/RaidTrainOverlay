/**
 * jazz — Spinning Vinyl Theme. Ported from the locked MFA prototype
 * (test/manual/prototype-jazz-mfa.html), wired to the live Train view-model.
 *
 *  - viewBox only (no width/height) so CSS --rt-th sizes it.
 *  - ONE record-on-a-console = ONE vehicle. A spinning vinyl record sits on a
 *    premium wood deck; the record's center label is a Blue-Note INSTRUMENT motif
 *    matched to the player (sax · trumpet · bass · piano · bird · bent-trumpet),
 *    picked DETERMINISTICALLY from v.slotOrder so every marquee copy matches.
 *  - The locomotive shows the ORGANISER (the conductor). The loco has no Slot, so
 *    no per-slot state — it dims only post-event (isDimmed).
 *  - Ambient motion = the record SPIN: a CSS @keyframes rotating the disc
 *    COUNTER-CLOCKWISE (user correction), compositor-only, disabled under
 *    reduced-motion. The current cut spins a touch faster + reveals a chrome
 *    tonearm and floating musical notes.
 *  - State is toggleable classes (rt-car--current / --departed / --spotlit) so Now +
 *    Spotlight coexist and a time tick updates in place. A departed Slot is lightly
 *    dimmed and stamped PLAYED (legibility — viewer feedback).
 *  - PERF (non-negotiable — a slow overlay can crash OBS): NO per-frame filters.
 *    The Now/Spotlight glow is a CSS drop-shadow over the STATIC .jz-art group
 *    (the spinning disc rides a sibling .jz-spin layer, so the cached glow bitmap
 *    isn't re-rasterised by the spin). Club glow = a STATIC radial gradient; deck
 *    "reflection" = a STATIC gloss gradient. No blurred <use> reflections, no
 *    feGaussianBlur/feTurbulence, no animated hue-rotate. Floating notes are capped.
 *    Pure CSS motion — no JS timers, so no teardown needed.
 *
 * Transparent only — no full-bleed background.
 */
import { SVG_NS, esc, avatarSVG, pointerSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

// The translator the builders paint with: rebound to the active locale at the
// top of build() (themeT reads config.t), English until then. Module-level is
// safe — build() runs synchronously start to finish before any other render.
let L = themeT();

const ENG = 196;          // the loco (the Organiser's deck) rides a touch wider
const CAR = 178;          // one coach deck's width, in viewBox units
const GAP = 8;            // gap between consoles
const cy = 132;           // the platter spindle line
const VIEW_TOP = -16;
const VIEW_BOTTOM = 320;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const TIME_LH = 12;
const R_ENG = 74;         // loco record radius
const R_NOW = 66;         // current cut — the live platter reads a touch larger than a coach
const R_CAR = 60;         // a coach record
const R_OPEN = 56;        // an open "sit-in" slot
const ink = '#1a1208';
const cream = '#f3ead0';
// Blue-Note label palette (cycled by the deterministic instrument pick).
const LAB = ['#e8743b', '#1f8a8a', '#d4a017', '#c0392b', '#2a6f97', '#8e6f3e', '#b5402a'];
// The six instrument motifs, matched to a player by a stable hash of slotOrder.
const INSTRUMENTS = ['sax', 'trumpet', 'bass', 'piano', 'bird', 'btrumpet'];
const STYLE_ID = 'rt-theme-jazz-style';
const COL = { now: '#ffd98a', spot: '#22d3ee' };

const centerX = (x, w) => x + w / 2;

/** Stable per-player instrument: a cheap hash of slotOrder (NOT Math.random, which
 *  would reshuffle every build and break the seamless marquee loop). The engine has
 *  no slotOrder of its own, so seed it from a fixed key. */
function instrumentFor(seed) {
  const n = Number.isFinite(seed) ? seed : 0;
  const h = Math.abs(Math.floor(Math.sin(n * 12.9898 + 4.137) * 43758.5453));
  return INSTRUMENTS[h % INSTRUMENTS.length];
}
function labelColorFor(seed, departed) {
  if (departed) return '#6a6048';
  const n = Number.isFinite(seed) ? seed : 0;
  const h = Math.abs(Math.floor(Math.sin(n * 7.233 + 1.91) * 24634.6345));
  return LAB[h % LAB.length];
}

/* 1) ensureStyles() — inject the Theme's CSS once (keyed by an id). The ambient
 *    motion is the record SPIN: a compositor-only @keyframes rotating the disc
 *    COUNTER-CLOCKWISE; reduced-motion stops it. State is the shared
 *    .rt-car--current/--departed/--spotlit classes; the Now/Spotlight GLOW is a
 *    drop-shadow over the STATIC .jz-art group (the spinning .jz-spin disc is a
 *    sibling, so a lit Car's filter bitmap caches across frames instead of
 *    re-rasterising the spin every frame — memory theme-rendering-constraints).
 *    The tonearm + floating notes ride .jz-live, revealed on .rt-car--current. */
export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-jazz .jz-spin { transform-box: fill-box; transform-origin: center; animation: rt-jz-spin 4.2s linear infinite; will-change: transform; }
    .rt-theme-jazz .rt-car--current .jz-spin { animation-duration: 2.1s; }
    @keyframes rt-jz-spin { to { transform: rotate(-360deg); } }

    /* Floating notes drift up + fade; capped count, compositor-only. */
    .rt-theme-jazz .jz-note { transform-box: fill-box; transform-origin: center; animation: rt-jz-float linear infinite; will-change: transform, opacity; }
    @keyframes rt-jz-float { 0% { opacity: 0; transform: translateY(4px); } 18% { opacity: .95; } 100% { opacity: 0; transform: translate(16px, -54px) rotate(20deg); } }

    /* Tonearm + notes only appear on the live cut. */
    .rt-theme-jazz .jz-live { visibility: hidden; }
    .rt-theme-jazz .rt-car--current .jz-live { visibility: visible; }

    /* The warm club pool — a STATIC radial gradient (no filter), revealed behind the
       platter on the live cut. Sits inside the cached .jz-art group. */
    .rt-theme-jazz .rt-car--current .jz-pool { opacity: 0.85; }

    /* Now/Spotlight glow — a drop-shadow over the STATIC .jz-art group (never the spin). */
    .rt-theme-jazz .rt-car--current .jz-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 9px ${COL.now}); }
    .rt-theme-jazz .rt-car--spotlit .jz-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-jazz .rt-car--current.rt-car--spotlit .jz-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }

    /* STAFF-PICK pill below the deck (restored from the prototype's per-unit art): the
       organiser's-pick indicator the module was missing. All-in-the-DOM, revealed by the
       shared .rt-car--spotlit class (a tick re-styles in place — never a rebuild). STATIC
       text on a STATIC rect: no filter, no animation, one pill per Car, marquee-safe at
       20+ cars. */
    .rt-theme-jazz .jz-tag { visibility: hidden; }
    .rt-theme-jazz .rt-car--spotlit .jz-spot-tag { visibility: visible; }

    /* A handed-off Slot stays readable — a light dim + a PLAYED stamp, not heavy
       shade (viewer feedback): the label/initials/name must still read. */
    .rt-theme-jazz .rt-car--departed { opacity: 0.84; }
    .rt-theme-jazz .rt-car--departed image { filter: saturate(0.55); }
    .rt-theme-jazz .jz-stamp { visibility: hidden; }
    .rt-theme-jazz .rt-car--departed .jz-stamp { visibility: visible; }
    /* A departed Car shows its PLAYED stamp, not a stale NOW/STAFF pill. */
    .rt-theme-jazz .rt-car--departed .jz-tag { visibility: hidden; }

    /* ── The CLUB-FX scene band (buildTrack) ─────────────────────────────────
       ONE stationary, full-canvas-width element, built once, pinned behind the
       Train and faded under track=periodic by the renderer. Two parts:
       (a) a TRANSLUCENT theme-tinted backing (~0.42 alpha) so the live cut shows
           THROUGH it dimly — never opaque, never the whole frame; a lower band
           that backs the train's vertical extent (sized in fractions of --rt-th).
       (b) the club scene painted OVER it: warm radial GLOW POOLS (static
           gradients), floating dust MOTES drifting up (capped, compositor-only),
           the premium wood CONSOLE DECK as the ground + a power LED.
       FILTER-FREE: glows are static radial gradients; motion is transform/opacity
       on the compositor. The band is STATIONARY; its elements animate IN PLACE. */
    .rt-rails-jazz {
      /* (a) the translucent backing — a warm-tinted vertical gradient at ~0.42
         alpha, soft at the top edge so it reads as spill, not a hard slab. */
      background:
        linear-gradient(180deg,
          rgba(36,24,12,0) 0%,
          rgba(40,27,14,0.34) 12%,
          rgba(34,23,12,0.46) 46%,
          rgba(22,15,8,0.5) 78%,
          rgba(14,9,5,0.5) 100%);
      overflow: visible;
    }
    /* (b) warm glow POOLS — large static radial gradients across the deck. Each
       breathes IN PLACE (opacity/scale only) on the compositor; staggered so the
       club lighting shimmers without marching in lock-step. */
    .rt-rails-jazz .jz-pool-bg {
      position: absolute; border-radius: 50%; pointer-events: none;
      will-change: transform, opacity; transform-box: fill-box; transform-origin: center;
      background: radial-gradient(closest-side, rgba(255,219,146,0.36) 0%, rgba(255,202,116,0.14) 40%, rgba(255,200,110,0.04) 70%, rgba(255,200,110,0) 100%);
      animation: rt-jz-pool 7s ease-in-out infinite;
    }
    @keyframes rt-jz-pool { 0%,100% { opacity: 0.6; transform: scale(0.97); } 50% { opacity: 0.95; transform: scale(1.05); } }

    /* Floating dust MOTES — small warm dots drifting upward + fading. Capped
       count, compositor-only (transform/opacity), reduced-motion-safe. */
    .rt-rails-jazz .jz-mote {
      position: absolute; border-radius: 50%; background: #ffe6b0; pointer-events: none;
      will-change: transform, opacity; transform-box: fill-box; transform-origin: center;
      animation: rt-jz-mote linear infinite;
    }
    @keyframes rt-jz-mote { 0% { opacity: 0; transform: translate(0,0); } 30% { opacity: 0.6; } 100% { opacity: 0; transform: translate(calc(var(--rt-th) * 0.05), calc(var(--rt-th) * -0.12)); } }

    /* The premium wood CONSOLE DECK — the ground the records sit on. A static
       wood gradient with a top lip + a glossy sheen (stands in for the prototype's
       blurred reflection, kept static for perf). */
    .rt-rails-jazz .jz-deck {
      position: absolute; left: 0; width: 100%; pointer-events: none;
      background: linear-gradient(180deg, #43301d 0%, #2c2012 50%, #18110a 100%);
      box-shadow: inset 0 calc(var(--rt-th) * 0.006) 0 #caa06a55, inset 0 calc(var(--rt-th) * 0.02) calc(var(--rt-th) * 0.045) #ffffff0d;
      border-top: calc(var(--rt-th) * 0.012) solid #6a4a28;
    }
    /* deck gloss sheen — a thin bright band just under the lip (static "reflection"). */
    .rt-rails-jazz .jz-deck::before {
      content: ''; position: absolute; left: 0; right: 0; top: calc(var(--rt-th) * 0.012);
      height: calc(var(--rt-th) * 0.05); background: #ffffff; opacity: 0.05; pointer-events: none;
    }
    /* power LED on the console (the prototype's green deck LED) — static glow gradient. */
    .rt-rails-jazz .jz-led {
      position: absolute; border-radius: 50%; pointer-events: none;
      background: radial-gradient(closest-side, #cfffd9 0%, #7fffa0 42%, rgba(127,255,160,0) 100%);
      animation: rt-jz-led 3.4s ease-in-out infinite;
    }
    @keyframes rt-jz-led { 0%,100% { opacity: 0.7; } 50% { opacity: 1; } }

    @media (prefers-reduced-motion: reduce) {
      .rt-theme-jazz .jz-spin, .rt-theme-jazz .jz-note { animation: none !important; }
      .rt-rails-jazz .jz-pool-bg, .rt-rails-jazz .jz-mote, .rt-rails-jazz .jz-led { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

/* 2) buildTrack() — the CLUB-FX scene band: ONE stationary, full-canvas-width
 *    element built once, pinned behind the Train (and faded under track=periodic)
 *    by the renderer. It is a LOWER band — the top of the frame stays see-through.
 *    Two parts (per the scene-band spec; styled in ensureStyles):
 *      (a) a TRANSLUCENT theme-tinted backing (the div's own ~0.42-alpha gradient)
 *          so the live stream shows THROUGH it dimly — never opaque, never the
 *          whole frame. Sized in fractions of --rt-th: top near the train band,
 *          height ~0.86×--rt-th.
 *      (b) the warm club scene OVER it: a few large static GLOW POOLS, floating
 *          dust MOTES drifting upward (capped, deterministic), the premium wood
 *          CONSOLE DECK as the ground + a power LED.
 *    FILTER-FREE: glows are static radial gradients; motion = compositor
 *    transform/opacity. Deterministic layout (no Math.random) so it's stable. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-jazz';

  // (a) the band's vertical extent: a lower band backing the train + deck. Top
  //     near the platter tops (a little warm spill above), height ~0.86×--rt-th.
  const bandTop = 0.10;     // fraction of --rt-th from the SVG's top edge
  const bandH = 0.86;       // ~0.9×--rt-th — a lower band, not the whole frame
  el.style.top = `calc(var(--rt-th) * ${bandTop})`;
  el.style.height = `calc(var(--rt-th) * ${bandH})`;

  // viewBox-y → fraction-of-band-height, for placing the scene parts in the band.
  const absFrac = (Y) => (Y - VIEW_TOP) / VIEW_H;        // frac of --rt-th from SVG top
  const inBand = (Y) => (absFrac(Y) - bandTop) / bandH;  // 0..1 down the band
  const spindle = inBand(cy);                            // the platter spindle line
  const deckTop = inBand(cy + 78);                       // the console deck top
  const deckH = (64 / VIEW_H) / bandH;                   // deck height, frac of band

  let parts = '';

  // (b1) warm GLOW POOLS — a few large static radial gradients spread across the
  //      deck, centred on the spindle line. Diameter ~1.5×--rt-th; positioned at
  //      deterministic percentages so they spread evenly at any canvas width.
  const POOLS = [12, 34, 55, 76, 94];   // % across the canvas — fixed, deterministic
  const poolD = 1.7;                     // diameter in units of --rt-th (overlap → wash)
  const poolY = inBand(cy - 6);          // hug the disc band (a touch above the spindle)
  POOLS.forEach((px, k) => {
    const delay = (-k * 1.6).toFixed(1);
    parts +=
      `<div class="jz-pool-bg" style="` +
      `left:${px}%;top:calc(var(--rt-th) * ${bandH} * ${poolY.toFixed(4)});` +
      `width:calc(var(--rt-th) * ${poolD});height:calc(var(--rt-th) * ${poolD});` +
      `margin-left:calc(var(--rt-th) * ${(-poolD / 2)});margin-top:calc(var(--rt-th) * ${(-poolD / 2)});` +
      `animation-delay:${delay}s"></div>`;
  });

  // (b2) floating dust MOTES — capped at 10, drifting up + fading. Deterministic
  //      spread/size/duration (a cheap index hash, never Math.random).
  const MOTES = 10;
  for (let k = 0; k < MOTES; k++) {
    const mx = (6 + (k * 89) % 92);                     // 6..98% across, well spread
    const myJit = (k % 4) * 0.07;                       // vertical stagger near the deck
    const my = (spindle + 0.12 + myJit);               // start just below the spindle
    const r = (1.6 + (k % 3) * 0.5).toFixed(1);        // 1.6..2.6 viewBox-ish px
    const du = (6 + (k % 5) * 1.4).toFixed(1);         // 6..11.6s
    const delay = (-(k * 0.9)).toFixed(1);
    parts +=
      `<div class="jz-mote" style="` +
      `left:${mx}%;top:calc(var(--rt-th) * ${bandH} * ${my.toFixed(4)});` +
      `width:calc(var(--rt-th) * ${(r / VIEW_H).toFixed(4)} * 2);height:calc(var(--rt-th) * ${(r / VIEW_H).toFixed(4)} * 2);` +
      `animation-duration:${du}s;animation-delay:${delay}s"></div>`;
  }

  // (b3) the premium wood CONSOLE DECK + power LED (the prototype's green LED).
  parts +=
    `<div class="jz-deck" style="` +
    `top:calc(var(--rt-th) * ${bandH} * ${deckTop.toFixed(4)});` +
    `height:calc(var(--rt-th) * ${bandH} * ${deckH.toFixed(4)})"></div>`;
  parts +=
    `<div class="jz-led" style="` +
    `left:calc(100% - var(--rt-th) * 0.085);` +
    `top:calc(var(--rt-th) * ${bandH} * ${deckTop.toFixed(4)} + var(--rt-th) * 0.09);` +
    `width:calc(var(--rt-th) * 0.05);height:calc(var(--rt-th) * 0.05)"></div>`;

  el.innerHTML = parts;
  return el;
}

// --- the instrument silhouettes (drawn at origin, ~±26 box; ink on the coloured
//     label). Reproduced verbatim from the prototype's motif() builder. ---
function motif(kind) {
  const I = `fill="${ink}"`;
  const S = `fill="none" stroke="${ink}" stroke-width="4.5" stroke-linecap="round"`;
  if (kind === 'sax') return `<path d="M -1 -25 q 11 1 10 15 q -1 13 -11 17 q -7 3 -7 12" ${S}/><path d="M -10 18 q -7 7 2 13 q 11 4 15 -5 q 2 -6 -5 -9 Z" ${I}/><rect x="-5" y="-29" width="7" height="6" rx="2" ${I}/><circle cx="3" cy="-6" r="1.8" ${I}/><circle cx="1" cy="4" r="1.8" ${I}/><circle cx="-3" cy="12" r="1.8" ${I}/>`;
  if (kind === 'trumpet') return `<rect x="-20" y="-3" width="30" height="6" rx="3" ${I}/><path d="M 9 -11 L 25 -17 L 25 17 L 9 11 Z" ${I}/><rect x="-26" y="-2.5" width="8" height="5" rx="2" ${I}/><rect x="-8" y="-12" width="3" height="11" ${I}/><rect x="-1" y="-12" width="3" height="11" ${I}/><rect x="6" y="-12" width="3" height="11" ${I}/>`;
  if (kind === 'btrumpet') return `<rect x="-20" y="6" width="26" height="6" rx="3" ${I}/><path d="M 4 6 q 16 0 16 -20 l 8 2 q -2 26 -22 24 Z" ${I}/><rect x="-26" y="6.5" width="8" height="5" rx="2" ${I}/><rect x="-8" y="-3" width="3" height="11" ${I}/><rect x="-1" y="-3" width="3" height="11" ${I}/>`;
  if (kind === 'bass') return `<rect x="-2" y="-34" width="4" height="24" ${I}/><circle cx="0" cy="-35" r="3.5" ${I}/><ellipse cx="0" cy="-7" rx="11" ry="13" ${I}/><ellipse cx="0" cy="9" rx="16" ry="19" ${I}/><line x1="0" y1="-14" x2="0" y2="26" stroke="${cream}" stroke-width="1.4"/>`;
  if (kind === 'piano') {
    let s = '';
    for (let k = -3; k <= 3; k++) s += `<rect x="${k * 7 - 3.2}" y="-7" width="6.4" height="26" rx="1.5" fill="${cream}" stroke="${ink}" stroke-width="1"/>`;
    for (let k = -3; k < 3; k++) { if (k % 7 === 2 || k % 7 === 6) continue; s += `<rect x="${k * 7 + 0.6}" y="-7" width="4.8" height="15" ${I}/>`; }
    return s;
  }
  if (kind === 'bird') return `<path d="M -22 2 q 9 -15 23 -9 q 5 -9 13 -3 q -6 3 -8 8 q 8 -1 13 4 q -10 4 -19 1 q -11 6 -23 1 Z" ${I}/><circle cx="11" cy="-6" r="1.6" fill="${cream}"/>`;
  return '';
}

/** The defs shared across the SVG: STATIC gradients only (vinyl wax, chrome, the
 *  warm club glow radial, the deck gloss). No <filter> — per the perf mandate the
 *  prototype's #bloom/#rblur filters are intentionally dropped. */
function jazzDefs() {
  return `<defs>
    <radialGradient id="jz-vinyl" cx=".4" cy=".36" r=".62"><stop offset="0" stop-color="#26262d"/><stop offset=".5" stop-color="#0c0c0f"/><stop offset=".84" stop-color="#1f1f27"/><stop offset="1" stop-color="#020203"/></radialGradient>
    <linearGradient id="jz-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef3f6"/><stop offset=".5" stop-color="#8a99a4"/><stop offset="1" stop-color="#39424b"/></linearGradient>
    <linearGradient id="jz-deck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#43301d"/><stop offset=".5" stop-color="#2c2012"/><stop offset="1" stop-color="#18110a"/></linearGradient>
    <radialGradient id="jz-warm" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd98a" stop-opacity=".5"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>
  </defs>`;
}

/** One spinning record (the static rim/glow lives in .jz-art via the caller; the
 *  rotating wax + label + motif + initials are returned here to ride .jz-spin).
 *  Reproduces the prototype's record() vinyl/groove/label/comet-cue art. The avatar
 *  (the rider's identity) sits on the STATIC label center over the motif (caller). */
function spinningDisc(x, R, inst, name, col) {
  const lr = R * 0.46;
  let s = `<circle cx="${x}" cy="${cy}" r="${R}" fill="url(#jz-vinyl)"/>`;
  for (let g = R - 8; g > lr + 3; g -= 3.2) s += `<circle cx="${x}" cy="${cy}" r="${g.toFixed(1)}" fill="none" stroke="#000" stroke-width="0.7" opacity=".5"/>`;
  s += `<circle cx="${x}" cy="${cy}" r="${lr}" fill="${col}"/><circle cx="${x}" cy="${cy}" r="${lr}" fill="none" stroke="#0006" stroke-width="2"/>`;
  // instrument motif, clipped to the label
  const cl = `jz-m${x.toFixed(0)}`;
  s += `<clipPath id="${cl}"><circle cx="${x}" cy="${cy}" r="${(lr - 3).toFixed(1)}"/></clipPath>`;
  s += `<g clip-path="url(#${cl})" transform="translate(${x},${(cy - lr * 0.22).toFixed(1)}) scale(${(lr / 30).toFixed(2)})">${motif(inst)}</g>`;
  // spindle hole + a faint groove ring + a comet directional cue (so the spin can't
  // read wagon-wheel-backward) — verbatim from the prototype.
  s += `<circle cx="${x}" cy="${cy}" r="${(lr * 0.3).toFixed(1)}" fill="none" stroke="#ffffff44" stroke-width="1"/>`;
  s += `<path d="M ${x} ${(cy - lr * 0.78).toFixed(1)} q ${(-lr * 0.16).toFixed(1)} ${(lr * 0.06).toFixed(1)} ${(-lr * 0.18).toFixed(1)} ${(lr * 0.2).toFixed(1)}" stroke="#0006" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  s += `<circle cx="${x}" cy="${cy}" r="2.4" fill="#0a0a0c"/>`;
  // static top-left specular sheen (kept STATIC — no animated sweep on the spin)
  s += `<path d="M ${(x - R * 0.6).toFixed(1)} ${(cy - R * 0.66).toFixed(1)} A ${(R * 0.95).toFixed(1)} ${(R * 0.95).toFixed(1)} 0 0 1 ${(x + R * 0.45).toFixed(1)} ${(cy - R * 0.82).toFixed(1)}" fill="none" stroke="#fff" stroke-width="${(R * 0.42).toFixed(0)}" stroke-linecap="round" opacity=".06"/>`;
  return s;
}

/** The chrome tonearm + capped floating notes on the live cut (revealed by .jz-live
 *  / .rt-car--current). Reproduces the prototype's now-treatment, minus the per-frame
 *  ripple animation region (kept as a single static ring for perf). */
function liveTonearm(x, R) {
  const px = x + R + 40, py = cy - R - 20;
  let s = `<g class="jz-live">`;
  // pivot base + arm + counterweight
  s += `<circle cx="${px}" cy="${py}" r="11" fill="url(#jz-chrome)" stroke="#2a3138" stroke-width="2"/><circle cx="${px}" cy="${py}" r="4" fill="#1a1d22"/>`;
  s += `<line x1="${px}" y1="${py}" x2="${px + 16}" y2="${py - 10}" stroke="url(#jz-chrome)" stroke-width="6" stroke-linecap="round"/><circle cx="${px + 18}" cy="${py - 11}" r="6" fill="#2a3138"/>`;
  s += `<line x1="${px}" y1="${py}" x2="${(x + R * 0.46).toFixed(1)}" y2="${(cy - R * 0.2).toFixed(1)}" stroke="url(#jz-chrome)" stroke-width="5" stroke-linecap="round"/>`;
  // headshell + cartridge
  s += `<rect x="${(x + R * 0.40).toFixed(1)}" y="${(cy - R * 0.30).toFixed(1)}" width="15" height="10" rx="2" transform="rotate(36 ${(x + R * 0.46).toFixed(1)} ${(cy - R * 0.24).toFixed(1)})" fill="#15181d"/><rect x="${(x + R * 0.44).toFixed(1)}" y="${(cy - R * 0.16).toFixed(1)}" width="4" height="6" fill="#e0b06a"/>`;
  // floating musical notes — capped at 5 (perf)
  const NOTE = ['♪', '♫', '♩', '♬'];
  for (let k = 0; k < 5; k++) {
    const nx = x - 12 + k * 12;
    const du = (2.4 + k * 0.4).toFixed(1);
    s += `<text class="jz-note" x="${nx}" y="${cy - R - 4}" font-size="${17 + (k % 2) * 7}" fill="${COL.now}" style="animation-duration:${du}s;animation-delay:-${(k * 0.6).toFixed(1)}s">${NOTE[k % 4]}</text>`;
  }
  return s + `</g>`;
}

/** A status pill below the deck (the prototype's per-unit tag): a rounded rect with a
 *  centred bold label. STATIC — no filter, no animation. `cls` (a .jz-tag variant) is the
 *  CSS reveal hook; the rect auto-sizes to the label so longer locales don't clip. */
function pillTag(cls, x, y, label, bg, fg) {
  const w = Math.max(54, label.length * 8 + 20);
  return `<g class="jz-tag ${cls}"><rect x="${(x - w / 2).toFixed(1)}" y="${y - 11}" width="${w.toFixed(1)}" height="22" rx="4" fill="${bg}" stroke="#0006"/><text x="${x}" y="${y + 4}" text-anchor="middle" font-weight="800" font-size="11" font-family="system-ui" fill="${fg}" letter-spacing="0.5">${label}</text></g>`;
}

/** Bottom-anchored stacked time lines (1 line for relative, up to 3 for tz). */
function timeTspans(lines, x, baseY) {
  return lines
    .map((line, i) => `<tspan x="${x}" y="${baseY - (lines.length - 1 - i) * TIME_LH}">${esc(line)}</tspan>`)
    .join('');
}

/** Rewrite a .jz-time block in place on a time tick — text only, no structure. */
function setTimeLines(timeText, lines) {
  const x = timeText.getAttribute('x');
  const baseY = Number(timeText.getAttribute('y'));
  timeText.replaceChildren();
  lines.forEach((line, i) => {
    const tspan = document.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', x);
    tspan.setAttribute('y', String(baseY - (lines.length - 1 - i) * TIME_LH));
    tspan.textContent = line;
    timeText.appendChild(tspan);
  });
}

/** Render one vehicle's console+record. Returns { artBack, spin, artFront, live }:
 *  - artBack  — STATIC .jz-art behind the wax (glow radial, chrome rim, felt).
 *  - spin     — the rotating .jz-spin wax + label + instrument motif.
 *  - artFront — STATIC .jz-art over the wax (the rider's avatar pinned to the label
 *               center, the name, time, and PLAYED stamp).
 *  - live     — the tonearm + floating notes (.jz-live, shown on .rt-car--current).
 *  Both static groups carry the .jz-art class (the glow drop-shadow target — a class
 *  ending in -art, which the lead-badge pinner also looks for) and neither contains
 *  the spin, so the cached glow bitmap never re-rasterises per frame. */
function jazzCar(v, x, w, i, isEngine) {
  const cx = centerX(x, w);
  const seed = isEngine ? -7 : v.slotOrder;
  const ringEng = '#e0b06a';

  if (v.isOpen) {
    const R = R_OPEN;
    let artBack = `<g class="jz-art">`;
    artBack += `<circle cx="${cx}" cy="${cy}" r="${R + 9}" fill="none" stroke="#6b5836" stroke-width="2" stroke-dasharray="9 7"/>`;
    artBack += `<circle cx="${cx}" cy="${cy}" r="${(R * 0.46).toFixed(1)}" fill="none" stroke="#7a6238" stroke-width="2" stroke-dasharray="6 5"/>`;
    artBack += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="#cdb079" font-weight="800" font-size="22" font-family="ui-serif,Georgia,serif">${esc(L('overlay.open'))}</text>`;
    artBack += `<text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="#cdb079" font-weight="700" font-size="11" font-family="system-ui">${esc(L('overlay.signUp'))}</text>`;
    artBack += `<text class="jz-time" x="${cx}" y="${cy + R + 30}" text-anchor="middle" font-weight="700" font-size="11" fill="#a78f63">${timeTspans(v.timeLines, cx, cy + R + 30)}</text>`;
    artBack += `</g>`;
    return { artBack, spin: '', artFront: '', live: '' };
  }

  const R = isEngine ? R_ENG : v.isCurrent ? R_NOW : R_CAR;
  const lr = R * 0.46;
  const inst = instrumentFor(seed);
  const col = labelColorFor(seed, isEngine ? false : v.isDeparted);
  const ring = isEngine ? ringEng : '#caa06a';

  // STATIC back art (.jz-art — glow-filtered, cached): the warm club radial, the
  // platter shadow + chrome rim + felt. The spinning wax is a SIBLING layer over
  // this, so the cached glow bitmap isn't re-rasterised by the spin.
  let artBack = `<g class="jz-art">`;
  // the warm club glow as a STATIC radial behind the platter (no filter)
  artBack += `<ellipse cx="${cx}" cy="${cy}" rx="${(R * 1.7).toFixed(0)}" ry="${(R * 1.5).toFixed(0)}" fill="url(#jz-warm)" class="jz-pool" opacity="0"/>`;
  // platter chrome rim + felt
  artBack += `<circle cx="${cx}" cy="${cy}" r="${R + 9}" fill="#0d0e11"/>`;
  artBack += `<circle cx="${cx}" cy="${cy}" r="${R + 9}" fill="none" stroke="url(#jz-chrome)" stroke-width="3.5"/>`;
  artBack += `<circle cx="${cx}" cy="${cy}" r="${R + 4}" fill="#141519"/>`;
  artBack += `</g>`;

  // The SPINNING wax + label + motif (its own transform; sibling of the static art).
  const spin = `<g class="jz-spin">${spinningDisc(cx, R, inst, v.name, col)}</g>`;

  // STATIC front art (.jz-art — also glow-filtered + cached; no spin inside): the
  // rider's IDENTITY avatar pinned over the label center (so it never spins out of
  // frame), the name below the platter on the deck, the time, and the PLAYED stamp.
  let artFront = `<g class="jz-art">`;
  artFront += avatarSVG(`jz-av-${i}`, cx, cy + lr * 0.46, lr * 0.5, v.image, v.name, ring);
  artFront += `<text x="${cx}" y="${cy + R + 30}" text-anchor="middle" font-weight="800" font-size="16" font-family="ui-serif,Georgia,serif" fill="${v.isCurrent ? '#ffd98a' : '#f0e2c4'}" class="rt-fit" data-maxw="${w - 18}">${esc(v.name)}</text>`;
  artFront += `<text class="jz-time" x="${cx}" y="${cy + R + 48}" text-anchor="middle" font-weight="700" font-size="12" font-family="system-ui" fill="#a78f63">${timeTspans(v.timeLines ?? [''], cx, cy + R + 48)}</text>`;
  // STAFF-PICK pill below the deck — the prototype's per-unit spotlight indicator,
  // restored. The live cut already announces itself via the contract NOW pointer (the
  // arrow above the platter) + the tonearm/notes, so a "NOW" pill would just duplicate
  // it — the missing element was the organiser's-pick label. STATIC text on a STATIC
  // rect, riding .jz-art (cached with the glow), always in the DOM, revealed by the
  // shared .rt-car--spotlit class (a tick toggles the class — never a rebuild). One
  // pill per Car, so marquee-safe at 20+ cars. Uses the existing localized overlay.staff
  // key (no new catalog keys). The loco carries no Slot state, so it gets no pill.
  if (!isEngine) {
    const py = cy + R + 8;          // straddles the deck line, just under the platter
    artFront += pillTag('jz-spot-tag', cx, py, `★ ${esc(L('overlay.staff'))}`, '#c0392b', '#fff');
  }

  // PLAYED stamp — hidden until departed (revealed by CSS). Light ink on a translucent
  // backing so it reads over the wax, angled across the platter.
  if (!isEngine) {
    const sy = cy + R - 8;
    artFront += `<g class="jz-stamp" transform="rotate(-9 ${cx} ${sy})"><rect x="${cx - 40}" y="${sy - 15}" width="80" height="30" rx="4" fill="#2a0a0a" opacity="0.66" stroke="#ff9a9a" stroke-width="2.5"/><text x="${cx}" y="${sy + 6}" text-anchor="middle" font-weight="800" font-size="15" fill="#ffd0d0" letter-spacing="2">${esc(L('overlay.played'))}</text></g>`;
  }
  artFront += `</g>`;

  // The live treatment (tonearm + notes) — only the current cut shows it.
  const live = isEngine ? '' : liveTonearm(cx, R);
  return { artBack, spin, artFront, live };
}

/* 3) build(train, opts) — build the Train art ONCE and return a handle. toVehicles()
 *    flattens the live view-model: vehicles[0] is the locomotive (the ORGANISER, who
 *    conducts the train); the rest are the coaches. The loco carries no per-slot
 *    state (no NOW/departed/spotlight) — it dims only post-event (isDimmed). */
export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  // Width + role key off the view-model's kind, NOT the index: post-event
  // (enginedim=finished + hidefinished) toVehicles drops the Engine, so vehicles[0]
  // can be a real Car and must not be drawn as the loco.
  const widthOf = (i) => (vehicles[i].kind === 'engine' ? ENG : CAR);
  const xs = [];
  let acc = 0;
  vehicles.forEach((_, i) => { xs.push(acc); acc += widthOf(i) + GAP; });
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  vehicles.forEach((v, i) => {
    const w = widthOf(i);
    const isEngine = v.kind === 'engine';
    const parts = jazzCar(v, xs[i], w, i, isEngine);
    // The loco is the Organiser — no Slot, so it dims only post-event (isDimmed),
    // never on a per-slot isDeparted. Coaches use isDeparted.
    const departed = isEngine ? v.isDimmed : v.isDeparted;
    const state =
      (v.isCurrent ? ' rt-car--current' : '') +
      (v.isSpotlit ? ' rt-car--spotlit' : '') +
      (departed ? ' rt-car--departed' : '');
    const slot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
    // The Now Marker is always in the DOM; base CSS reveals it on .rt-car--current.
    // The loco (Organiser) has no Slot, so no NOW marker; every coach (incl. open) gets one.
    const pointer = isEngine
      ? ''
      : `<g class="rt-pointer rt-now-bob">${pointerSVG(centerX(xs[i], w), 18, COL.now, L('overlay.now'))}</g>`;
    // Layer order: static back art (glow radial + rim/felt), the spinning wax over
    // it, the static front art (avatar/name/stamp) pinned on top, then the live
    // tonearm/notes, then the Now pointer. Both static art groups are .jz-art (the
    // glow filter target) and neither contains the spin — so the cached glow bitmap
    // never re-rasterises per frame.
    body += `<g class="rt-car${state}"${slot}>${parts.artBack}<g class="jz-front">${parts.spin}</g>${parts.artFront}${parts.live}${pointer}</g>`;
  });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-jazz" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:0.9">${jazzDefs()}${body}</svg>`;
  const svg = holder.firstElementChild;

  // Keep references so a time tick re-styles in place (never a rebuild).
  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((g) => {
    if (g.dataset.engine) { engineRef = { group: g, timeText: g.querySelector('.jz-time') }; return; }
    const key = Number(g.dataset.slot);
    carRefs.set(key, { group: g, timeText: g.querySelector('.jz-time') });
  });

  return {
    node: svg,
    /* update(nextTrain) — re-style state IN PLACE on the renderer's tick: toggle the
     *  shared classes (cars by slotOrder; engine by data-engine, departed = isDimmed)
     *  and rewrite the time text. Never rebuild, so the running spin isn't restarted. */
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        const ref = carRefs.get(car.slotOrder);
        if (!ref) continue;
        ref.group.classList.toggle('rt-car--current', car.isCurrent);
        ref.group.classList.toggle('rt-car--departed', car.isDeparted);
        ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
        if (ref.timeText) setTimeLines(ref.timeText, car.timeLines ?? [car.relativeTime]);
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        if (engineRef.timeText) setTimeLines(engineRef.timeText, eng.timeLines ?? [eng.relativeTime ?? '']);
      }
    },
    /* afterAttach() — runs once the node is in the document: fit the names to their
     *  consoles (no truncation) and start the per-Car ambient undulation. */
    afterAttach() {
      fitAll(svg);
      undulate(svg);
    },
  };
}

// 4) The default export IS the Theme: register it in src/train-renderer.js.
export default { key: 'jazz', ensureStyles, build, buildTrack };
