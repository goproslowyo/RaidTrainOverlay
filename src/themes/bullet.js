/**
 * bullet — the Anime art-train Theme (a Japanese shinkansen). Ported from the
 * locked MFA prototype (test/manual/prototype-bullet-mfa.html), wired to the
 * live Train view-model.
 *
 *  - viewBox only (no width/height) so CSS --rt-th sizes it.
 *  - ONE shinkansen car = ONE vehicle. Each coach is wrapped in a different
 *    Japanese art style (Ghibli sky · sumi-e ink · Mt Fuji · Hokusai great wave ·
 *    seigaiha waves · sakura), painted into the clipped car body. The lead car (the
 *    locomotive — the ORGANISER, who conducts the train) is ALWAYS sakura.
 *  - Per-car art is picked DETERMINISTICALLY from a stable hash of v.slotOrder
 *    (NOT Math.random, which the prototype used "per load") — the renderer calls
 *    build() once per marquee copy, so every copy must match for a seamless loop.
 *  - The current car erupts into a layered anime power-up: a static aura glow +
 *    capped, compositor-only radial speed-lines / concentration-lines / petals /
 *    sparks + a NOW! lockup, all revealed on .rt-car--current.
 *  - State is toggleable classes (rt-car--current / --departed / --spotlit) so Now +
 *    Spotlight coexist and a time tick updates in place. A departed Slot is lightly
 *    dimmed and stamped PLAYED (legibility — viewer feedback). The loco carries no
 *    per-slot state — it dims only post-event (isDimmed).
 *  - PERF (non-negotiable — a slow overlay can crash OBS): NO per-frame filters.
 *    The prototype's #bloom (feGaussianBlur over the spinning concentration-lines),
 *    both blurred <use> (a guideway reflection + a motion-ghost), and the animated
 *    nowtag drop-shadow are intentionally DROPPED. The Now/Spotlight glow is a CSS
 *    drop-shadow over the STATIC .bullet-art group (the live power-up rides a SIBLING
 *    layer, so a lit Car's filter bitmap caches across frames instead of re-rasterising
 *    the motion). The aura is a STATIC radial gradient. NOTE: no wheels — a shinkansen
 *    rides on enclosed, skirted bogies, so the car body fairs down to the guideway.
 *    Speed-lines / sparks / petals are capped. Pure CSS motion — no JS timers, so no
 *    teardown needed.
 *
 * Transparent only — no full-bleed background.
 */
import { SVG_NS, esc, initials, pointerSVG, avatarSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

// The translator the builders paint with: rebound to the active locale at the
// top of build() (themeT reads config.t), English until then. Module-level is
// safe — build() runs synchronously start to finish before any other render.
let L = themeT();

const ENG = 270;          // the lead car (the duckbill-nosed loco) rides wider
const CAR = 184;          // one coach's width, in viewBox units
const GAP = 14;           // gap between cars (the prototype's coupler spacing)
const cTop = 30;          // car-body top, in viewBox units
const cBot = 126;         // car-body bottom
const railY = 140;        // the wheel/guideway line
// Keep the viewBox tight to the car so coaches render at a comparable scale to the
// other themes (~43% of the box is the car body). The NOW! lockup + power-up burst
// extend above the box and show via the renderer's .rt-track>svg overflow:visible.
const VIEW_TOP = -8;      // small headroom; the NOW lockup + burst bleed above
const VIEW_BOTTOM = 214;  // room for the rail, wheels, name + time below
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const TIME_LH = 12;
const STYLE_ID = 'rt-theme-bullet-style';
const COL = { now: '#36d6ff', spot: '#a78bfa' };

// The non-sakura art styles a coach can wear, picked deterministically per car.
// (The lead car is ALWAYS sakura and is excluded from this pool.)
const ART_POOL = ['ghibli', 'sumie', 'fuji', 'wave', 'seigaiha'];

const centerX = (x, w) => x + w / 2;

/** Stable per-car art style: a cheap hash of slotOrder (NOT Math.random, which
 *  would reshuffle every build and break the seamless marquee loop). Same family as
 *  shared-svg's rideRand. The lead car never calls this (it is always sakura). */
function artFor(seed) {
  const n = Number.isFinite(seed) ? seed : 0;
  const h = Math.abs(Math.floor(Math.sin(n * 12.9898 + 4.137) * 43758.5453));
  return ART_POOL[h % ART_POOL.length];
}

/* 1) ensureStyles() — inject the Theme's CSS once (keyed by an id). State is the
 *    shared .rt-car--current/--departed/--spotlit classes; the Now/Spotlight GLOW is
 *    a drop-shadow over the STATIC .bullet-art group (the .bl-live power-up rides a
 *    sibling layer, so a lit Car's filter bitmap caches across frames instead of
 *    re-rasterising the motion — memory
 *    theme-rendering-constraints). The anime power-up (.bl-live) is revealed on
 *    .rt-car--current, like the Now pointer. All motion is compositor-only
 *    (transform/opacity) and disabled under prefers-reduced-motion. */
export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* SHINKANSEN RIDE — sleek + smooth on the rails. The shared undulation gives each
       car a sway (translateX) + a ROCK (rotate about the wheel line); a modern bullet
       train shouldn't rock "off the rails", so zero the rock and keep only the small
       left-right sway (--rt-ride is low). !important overrides undulate()'s per-car
       inline --rt-rock so the keyframe's rotate(var(--rt-rock)) becomes rotate(0). */
    .rt-theme-bullet .rt-car { --rt-rock: 0deg !important; }

    /* The anime power-up burst + speed-lines only appear on the live car. */
    .rt-theme-bullet .bl-live { visibility: hidden; }
    .rt-theme-bullet .rt-car--current .bl-live { visibility: visible; }

    /* Spinning concentration-lines (slow CW) + flicker. Compositor-only. */
    .rt-theme-bullet .bl-conc { transform-box: fill-box; transform-origin: center; animation: rt-bl-cspin 18s linear infinite, rt-bl-flick 2.2s ease-in-out infinite; will-change: transform, opacity; }
    /* Radial god-rays drift the other way so the burst doesn't read as one rigid wheel. */
    .rt-theme-bullet .bl-rays { transform-box: fill-box; transform-origin: center; animation: rt-bl-cspin 26s linear infinite reverse; will-change: transform; }
    @keyframes rt-bl-cspin { to { transform: rotate(360deg); } }
    @keyframes rt-bl-flick { 50% { opacity: .5; } }
    /* The cyan aura pulse (a STATIC radial gradient scaled/faded — no filter). */
    .rt-theme-bullet .bl-aura { transform-box: fill-box; transform-origin: center; animation: rt-bl-pulse 1.6s ease-in-out infinite; will-change: transform, opacity; }
    @keyframes rt-bl-pulse { 50% { opacity: .85; transform: scale(1.06); } }
    /* Horizontal speed-lines streaking past the live car (capped count). */
    .rt-theme-bullet .bl-speed { transform-box: fill-box; transform-origin: center; animation: rt-bl-rush var(--bl-d, .5s) linear infinite; will-change: transform; }
    /* Streak RIGHTWARD — the train moves forward to the LEFT, so the air/speed-lines
       trail backward (to the right) past it. */
    @keyframes rt-bl-rush { from { transform: translateX(-46px); } to { transform: translateX(46px); } }
    /* Sparks flying forward off the nose (capped count). */
    .rt-theme-bullet .bl-spark { transform-box: fill-box; transform-origin: center; animation: rt-bl-fly linear infinite; will-change: transform, opacity; }
    @keyframes rt-bl-fly { 0% { opacity: 0; transform: translate(0,0) scale(.5); } 20% { opacity: 1; } 100% { opacity: 0; transform: translate(58px,-5px) scale(1); } }
    /* The NOW! lockup pops (compositor scale/rotate; the prototype's animated
       drop-shadow on it was dropped for perf). */
    .rt-theme-bullet .bl-nowtag { transform-box: fill-box; transform-origin: center; animation: rt-bl-pop 1.6s ease-in-out infinite; will-change: transform; }
    @keyframes rt-bl-pop { 50% { transform: scale(1.05) rotate(-1deg); } }

    /* Now/Spotlight glow — a drop-shadow over the STATIC .bullet-art group (never the
       animated power-up burst, which rides sibling layers). */
    .rt-theme-bullet .rt-car--current .bullet-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 10px ${COL.now}); }
    .rt-theme-bullet .rt-car--spotlit .bullet-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-bullet .rt-car--current.rt-car--spotlit .bullet-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }

    /* A handed-off Slot stays readable — a light dim + a PLAYED stamp, not heavy
       shade (viewer feedback): the art/avatar/name must still read. */
    .rt-theme-bullet .rt-car--departed { opacity: 0.84; }
    .rt-theme-bullet .rt-car--departed image { filter: saturate(0.55); }
    .rt-theme-bullet .bl-stamp { visibility: hidden; }
    .rt-theme-bullet .rt-car--departed .bl-stamp { visibility: visible; }

    /* Spotlit avatar halo — a glowing purple ring around the medallion (prototype's
       Staff-Pick treatment). STATIC element inside .bullet-art, revealed on
       .rt-car--spotlit, so the drop-shadow is a cached one-time raster, never per-frame. */
    .rt-theme-bullet .bl-halo { visibility: hidden; }
    .rt-theme-bullet .rt-car--spotlit .bl-halo { visibility: visible; filter: drop-shadow(0 0 8px ${COL.spot}); }

    /* ── The stationary SCENE BAND (buildTrack) ─────────────────────────────────
       A lower band that backs the train's vertical extent — NEVER opaque, NEVER
       full-frame. The top of the frame stays see-through. It carries (a) a
       translucent dark-blue night backing (the live stream shows through dimly,
       which is what makes the elements pop over a bright stream), and (b) the
       theme's scene-wide elements painted over it: full-width RUSHING SPEED-LINES
       at a few depths/speeds for parallax + a glowing guideway rail. All motion is
       compositor-only (translateX) and disabled under reduced-motion. */
    .rt-rails-bullet { top: var(--rt-band-top); height: var(--rt-band-h); overflow: hidden; }
    /* (a) translucent night backing — a theme-tinted gradient at ~0.42 alpha so the
       stream reads through it dimly. Edge-faded left/right so it blends, not a slab. */
    .rt-rails-bullet::before {
      content: ''; position: absolute; left: 0; right: 0; top: 0; bottom: 0;
      background: linear-gradient(180deg, rgba(9,16,30,0.30) 0%, rgba(11,22,44,0.46) 42%, rgba(6,12,26,0.50) 100%);
      -webkit-mask: linear-gradient(90deg, #0000, #000 6%, #000 94%, #0000);
      mask: linear-gradient(90deg, #0000, #000 6%, #000 94%, #0000);
    }
    /* The speed-line + rail SVG fills the band, edge-masked so lines fade in/out. */
    .rt-rails-bullet .bl-band {
      position: absolute; left: 0; top: 0; width: 100%; height: 100%;
      -webkit-mask: linear-gradient(90deg, #0000, #000 8%, #000 92%, #0000);
      mask: linear-gradient(90deg, #0000, #000 8%, #000 92%, #0000);
    }
    /* (b) full-width rushing speed-lines — each lane streaks left at its own speed
       (parallax). The lane is 200% wide and translates -50% so it loops seamlessly.
       Compositor-only transform; capped, tasteful count. */
    .rt-bl-lane { transform-box: fill-box; transform-origin: center; animation: rt-bl-stream var(--bl-sd, 2.4s) linear infinite; will-change: transform; }
    @keyframes rt-bl-stream { from { transform: translateX(-50%); } to { transform: translateX(0); } }
    /* The guideway gloss highlight pulses gently in place (static gradient, no filter). */
    .rt-bl-glow { transform-box: fill-box; transform-origin: center; animation: rt-bl-railpulse 3.4s ease-in-out infinite; will-change: opacity; }
    @keyframes rt-bl-railpulse { 50% { opacity: .35; } }

    @media (prefers-reduced-motion: reduce) {
      .rt-theme-bullet .bl-conc, .rt-theme-bullet .bl-rays, .rt-theme-bullet .bl-aura,
      .rt-theme-bullet .bl-speed, .rt-theme-bullet .bl-spark, .rt-theme-bullet .bl-nowtag,
      .rt-rails-bullet .rt-bl-lane, .rt-rails-bullet .rt-bl-glow { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

/* 2) buildTrack() — the SCENE BAND. ONE stationary, full-canvas-width element built
 *    once (never per-car): a translucent dark-blue night backing (so the live stream
 *    shows through dimly) + the theme's scene-wide elements over it — the headline
 *    RUSHING SPEED-LINES streaking the full width at a few depths/speeds (parallax)
 *    and the glowing guideway rail. The renderer pins this full-width behind the
 *    train and fades it under track=periodic. It is a LOWER band (its top aligns near
 *    the train band, height ~--rt-th) — the top of the frame stays see-through. The
 *    band's internal SVG uses preserveAspectRatio="none" so a normalized 0..100 box
 *    stretches to the live canvas width; horizontal streaking is exactly the goal.
 *    NO per-frame filters: glows are static gradients, motion is translateX only. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-bullet';
  // The band backs the train's vertical extent: top just above the car bodies (a touch
  // of headroom so the speed-lines streak behind the upper body), height ~1.0×--rt-th.
  const bandTopU = (cTop - 20 - VIEW_TOP) / VIEW_H;   // band top, as a fraction of --rt-th
  const bandHU = (railY + 70 - (cTop - 20)) / VIEW_H; // height ~through the name line
  el.style.setProperty('--rt-band-top', `calc(var(--rt-th) * ${bandTopU.toFixed(4)})`);
  el.style.setProperty('--rt-band-h', `calc(var(--rt-th) * ${bandHU.toFixed(4)})`);

  // Speed-line lanes: a few depths, each its own y / thickness / brightness / speed for
  // parallax (faster + brighter reads "near", slower + dimmer reads "far"). CAPPED — a
  // handful of lanes, each a tiled strip of dashes that loops on a -50% translate. Kept
  // tasteful + perf-safe but still reads as "rushing". Deterministic, no Math.random.
  // Lanes are placed where they READ: a few above the car roofs and a few in the strip
  // below the car bodies (above the rail), plus mids that flash through the inter-car
  // gaps. Faster + brighter + thicker reads "near"; slower + dimmer + thinner reads
  // "far" (parallax). Normalized y in 0..100: car roof≈10, car bottom≈58, rail≈65.
  const lanes = [
    { y: 3,  t: 1.0, op: 0.55, sd: 1.6, col: '#dffaff' }, // above roof — near/fast/bright
    { y: 6,  t: 0.8, op: 0.40, sd: 2.4, col: '#9fe9ff' }, // above roof — mid
    { y: 24, t: 0.9, op: 0.32, sd: 3.4, col: '#7fd8ff' }, // through gaps — far/slow
    { y: 40, t: 1.0, op: 0.40, sd: 2.7, col: '#8fe6ff' }, // through gaps — mid
    { y: 60, t: 1.4, op: 0.65, sd: 1.4, col: '#dffaff' }, // below body — near/fast/bright
    { y: 62.5, t: 1.0, op: 0.45, sd: 2.1, col: '#bfefff' }, // below body — mid
    { y: 72, t: 1.2, op: 0.50, sd: 1.9, col: '#9fe9ff' }, // below wheels
  ];
  let band = `<svg class="bl-band" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">`;
  for (const ln of lanes) {
    // One tiled lane = a 200%-wide group of long dashes; the -50% loop is seamless
    // because the second half repeats the first. Long dashes + small gaps read as
    // continuous rushing streaks rather than a dotted grid. 7 dashes per 100-unit half.
    band += `<g class="rt-bl-lane" style="--bl-sd:${ln.sd}s">`;
    for (let half = 0; half < 2; half++) {
      for (let d = 0; d < 7; d++) {
        const x = half * 100 + d * 14.285 + (d % 2) * 1.6; // slight stagger so it doesn't read as a grid
        const len = 9 + (d % 4) * 2.4;                     // long streaks, varied
        band += `<rect x="${x.toFixed(2)}" y="${ln.y}" width="${len.toFixed(2)}" height="${ln.t}" rx="${(ln.t / 2).toFixed(2)}" fill="${ln.col}" opacity="${ln.op}"/>`;
      }
    }
    band += `</g>`;
  }
  // The glowing guideway rail, painted OVER the speed-lines: a glossy metal strip + a
  // bright cyan top highlight that pulses in place (static gradient, no filter). y in the
  // normalized 0..100 band — placed at the wheel line's fraction within the band.
  const railFr = ((railY + 8 - (cTop - 20)) / (railY + 70 - (cTop - 20))) * 100;
  band += `<rect x="0" y="${railFr.toFixed(1)}" width="100" height="9" fill="url(#bl-railG)"/>`;
  band += `<rect class="rt-bl-glow" x="0" y="${railFr.toFixed(1)}" width="100" height="1.8" fill="#bfe9ff" opacity="0.6"/>`;
  band += `<rect x="0" y="${(railFr + 1.8).toFixed(1)}" width="100" height="0.8" fill="#dffaff" opacity="0.35"/>`;
  band += `<defs><linearGradient id="bl-railG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8aa0b0"/><stop offset=".28" stop-color="#46586a"/><stop offset="1" stop-color="#0e1622"/></linearGradient></defs>`;
  band += `</svg>`;
  el.innerHTML = band;
  return el;
}

/** The defs shared across the SVG: STATIC gradients only (the per-style scene skies,
 *  the white livery, the cyan aura radial, the specular sweep, the rim-light). No
 *  <filter> — per the perf mandate the prototype's #bloom/#rblur and the reflection
 *  mask are intentionally dropped. Reproduced verbatim from the prototype's defs(). */
function bulletDefs() {
  return `<defs>
  <linearGradient id="bl-ghSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc6f5"/><stop offset=".6" stop-color="#bfe6fb"/><stop offset="1" stop-color="#e9f7ff"/></linearGradient>
  <linearGradient id="bl-ghHill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#79c64e"/><stop offset="1" stop-color="#3f8a2e"/></linearGradient>
  <linearGradient id="bl-fujiSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d6e8f5"/><stop offset="1" stop-color="#f3f8fc"/></linearGradient>
  <linearGradient id="bl-waveSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7ddbe"/><stop offset="1" stop-color="#f3edd8"/></linearGradient>
  <linearGradient id="bl-waveBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f63a6"/><stop offset="1" stop-color="#14315c"/></linearGradient>
  <linearGradient id="bl-sakSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd6e6"/><stop offset="1" stop-color="#fff2f7"/></linearGradient>
  <linearGradient id="bl-white" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#e4ebf0"/><stop offset="1" stop-color="#9fb0bb"/></linearGradient>
  <radialGradient id="bl-auraG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#d6ffff" stop-opacity=".9"/><stop offset=".4" stop-color="#36d6ff" stop-opacity=".5"/><stop offset="1" stop-color="#36d6ff" stop-opacity="0"/></radialGradient>
  <linearGradient id="bl-sweepG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>`;
}

/** The car silhouette: a long duckbill nose for the lead car, a rounded box for a
 *  coach (a tapered tail for the caboose). Reproduced verbatim from the prototype's
 *  carPath(); the geometry is anchored to cTop/cBot/railY. */
function carPath(x, w, lead, cab) {
  if (lead) return `M ${x} ${railY - 24} C ${x + 6} ${railY - 54} ${x + 22} ${cTop + 30} ${x + 78} ${cTop + 16} C ${x + 120} ${cTop + 5} ${x + 150} ${cTop} ${x + 190} ${cTop} L ${x + w - 12} ${cTop} Q ${x + w} ${cTop} ${x + w} ${cTop + 14} L ${x + w} ${cBot} Q ${x + w} ${cBot + 4} ${x + w - 6} ${cBot + 4} L ${x + 12} ${cBot + 4} Q ${x} ${cBot + 2} ${x} ${railY - 24} Z`;
  const t = cab ? 20 : 0;
  return `M ${x} ${cTop + 16} Q ${x} ${cTop} ${x + 14} ${cTop} L ${x + w - 14 - t} ${cTop} Q ${x + w - t} ${cTop} ${x + w - t} ${cTop + 16} L ${x + w} ${cBot} Q ${x + w} ${cBot + 4} ${x + w - 6} ${cBot + 4} L ${x + 6} ${cBot + 4} Q ${x} ${cBot + 4} ${x} ${cBot} Z`;
}

/** A soft Ghibli cloud cluster. Reproduced verbatim from the prototype. */
function cloud(cx, cy, s) {
  return `<g fill="#fff" opacity=".95"><ellipse cx="${cx}" cy="${cy}" rx="${22 * s}" ry="${11 * s}"/><ellipse cx="${cx - 14 * s}" cy="${cy + 3 * s}" rx="${14 * s}" ry="${8 * s}"/><ellipse cx="${cx + 15 * s}" cy="${cy + 2 * s}" rx="${15 * s}" ry="${9 * s}"/></g>`;
}

/** One Japanese art scene, drawn to fill x..x+w over cTop..cBot (clipped to the car
 *  body by the caller). Reproduced verbatim from the prototype's scene() builder. */
function scene(art, x, w) {
  const W = x + w, H = cBot;
  if (art === 'ghibli') {
    let s = `<rect x="${x}" y="${cTop}" width="${w}" height="${H - cTop}" fill="url(#bl-ghSky)"/>`;
    s += cloud(x + w * 0.32, cTop + 30, 1) + cloud(x + w * 0.68, cTop + 22, 0.8) + cloud(x + w * 0.5, cTop + 44, 0.6);
    s += `<path d="M ${x} ${cBot - 26} Q ${x + w * 0.3} ${cBot - 44} ${x + w * 0.55} ${cBot - 30} Q ${x + w * 0.8} ${cBot - 18} ${W} ${cBot - 30} L ${W} ${cBot} L ${x} ${cBot} Z" fill="url(#bl-ghHill)"/>`;
    s += `<path d="M ${x + w * 0.78} ${cBot - 34} l 0 -20" stroke="#3a6b28" stroke-width="3"/><circle cx="${x + w * 0.78}" cy="${cBot - 58}" r="13" fill="#4f9a39"/>`; // lone tree
    return s;
  }
  if (art === 'sumie') {
    let s = `<rect x="${x}" y="${cTop}" width="${w}" height="${H - cTop}" fill="#efe7d2"/>`;
    s += `<path d="M ${x} ${cBot - 16} Q ${x + w * 0.3} ${cBot - 50} ${x + w * 0.5} ${cBot - 20} Q ${x + w * 0.72} ${cBot - 2} ${x + w * 0.86} ${cBot - 34} Q ${x + w * 0.95} ${cBot - 48} ${W} ${cBot - 26} L ${W} ${cBot} L ${x} ${cBot} Z" fill="#5b6670" opacity=".75"/>`;
    s += `<path d="M ${x + w * 0.1} ${cBot - 10} Q ${x + w * 0.4} ${cBot - 34} ${x + w * 0.62} ${cBot - 14} Q ${x + w * 0.8} ${cBot + 2} ${W} ${cBot - 16} L ${W} ${cBot} L ${x} ${cBot} Z" fill="#2f3740" opacity=".7"/>`;
    s += `<circle cx="${x + w * 0.74}" cy="${cTop + 30}" r="13" fill="none" stroke="#b5482e" stroke-width="2.5"/><rect x="${x + 18}" y="${cTop + 18}" width="14" height="14" rx="2" fill="#b5482e"/>`; // sun ring + hanko
    return s;
  }
  if (art === 'fuji') {
    let s = `<rect x="${x}" y="${cTop}" width="${w}" height="${H - cTop}" fill="url(#bl-fujiSky)"/>`;
    const fx = x + w * 0.5, fb = cBot - 6;
    s += `<path d="M ${fx - 66} ${fb} L ${fx} ${cTop + 18} L ${fx + 66} ${fb} Z" fill="#5a7fa6"/>`;
    s += `<path d="M ${fx - 26} ${cTop + 44} L ${fx} ${cTop + 18} L ${fx + 26} ${cTop + 44} Q ${fx + 12} ${cTop + 38} ${fx} ${cTop + 48} Q ${fx - 12} ${cTop + 38} ${fx - 26} ${cTop + 44} Z" fill="#f3f8fc"/>`; // snowcap
    s += `<circle cx="${x + w * 0.2}" cy="${cTop + 26}" r="11" fill="#ffd9a0" opacity=".8"/>`;
    s += `<path d="M ${x} ${cBot - 12} Q ${x + w * 0.5} ${cBot - 22} ${W} ${cBot - 12} L ${W} ${cBot} L ${x} ${cBot} Z" fill="#2f5a86" opacity=".5"/>`;
    return s;
  }
  if (art === 'wave') {
    let s = `<rect x="${x}" y="${cTop}" width="${w}" height="${H - cTop}" fill="url(#bl-waveSky)"/>`;
    s += `<path d="M ${x + w * 0.4} ${cBot - 26} L ${x + w * 0.5} ${cTop + 30} L ${x + w * 0.6} ${cBot - 26} Z" fill="#6b86a8" opacity=".5"/>`; // distant fuji
    // the great wave: a big curl
    s += `<path d="M ${x} ${cBot} Q ${x + w * 0.16} ${cTop + 24} ${x + w * 0.5} ${cTop + 30} Q ${x + w * 0.84} ${cTop + 36} ${x + w * 0.86} ${cBot - 50} Q ${x + w * 0.7} ${cTop + 58} ${x + w * 0.44} ${cBot - 30} Q ${x + w * 0.2} ${cBot} ${x} ${cBot} Z" fill="url(#bl-waveBlue)"/>`;
    s += `<path d="M ${x} ${cBot} Q ${x + w * 0.2} ${cBot - 20} ${x + w * 0.42} ${cBot - 20} Q ${x + w * 0.2} ${cBot - 6} ${x} ${cBot} Z" fill="#2f63a6"/>`;
    // foam claws
    for (let k = 0; k < 7; k++) { const fxx = x + w * (0.2 + k * 0.09), fyy = cTop + 34 + (k % 2) * 8; s += `<circle cx="${fxx}" cy="${fyy}" r="${5 - (k % 3)}" fill="#f6f3e6"/>`; }
    s += `<path d="M ${x + w * 0.5} ${cTop + 30} q 8 -6 16 0 q -4 6 -12 5 Z" fill="#f6f3e6"/>`;
    return s;
  }
  if (art === 'seigaiha') {
    let s = `<rect x="${x}" y="${cTop}" width="${w}" height="${H - cTop}" fill="#173a63"/>`;
    for (let ry = cTop + 10; ry < cBot + 10; ry += 14) {
      for (let rx = x - 10; rx < W + 14; rx += 24) {
        const off = ((ry - cTop) / 14) % 2 ? 12 : 0;
        s += `<g fill="none" stroke="#bfe0f5" stroke-width="1.6" opacity=".8"><circle cx="${rx + off}" cy="${ry}" r="11"/><circle cx="${rx + off}" cy="${ry}" r="7" stroke="#7fb8e0"/><circle cx="${rx + off}" cy="${ry}" r="3.4" stroke="#bfe0f5"/></g>`;
      }
    }
    return s;
  }
  if (art === 'sakura') {
    let s = `<rect x="${x}" y="${cTop}" width="${w}" height="${H - cTop}" fill="url(#bl-sakSky)"/>`;
    s += `<path d="M ${x} ${cTop + 18} Q ${x + w * 0.4} ${cTop + 30} ${x + w * 0.7} ${cTop + 8} M ${x + w * 0.45} ${cTop + 27} Q ${x + w * 0.55} ${cTop + 46} ${x + w * 0.5} ${cBot - 10}" stroke="#6b4a2e" stroke-width="3" fill="none"/>`;
    const bl = [[0.18, 28], [0.34, 18], [0.5, 30], [0.62, 16], [0.72, 12], [0.4, 42], [0.58, 40]];
    for (const [fx, fy] of bl) {
      const bx = x + w * fx, by = cTop + fy;
      s += `<g fill="#ff9ec4">`;
      for (let p = 0; p < 5; p++) { const a = p * 72 * Math.PI / 180; s += `<circle cx="${(bx + Math.cos(a) * 5).toFixed(1)}" cy="${(by + Math.sin(a) * 5).toFixed(1)}" r="4"/>`; }
      s += `<circle cx="${bx}" cy="${by}" r="2.5" fill="#ffd24d"/></g>`;
    }
    return s;
  }
  return `<rect x="${x}" y="${cTop}" width="${w}" height="${H - cTop}" fill="url(#bl-white)"/>`;
}

/** The anime power-up burst BEHIND the live car: spinning concentration-lines, drifting
 *  god-rays, and a STATIC cyan aura radial (the aura is a gradient, not a filter — the
 *  prototype's #bloom over these lines was dropped for perf). Counts are capped.
 *  Reproduced from the prototype's powerUp(); wrapped in .bl-live so it only shows on
 *  the current car. */
function powerUpBack(cx, cy, w) {
  let b = `<g class="bl-live"><g class="bl-conc">`;
  for (let k = 0; k < 44; k++) {
    const a = k * Math.PI / 22, r1 = 66 + (k % 3) * 6, r2 = 158 + (k % 4) * 22;
    b += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}" stroke="#bfefff" stroke-width="${k % 2 ? 1 : 2.4}" opacity="${k % 2 ? .22 : .5}"/>`;
  }
  b += `</g><g class="bl-rays" opacity=".5">`;
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, a2 = a + 0.085;
    b += `<path d="M ${cx} ${cy} L ${(cx + Math.cos(a) * 230).toFixed(1)} ${(cy + Math.sin(a) * 230).toFixed(1)} L ${(cx + Math.cos(a2) * 230).toFixed(1)} ${(cy + Math.sin(a2) * 230).toFixed(1)} Z" fill="#9fe9ff" opacity=".16"/>`;
  }
  b += `</g><ellipse class="bl-aura" cx="${cx}" cy="${cy}" rx="${(w * 0.85).toFixed(0)}" ry="118" fill="url(#bl-auraG)"/></g>`;
  return b;
}

/** The power-up FRONT layer over the live car: a bright rim outline, streaking
 *  speed-lines / sparks, drifting petals, and the NOW! lockup. Reproduced from the
 *  prototype's now-treatment, minus the per-frame nowtag drop-shadow (dropped for
 *  perf). All counts are capped. Wrapped in .bl-live (shown on .rt-car--current).
 *  `nowText` is the localized NOW word. */
function powerUpFront(x, w, cx, lead, cab, nowText) {
  let s = `<g class="bl-live">`;
  // bright cyan rim hugging the live car (static — the glow drop-shadow is on the art)
  s += `<path d="${carPath(x, w, lead, cab)}" fill="none" stroke="#dffaff" stroke-width="2" opacity=".85"/>`;
  // speed-lines streaking past, off the leading edge — capped at 8
  for (let k = 0; k < 8; k++) {
    const sy = cTop + 12 + k * 18, du = (0.5 + (k % 3) * 0.16).toFixed(2);
    s += `<g class="bl-speed" style="--bl-d:${du}s"><rect x="${x - 12}" y="${sy}" width="15" height="2.2" rx="1" fill="#dffaff"/></g>`;
  }
  // forward-flying sparks off the nose — capped at 6
  for (let k = 0; k < 6; k++) {
    const sy = cTop + 20 + k * 16, du = (0.6 + (k % 3) * 0.18).toFixed(2);
    s += `<g class="bl-spark" style="animation-duration:${du}s;animation-delay:-${(k * 0.14).toFixed(2)}s"><circle cx="${x - 6}" cy="${sy}" r="2.4" fill="#dffaff"/></g>`;
  }
  // the NOW! lockup, popping above the car (no animated shadow — perf)
  const tx = cx, ty = cTop - 56;
  s += `<g class="bl-nowtag"><path d="M ${tx - 60} ${ty} L ${tx - 46} ${ty - 16} L ${tx + 52} ${ty - 18} L ${tx + 64} ${ty - 2} L ${tx + 50} ${ty + 16} L ${tx - 48} ${ty + 18} Z" fill="#ffd34d" stroke="#fff" stroke-width="2"/>`;
  s += `<text x="${tx - 4}" y="${ty + 5}" text-anchor="middle" font-weight="900" font-size="18" font-style="italic" fill="#2a1a06" font-family="ui-sans-serif,system-ui" letter-spacing="1">${esc(nowText)}!</text>`;
  s += `<text x="${tx + 36}" y="${ty - 20}" font-weight="800" font-size="11" fill="#8fe6ff" font-family="system-ui">発車</text></g>`;
  return s + `</g>`;
}

/** Bottom-anchored stacked time lines (1 line for relative, up to 3 for tz). */
function timeTspans(lines, x, baseY) {
  return lines
    .map((line, i) => `<tspan x="${x}" y="${baseY - (lines.length - 1 - i) * TIME_LH}">${esc(line)}</tspan>`)
    .join('');
}

/** Rewrite a .bl-time block in place on a time tick — text only, no structure. */
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

/** Render one shinkansen car. Returns { art, front, live }:
 *  - art   — the STATIC .bullet-art group (the glow drop-shadow target; the
 *            lead-badge pinner also looks for a child whose class ends in -art): the
 *            clipped art scene, window band, livery, body edge/rim, the skirted
 *            undercarriage, the rider's avatar medallion, the name + time, PLAYED stamp.
 *  - front — empty (.bl-front, a SIBLING of the art): a shinkansen shows no wheels, so
 *            there's nothing here; the layer is kept for structural parity.
 *  - live  — the anime power-up front layer (.bl-live, shown on .rt-car--current).
 *  The power-up BACK burst is added by the caller behind the whole car. */
function bulletCar(v, x, w, i, isEngine) {
  const lead = isEngine;
  const cab = Boolean(v.isCaboose);
  const spot = Boolean(v.isSpotlit);
  const clip = `bl-c${i}`;
  const art = lead ? 'sakura' : artFor(v.slotOrder);

  // STATIC art (.bullet-art — glow-filtered + cached). The clipped Japanese scene,
  // the window band, the livery frame, the body edge + rim-light, the bogie.
  let s = `<g class="bullet-art">`;
  s += `<clipPath id="${clip}"><path d="${carPath(x, w, lead, cab)}"/></clipPath>`;
  s += `<g clip-path="url(#${clip})">`;
  s += scene(art, x, w);
  // translucent window band over the art (reads as a train, art still shows through)
  const wx = lead ? x + 120 : x + 18, ww = lead ? w - 138 : w - 34, wy = cTop + 16, wh = 20;
  s += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" rx="10" fill="#0a1c28" opacity=".42"/>`;
  for (let gx = wx + 18; gx < wx + ww - 8; gx += 24) s += `<line x1="${gx}" y1="${wy}" x2="${gx}" y2="${wy + wh}" stroke="#0a1a26" stroke-width="2" opacity=".5"/>`;
  s += `<rect x="${wx}" y="${wy}" width="${ww}" height="6" rx="3" fill="#fff" opacity=".25"/>`;
  // livery frame: slim green roof strip + pink pinstripe (keeps shinkansen identity)
  s += `<rect x="${x - 4}" y="${cTop - 2}" width="${w + 8}" height="8" fill="#1fae66"/><rect x="${x - 4}" y="${cTop + 6}" width="${w + 8}" height="3" fill="#ff4f8b"/>`;
  // STATIC specular sweep (the prototype's animated .sweep was a per-frame cost we
  // drop — kept as a single static highlight band, still reads glossy)
  s += `<rect x="${x + w * 0.18}" y="${cTop}" width="40" height="${cBot - cTop}" fill="url(#bl-sweepG)" transform="skewX(-18)" opacity=".4"/>`;
  s += `</g>`;
  // body edge + rim light (bright top edge), as dashed accents
  s += `<path d="${carPath(x, w, lead, cab)}" fill="none" stroke="#8295a1" stroke-width="1.3"/>`;
  s += `<path d="${carPath(x, w, lead, cab)}" fill="none" stroke="#eef7ff" stroke-width="1.4" opacity=".7" stroke-dasharray="${lead ? '120 600' : '90 500'}" stroke-dashoffset="-8"/>`;
  // Skirted undercarriage — a shinkansen shows NO exposed wheels: the body fairs down
  // over enclosed bogies to just above the guideway. A dark skirt grounds the car on the
  // rail, with subtle recessed bogie blocks where the trucks sit.
  const skTop = cBot - 2, skBot = railY + 4;
  s += `<rect x="${x + 10}" y="${skTop}" width="${w - 20}" height="${skBot - skTop}" rx="6" fill="#121b24"/>`;
  s += `<rect x="${x + 10}" y="${skTop}" width="${w - 20}" height="3.5" rx="1.5" fill="#33485a" opacity=".7"/>`;
  for (const bcx of (lead ? [x + 64, x + w * 0.5, x + w - 64] : [x + 44, x + w - 44])) {
    s += `<rect x="${(bcx - 20).toFixed(0)}" y="${skBot - 11}" width="40" height="13" rx="5" fill="#0a1016"/>`;
  }
  // avatar medallion (bottom-centre so the art stays visible above it). avatarSVG
  // paints initials first, then the (clipped) image, so a 404 shows initials.
  const acx = lead ? x + w - 60 : x + w / 2, acy = cBot - 20, R = lead ? 28 : 25;
  const ring = spot ? COL.spot : '#27bd72';
  s += `<circle cx="${acx}" cy="${acy}" r="${R + 4}" fill="#0e1c26"/><circle cx="${acx}" cy="${acy}" r="${R + 4}" fill="none" stroke="#eaf2f8" stroke-width="3"/>`;
  s += avatarSVG(`bl-av-${i}`, acx, acy, R, v.image, v.name, ring);
  // Spotlit halo (prototype's glowing purple staff-pick ring) — hidden until
  // .rt-car--spotlit reveals it via CSS, so spotlight can toggle on a tick without a rebuild.
  s += `<circle class="bl-halo" cx="${acx}" cy="${acy}" r="${R + 9}" fill="none" stroke="${COL.spot}" stroke-width="2" opacity=".7"/>`;
  // E5-series car number plate (a touch of authentic shinkansen flavour)
  s += `<text x="${lead ? x + 154 : x + 16}" y="${cBot - 3}" font-weight="800" font-size="10" fill="#43545f" font-family="system-ui" letter-spacing="1">E5・${esc(initials(v.name))}</text>`;
  // the rider's name + time, on the platform below the car
  s += `<text class="rt-fit" data-maxw="${w - 16}" x="${centerX(x, w)}" y="${railY + 44}" text-anchor="middle" font-weight="800" font-size="16" font-family="ui-sans-serif,system-ui" fill="${v.isCurrent ? '#fff' : '#eaf2f8'}">${esc(v.name)}</text>`;
  s += `<text class="bl-time" x="${centerX(x, w)}" y="${railY + 62}" text-anchor="middle" font-weight="700" font-size="12" font-family="system-ui" fill="#7d93a4">${timeTspans(v.timeLines ?? [''], centerX(x, w), railY + 62)}</text>`;
  // PLAYED stamp — hidden until departed (revealed by CSS). Light ink on a translucent
  // backing so it reads over the art, angled across the body. Booked cars only.
  const sy = cTop + 4;
  s += `<g class="bl-stamp" transform="rotate(-6 ${centerX(x, w)} ${sy})"><rect x="${centerX(x, w) - 38}" y="${sy - 14}" width="76" height="26" rx="4" fill="#0c1620" opacity="0.8" stroke="#9fc4d8" stroke-width="2"/><text x="${centerX(x, w)}" y="${sy + 4}" text-anchor="middle" font-weight="800" font-size="13" fill="#cfe6f2" letter-spacing="1">${esc(L('overlay.played'))}</text></g>`;
  s += `</g>`;

  // No spinning wheels — a shinkansen rides on enclosed bogies (the skirt above). The
  // .bl-front sibling layer stays empty here.
  const front = '';

  // The anime power-up front layer — only the current car reveals it (.bl-live).
  const live = powerUpFront(x, w, centerX(x, w), lead, cab, L('overlay.now'));
  return { art: s, front, live };
}

/** The OPEN "sit-in" slot — a dashed ghost car, no art scene/avatar. */
function bulletOpen(v, x, w, i) {
  const cx = centerX(x, w);
  let s = `<g class="bullet-art">`;
  s += `<path d="${carPath(x, w, false, false)}" fill="#0c141d" opacity=".4"/>`;
  s += `<path d="${carPath(x, w, false, false)}" fill="none" stroke="#3f5870" stroke-width="2.5" stroke-dasharray="9 8"/>`;
  s += `<text x="${cx}" y="${cBot - 40}" text-anchor="middle" font-weight="900" font-size="22" fill="#5f7e96" font-family="ui-sans-serif,system-ui">${esc(L('overlay.open'))}</text>`;
  s += `<text x="${cx}" y="${cBot - 22}" text-anchor="middle" font-weight="700" font-size="11" fill="#5f7e96" font-family="system-ui">${esc(L('overlay.signUp'))}</text>`;
  s += `<text class="bl-time" x="${cx}" y="${railY + 62}" text-anchor="middle" font-weight="700" font-size="12" font-family="system-ui" fill="#7d93a4">${timeTspans(v.timeLines, cx, railY + 62)}</text>`;
  // a faint skirt grounds the ghost car on the rail (no wheels — same as a real car)
  s += `<rect x="${x + 10}" y="${cBot - 2}" width="${w - 20}" height="${railY + 4 - (cBot - 2)}" rx="6" fill="#0c141d" opacity=".4"/>`;
  s += `</g>`;
  const front = '';
  return { art: s, front, live: '' };
}

/* 3) build(train, opts) — build the Train art ONCE and return a handle. toVehicles()
 *    flattens the live view-model: vehicles[0] is the locomotive (the ORGANISER, who
 *    conducts the train) = the lead car = ALWAYS sakura; the rest are the coaches. The
 *    loco carries no per-slot state (no NOW/departed/spotlight) — it dims only
 *    post-event (isDimmed). */
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
    const parts = v.isOpen ? bulletOpen(v, xs[i], w, i) : bulletCar(v, xs[i], w, i, isEngine);
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
      : `<g class="rt-pointer rt-now-bob">${pointerSVG(centerX(xs[i], w), VIEW_TOP + 26, COL.now, L('overlay.now'))}</g>`;
    // The power-up BURST behind the live coach (not the loco). It carries .bl-live, so
    // it only shows on .rt-car--current; capped element counts; static aura radial.
    const burst = isEngine ? '' : powerUpBack(centerX(xs[i], w), cBot - 30, w);
    // Layer order: power-up burst (behind), then the STATIC .bullet-art (the glow
    // target), then the empty .bl-front sibling (no wheels), then the power-up front
    // layer, then the Now pointer. The power-up doesn't sit inside .bullet-art, so the
    // cached glow bitmap never re-rasterises per frame.
    body += `<g class="rt-car${state}"${slot}>${burst}${parts.art}<g class="bl-front">${parts.front}</g>${parts.live}${pointer}</g>`;
  });

  const holder = document.createElement('div');
  // --rt-ride 0.45 — a bullet train glides tight & smooth on its guideway (only a small
  // left-right sway survives; the rock is zeroed in ensureStyles for a sleek, modern ride).
  holder.innerHTML = `<svg class="rt-theme-bullet" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:0.45">${bulletDefs()}${body}</svg>`;
  const svg = holder.firstElementChild;

  // Keep references so a time tick re-styles in place (never a rebuild).
  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((g) => {
    if (g.dataset.engine) { engineRef = { group: g, timeText: g.querySelector('.bl-time') }; return; }
    const key = Number(g.dataset.slot);
    carRefs.set(key, { group: g, timeText: g.querySelector('.bl-time') });
  });

  return {
    node: svg,
    /* update(nextTrain) — re-style state IN PLACE on the renderer's tick: toggle the
     *  shared classes (cars by slotOrder; engine by data-engine, departed = isDimmed)
     *  and rewrite the time text. Never rebuild, so the running motion isn't restarted. */
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
     *  cars (no truncation) and start the per-Car ambient undulation. */
    afterAttach() {
      fitAll(svg);
      undulate(svg);
    },
  };
}

// 4) The default export IS the Theme: register it in src/train-renderer.js.
export default { key: 'bullet', ensureStyles, build, buildTrack };
