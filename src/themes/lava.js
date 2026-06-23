/**
 * lava — Lava Lounge Theme (the "ultra mode" exception). NOT a row of separate
 * lamps: it is ONE continuous river of psychedelic wax. A single CHURNING FIELD
 * spans the whole train — mixed-size globules rise, JOIN and SEPARATE via the
 * metaball #goo, BLEND COLOUR where they cross, and FLOW ACROSS car boundaries
 * (a welded base pool connects the whole width; wide-drifting ambient globs cross
 * between cars). One slow psychedelic hue-rotate cycles the entire river together.
 * Each Broadcaster is a glass bead floating in the lava; identity = a ring + a
 * STATIC colour-glow behind it. There is NO lamp furniture — no glass tube and no
 * chrome cap/base bars (the user wanted neither): the river simply flows over a
 * translucent lounge band (buildTrack) with the beads on top, blending across the
 * whole train into one mass.
 *
 * Ported from test/manual/prototype-lava-mfa.html (the churn/colour-blend), stripped
 * to the bare river per user direction.
 *
 *  - viewBox SVG so the renderer sizes it to the Train height for free.
 *  - The locomotive is the ORGANISER's bead: no per-slot live state, dims only on
 *    isDimmed (post-event). Every booked streamer rides a coach bead.
 *  - State is toggleable classes (rt-car--current / --departed / --spotlit) so a
 *    time tick re-styles in place; the per-rider colour-glow + NOW bloom + PLAYED
 *    stamp live in the STATIC .lava-art group (the glow target & lead-badge pin).
 *    The liquid is a single shared sibling layer (it is ambient — not per-car).
 *
 * ULTRA MODE — lava is the ONE theme that deliberately keeps per-frame filters:
 *  the metaball #goo (its colour-blend) AND the hue-rotate cycle, defined ONCE and
 *  applied to the SINGLE field layer (one raster for the whole train, not N). Every
 *  other theme is filter-free; this exception MUST be OBS-tested (see
 *  docs/adr/0001-lava-per-frame-filter-exception.md).
 *
 * Transparent only — no full-bleed background.
 */
import { esc, avatarSVG, pointerSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

// The translator the builders paint with: rebound to the active locale at the
// top of build() (themeT reads config.t), English until then.
let L = themeT();

const ENG = 200;          // the loco's stretch of river is a touch wider
const CAR = 170;          // one coach's stretch, in viewBox units
const GAP = 10;           // gap between car stretches
const TOP = 40;           // top of the lava band
const BASE = 270;         // molten-pool surface line (base of the band)
const CY = 150;           // the floating bead's rest centre
const VIEW_H = 360;       // viewBox height (room for the bead bob, stamp, name, time)
const STYLE_ID = 'rt-theme-lava-style';

// No lamp furniture (no chrome cap/base, no glass tube — the user wanted neither): the
// river just flows over the translucent lounge band (buildTrack). VES_TOP marks the top
// of the lava band, used to place that backing band.
const VES_TOP = TOP - 4;

// the rainbow palette + wax/glow seeding family from the prototype
const RB = ['#ff4d6d', '#ff9f43', '#ffd23f', '#5fe38a', '#36d6ff', '#7d6dff', '#c84fd0'];
// PROTOTYPE rng — stable, deterministic so every marquee copy of the river matches
// (NOT Math.random, which would reshuffle the field on each build/copy).
function rng(s) { const x = Math.sin(s * 99.13) * 43758.5; return x - Math.floor(x); }

// PROTOTYPE motion tiers — how far/fast a glob drifts. POOL barely moves (the
// roiling base); BIG = large slow risers; AMB = wide travellers that cross between
// cars; CL = a rider's local cluster. Slow periods + tiny scale = fluid, not bouncy.
const POOL = { ax: 8, ayB: 3, ayR: 8, pxB: 15, pxR: 8, pyB: 11, pyR: 6, sc: 0.04 };
const BIG = { ax: 24, ayB: 26, ayR: 44, pxB: 26, pxR: 12, pyB: 19, pyR: 12, sc: 0.06 };
const AMB = { ax: 70, ayB: 30, ayR: 52, pxB: 21, pxR: 12, pyB: 16, pyR: 10, sc: 0.07 };  // wide → crosses cars
const CL = { ax: 18, ayB: 22, ayR: 42, pxB: 17, pxR: 10, pyB: 13, pyR: 9, sc: 0.07 };

/* 1) ensureStyles() — inject the Theme's CSS once (guarded by a style-id). Carries
 *    the prototype's keyframes (gx / gy / riderY+bobY / bub / hue), all
 *    reduced-motion-safe. State: current = reveal the NOW bloom + the NOW marker;
 *    spotlit = an accent ring; departed = a LIGHT dim + the PLAYED stamp. */
export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-lava { --rt-ride: 0.85; }
    @media (prefers-reduced-motion: reduce){ .rt-theme-lava *{ animation: none !important; } }

    /* ULTRA MODE — the psychedelic full-spectrum cycle over the WHOLE river. One of
       the two deliberate per-frame filters (the other is #goo). It rides the single
       .lava-field layer only (kept out of any drop-shadow group). */
    .rt-theme-lava .lava-field{ animation: lv-hue 18s linear infinite; }
    @keyframes lv-hue{ to{ filter: hue-rotate(360deg); } }

    /* A glob = nested groups: OUTER drifts in X (gx), INNER rises/falls in Y with a
       faint scale breath (gy). Different X vs Y periods (and per glob) weave each
       path into a slow loop, so neighbours coincide (fuse) then part (split) at
       ever-changing moments — the churn. Compositor-only; will-change hints. */
    .rt-theme-lava .gx{ animation: lv-gx var(--px,18s) ease-in-out infinite; animation-delay: var(--dx,0s); will-change: transform; }
    @keyframes lv-gx{ 0%,100%{ transform: translateX(calc(var(--ax,20px) * -1)); } 50%{ transform: translateX(var(--ax,20px)); } }
    .rt-theme-lava .gy{ transform-box: fill-box; transform-origin: center; animation: lv-gy var(--py,13s) ease-in-out infinite; animation-delay: var(--dy,0s); will-change: transform; }
    @keyframes lv-gy{ 0%{ transform: translateY(var(--ay,40px)) scale(1); } 50%{ transform: translateY(calc(var(--ay,40px) * -1)) scale(var(--s,1.06)); } 100%{ transform: translateY(var(--ay,40px)) scale(1); } }

    /* the floating bead's gentle bob (faster when live) */
    .rt-theme-lava .riderY{ transform-box: fill-box; transform-origin: center; animation: lv-bobY var(--p,7s) ease-in-out infinite; animation-delay: var(--d,0s); }
    .rt-theme-lava .riderY.now{ animation: lv-bobYn calc(var(--p,7s)*.8) ease-in-out infinite; }
    @keyframes lv-bobY{ 0%{ transform: translateY(8px); } 50%{ transform: translateY(-10px); } 100%{ transform: translateY(8px); } }
    @keyframes lv-bobYn{ 0%{ transform: translateY(7px); } 50%{ transform: translateY(-14px); } 100%{ transform: translateY(7px); } }

    /* glass bubbles rising in front of the liquid */
    .rt-theme-lava .bub{ transform-box: fill-box; transform-origin: center; animation: lv-bup linear infinite; }
    @keyframes lv-bup{ 0%{ opacity: 0; transform: translateY(8px) scale(.6); } 20%{ opacity: .8; } 100%{ opacity: 0; transform: translateY(-130px) scale(1); } }

    /* current: reveal the static NOW bloom (it's behind the bead). */
    .rt-theme-lava .lava-bloom{ visibility: hidden; }
    .rt-theme-lava .rt-car--current .lava-bloom{ visibility: visible; }
    /* spotlit: an accent ring on the bead (in the markup, revealed by state). */
    .rt-theme-lava .lava-spot{ visibility: hidden; }
    .rt-theme-lava .rt-car--spotlit .lava-spot{ visibility: visible; }
    /* departed: a LIGHT dim + the PLAYED stamp (legibility — viewer feedback). */
    .rt-theme-lava .rt-car--departed{ opacity: 0.84; }
    .rt-theme-lava .rt-car--departed image{ filter: saturate(0.6); }
    .rt-theme-lava .lava-stamp{ visibility: hidden; }
    .rt-theme-lava .rt-car--departed .lava-stamp{ visibility: visible; }
  `;
  document.head.appendChild(style);
}

/* 2) buildTrack() — the translucent dark LOUNGE-FLOOR band the lamp stands on. ONE
 *    stationary, full-canvas-width element (built once; .rt-rails so the renderer
 *    pins it full-width behind the train and fades it under track=periodic). It is a
 *    LOWER band — NEVER opaque, NEVER full-screen: a theme-tinted dark gradient at
 *    ~0.4 alpha (the stream shows THROUGH it dimly) so the lamp pops over a bright
 *    stream, with a warm floor uplight + a thin violet floor line. Sized in fractions
 *    of --rt-th, so it scales with the train; the top of the frame stays see-through. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-lava';
  // the band backs the river's vertical extent: its top sits near the lava-band top
  // and its height is ~0.96×--rt-th (a LOWER band — the top of frame stays see-through).
  const topFrac = ((VES_TOP - 8) / VIEW_H).toFixed(4);      // ~0.078 — just above the tube
  el.style.cssText =
    'top: calc(var(--rt-th) * ' + topFrac + ');' +
    ' height: calc(var(--rt-th) * 0.96);' +
    // TRANSLUCENT theme-tinted dark band (~0.4 alpha peak) — the stream shows THROUGH
    // it dimly so it's a backing, never opaque. A soft top fade keeps it from reading
    // as a hard slab; a warm floor uplight pools at the bottom so the lamp reads
    // grounded on the lounge floor.
    ' background:' +
      ' radial-gradient(130% 78% at 50% 100%, #ffcaa030 0%, #ffcaa000 48%),' +
      ' linear-gradient(180deg, #100c1e00 0%, #140f2826 18%, #18123059 56%, #20183a73 100%);' +
    // a thin violet floor line where the lamp meets the lounge floor.
    ' box-shadow: inset 0 calc(var(--rt-th) * -0.016) 0 #7d6dff4d;';
  return el;
}

/* PROTOTYPE glob() builder — one churning wax globule, VERBATIM motion logic.
 * cx/cyb = rest centre (absolute viewBox coords); r = radius; ci = colour index;
 * op = opacity; sd = seed; o = motion tier; fast = live (tighter periods). */
function glob(cx, cyb, r, ci, op, sd, o, fast) {
  const ax = (6 + rng(sd + 1) * o.ax).toFixed(0);
  const ay = (o.ayB + rng(sd + 2) * o.ayR).toFixed(0);
  let px = (o.pxB + rng(sd + 3) * o.pxR), py = (o.pyB + rng(sd + 4) * o.pyR);   // X & Y periods differ → weaving path
  if (fast) { px *= 0.82; py *= 0.82; }
  const dxd = (-rng(sd + 5) * px).toFixed(2), dyd = (-rng(sd + 6) * py).toFixed(2);
  const sc = (1.02 + rng(sd + 7) * o.sc).toFixed(3);
  return `<g class="gx" style="--px:${px.toFixed(2)}s;--ax:${ax}px;--dx:${dxd}s">`
       +   `<g class="gy" style="--py:${py.toFixed(2)}s;--ay:${ay}px;--dy:${dyd}s;--s:${sc}">`
       +     `<circle cx="${cx.toFixed(0)}" cy="${cyb.toFixed(0)}" r="${r.toFixed(0)}" fill="url(#lv-wx${ci % 7})" opacity="${op}"/>`
       +   `</g></g>`;
}

/* defs() — the goo metaball filter + every gradient, emitted ONCE. KEY: the goo
 * blurs to fuse globs, then a colour-matrix sharpens ALPHA (crisp silhouette) but
 * leaves RGB BLURRED — so two differently-coloured globs mix into an in-between hue
 * where they overlap (the colour-blend). ONE filter over the SINGLE field layer
 * (objectBoundingBox region = the whole river's bbox + a margin for the blur), so
 * the metaball welds globs ACROSS car boundaries. */
function defs(vehicles) {
  let d = `<defs>`;
  d += `<filter id="lv-goo" x="-2%" y="-10%" width="104%" height="120%">`
    +    `<feGaussianBlur in="SourceGraphic" stdDeviation="10" result="b"/>`
    +    `<feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -8"/>`
    +  `</filter>`;
  // the warm uplight / NOW bloom (static radial — no filter)
  d += `<radialGradient id="lv-lampGlow" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#ffd2a0" stop-opacity=".55"/><stop offset="1" stop-color="#ffd2a0" stop-opacity="0"/></radialGradient>`;
  // a soft base uplight spanning the river
  d += `<linearGradient id="lv-baseglow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcaa0" stop-opacity="0"/><stop offset="1" stop-color="#ffcaa0" stop-opacity=".4"/></linearGradient>`;
  // a glass bead body: white catch-light → deep violet-black interior (over the avatar)
  d += `<radialGradient id="lv-orb" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#241a3a"/><stop offset="1" stop-color="#0c0814"/></radialGradient>`;
  // wax gradients — a modest white centre so blended overlaps read as COLOUR
  // (orange + blue → violet), not a white-out.
  for (let i = 0; i < 7; i++) {
    d += `<radialGradient id="lv-wx${i}" cx=".4" cy=".34" r="1.0"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".16" stop-color="${RB[i]}"/><stop offset=".62" stop-color="${RB[(i + 2) % 7]}"/><stop offset="1" stop-color="${RB[(i + 4) % 7]}"/></radialGradient>`;
  }
  // one static identity glow per vehicle, tinted to its slot colour.
  vehicles.forEach((_, i) => {
    const c = RB[i % 7];
    d += `<radialGradient id="lv-glow${i}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${c}" stop-opacity=".5"/><stop offset=".55" stop-color="${c}" stop-opacity=".18"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  });
  return d + `</defs>`;
}

/** The SINGLE churning river spanning the whole train. A continuous welded base
 *  pool connects every car; each car adds a slow riser, a wide-drifting ambient
 *  glob (crosses boundaries → cross-car blend), and a small colour-tinted cluster
 *  near its bead. All seeded from positions/indices so marquee copies match. */
function riverField(vehicles, xs, widthOf, totalW) {
  let g = '';
  // welded molten base pool across the WHOLE width — the goo melts it into one
  // roiling floor that ties the cars together; risers pinch off it.
  for (let bx = 28; bx <= totalW - 28; bx += 66) {
    const sd = bx * 0.073;
    g += glob(bx, BASE - 6, 24 + rng(sd) * 12, Math.floor(rng(sd + 4) * 7), '1', sd, POOL, false);
  }
  vehicles.forEach((v, i) => {
    const x = xs[i], w = widthOf(i), cx = x + w / 2, base = i * 17.0 + 3.1;
    const fast = Boolean(v.isCurrent);
    // a large slow riser climbing the band
    { const sd = base + 40; g += glob(x + 28 + rng(sd + 8) * (w - 56), CY + rng(sd + 9) * 90, 22 + rng(sd + 10) * 12, Math.floor(rng(sd + 11) * 7), '1', sd, BIG, false); }
    // a wide ambient traveller — large --ax so it drifts across the car boundary and
    // fuses with the neighbour's lava (the "blend together" the user asked for)
    { const sd = base + 70; g += glob(cx, TOP + 40 + rng(sd + 9) * (BASE - TOP - 90), 13 + rng(sd + 10) * 10, Math.floor(rng(sd + 11) * 7), '1', sd, AMB, false); }
    // colour-tinted cluster near the bead (loose identity), skipped on open slots
    if (!v.isOpen) {
      const n = fast ? 3 : 2;
      for (let m = 0; m < n; m++) {
        const sd = base + 100 + m * 4.7;
        const gx = cx + (rng(sd + 1) - 0.5) * (w * 0.62);
        const gyb = CY - 20 + rng(sd + 2) * 90;
        const r = (m === 0 ? 20 : 12) + rng(sd + 3) * 10;
        g += glob(gx, gyb, r, i, '1', sd, CL, fast);
      }
    }
  });
  return g;
}

/** The bead body for a non-open slot — a glass orb with initials, ring, and a
 *  hidden spot-ring revealed when spotlit. The image (avatarSVG) over the orb so
 *  a 404 still shows initials. `id` MUST be unique per car (the clip-path ref). */
function bead(id, cx, cy, R, v, isEngine) {
  const ring = isEngine ? '#f3c969' : '#ffffffcc';
  // a glass shell halo just outside the avatar — reads the bead as an orb of glass
  // bobbing in the wax (the prototype's #orb body, but kept BEHIND avatarSVG so a
  // 404 still falls back to initials on the dark disc).
  let s = `<circle cx="${cx}" cy="${cy}" r="${(R + 3).toFixed(1)}" fill="url(#lv-orb)" opacity=".7"/>`;
  s += avatarSVG(id, cx, cy, R, v.image, v.name, ring);
  // a glassy specular highlight on top, so the bead reads as a glass orb in lava.
  s += `<ellipse cx="${(cx - R * 0.32).toFixed(1)}" cy="${(cy - R * 0.4).toFixed(1)}" rx="${(R * 0.42).toFixed(1)}" ry="${(R * 0.26).toFixed(1)}" fill="#fff" opacity=".55" pointer-events="none"/>`;
  // spotlight accent ring (hidden until .rt-car--spotlit).
  s += `<circle class="lava-spot" cx="${cx}" cy="${cy}" r="${R + 5}" fill="none" stroke="#a78bfa" stroke-width="2" opacity=".85"/>`;
  return s;
}

/** Build ONE car's STATIC art group (.lava-art): identity glow + NOW bloom + the
 *  floating bead + name + time + PLAYED stamp. (No lamp furniture — the river + lounge
 *  band are shared layers.) This is the glow target and the lead-badge pin (class ends -art). */
function carArt(v, x, w, i, isEngine) {
  const cx = x + w / 2;
  const R = isEngine ? 30 : v.isCurrent ? 28 : 25;
  let art = '';
  // the static colour identity glow, low under the bead (no filter)
  if (!v.isOpen) art += `<ellipse cx="${cx}" cy="${CY + 12}" rx="${(w * 0.5).toFixed(0)}" ry="120" fill="url(#lv-glow${i})"/>`;
  // the NOW bloom — static radial behind the bead, revealed by .rt-car--current.
  art += `<ellipse class="lava-bloom" cx="${cx}" cy="${CY}" rx="${(w * 0.66).toFixed(0)}" ry="104" fill="url(#lv-lampGlow)" opacity=".55"/>`;

  // the bead (floating, gentle bob via .riderY)
  const bobP = (6.5 + (i % 4) * 0.8).toFixed(2);
  const bobD = (-i * 0.7).toFixed(2);
  const live = v.isCurrent ? ' now' : '';
  if (v.isOpen) {
    art += `<g class="riderY${live}" style="--p:${bobP}s;--d:${bobD}s">`
      +    `<circle cx="${cx}" cy="${CY}" r="${R}" fill="none" stroke="#ffffffaa" stroke-width="3" stroke-dasharray="9 8"/>`
      +    `<text x="${cx}" y="${CY + 5}" text-anchor="middle" font-weight="900" font-size="14" fill="#fff" font-family="ui-sans-serif,system-ui,sans-serif">${esc(L('overlay.open'))}</text>`
      +    `</g>`;
  } else {
    art += `<g class="riderY${live}" style="--p:${bobP}s;--d:${bobD}s">${bead(`lv-av-${i}`, cx, CY, R, v, isEngine)}</g>`;
  }

  // name + time below the river (rt-fit so it never truncates).
  const nameY = BASE + 54;
  art += `<text class="rt-fit" data-maxw="${w - 14}" x="${cx}" y="${nameY}" text-anchor="middle" font-weight="900" font-size="16" fill="${v.isCurrent ? '#fff' : '#f0eaff'}" font-family="ui-sans-serif,system-ui,sans-serif">${esc(v.name)}</text>`;
  if (!v.isOpen) {
    art += `<text class="lava-time" x="${cx}" y="${nameY + 16}" text-anchor="middle" font-weight="700" font-size="12" fill="#b9a9d8" font-family="system-ui,sans-serif">${esc((v.timeLines && v.timeLines[0]) || '')}</text>`;
  } else {
    art += `<text class="lava-time" x="${cx}" y="${nameY + 16}" text-anchor="middle" font-weight="700" font-size="12" fill="#6ee7a7" font-family="system-ui,sans-serif">${esc(L('overlay.signUp'))}</text>`;
  }

  // PLAYED stamp — only a booked slot can be played; hidden until departed.
  if (!v.isOpen) {
    const sx = cx, sy = CY + 8;
    art += `<g class="lava-stamp" transform="rotate(-9 ${sx} ${sy})">`
      +    `<rect x="${sx - 42}" y="${sy - 15}" width="84" height="30" rx="4" fill="#15101c" opacity=".7" stroke="#cdbfe0" stroke-width="2.5"/>`
      +    `<text x="${sx}" y="${sy + 6}" text-anchor="middle" font-weight="900" font-size="15" fill="#e6ddff" letter-spacing="2" font-family="system-ui,sans-serif">${esc(L('overlay.played'))}</text>`
      +    `</g>`;
  }
  return art;
}

/* 3) build(train, opts) — build the Train art ONCE and return a handle. The liquid
 *    is ONE shared field layer spanning the whole train (cross-car blend); the
 *    per-car .rt-car groups carry only the bead/labels/state on top. */
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

  // ── the single shared liquid layer (its own hue cycle + the one goo) ──────────
  const river = `<g class="lava-field"><g filter="url(#lv-goo)">${riverField(vehicles, xs, widthOf, totalW)}</g></g>`;
  // a soft base uplight spanning the whole width, behind the liquid
  const baseGlow = `<rect x="0" y="${BASE - 40}" width="${totalW}" height="70" fill="url(#lv-baseglow)"/>`;
  // No lamp furniture (no chrome bars, no glass tube — the user wanted neither): the
  // river flows over the translucent lounge band (buildTrack) with the beads on top.
  // rising glass bubbles sprinkled across the width, in front of the liquid
  let bubbles = '<g class="lava-bubbles">';
  for (let k = 0; k < Math.max(8, Math.round(totalW / 90)); k++) {
    const sd = k * 7.3 + 1.1;
    const bx = 24 + rng(sd + 3) * (totalW - 48);
    const du = (5 + rng(sd) * 4).toFixed(1);
    bubbles += `<circle class="bub" cx="${bx.toFixed(0)}" cy="${BASE - 12}" r="${(1.4 + rng(sd) * 2).toFixed(1)}" fill="#eafaff" opacity="0" style="animation-duration:${du}s;animation-delay:-${(k * 0.9).toFixed(1)}s"/>`;
  }
  bubbles += '</g>';

  // ── the per-car groups (bead/labels/state) on TOP of the shared river ─────────
  let cars = '';
  vehicles.forEach((v, i) => {
    const w = widthOf(i);
    const isEngine = v.kind === 'engine';
    const departed = isEngine ? v.isDimmed : v.isDeparted;
    const state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (departed ? ' rt-car--departed' : '');
    const slot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
    const cx = xs[i] + w / 2;
    const pointer = v.isOpen ? '' : `<g class="rt-pointer rt-now-bob">${pointerSVG(cx, 18, '#36d6ff', L('overlay.now'))}</g>`;
    cars += `<g class="rt-car${state}"${slot}><g class="lava-art">${carArt(v, xs[i], w, i, isEngine)}</g>${pointer}</g>`;
  });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-lava" viewBox="0 0 ${totalW} ${VIEW_H}" role="img">${defs(vehicles)}${baseGlow}${river}${bubbles}${cars}</svg>`;
  const svg = holder.firstElementChild;

  // Keep references so a time tick re-styles in place (never a rebuild).
  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((g) => {
    const timeText = g.querySelector('.lava-time');
    if (g.dataset.engine) { engineRef = { group: g, timeText }; return; }
    carRefs.set(Number(g.dataset.slot), { group: g, timeText });
  });

  return {
    node: svg,
    /* update(nextTrain) — re-style state IN PLACE: toggle the shared classes and
     *  rewrite the time text only. The shared river is ambient and never rebuilt. */
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        const ref = carRefs.get(car.slotOrder);
        if (!ref) continue;
        ref.group.classList.toggle('rt-car--current', car.isCurrent);
        ref.group.classList.toggle('rt-car--departed', car.isDeparted);
        ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
        if (ref.timeText) ref.timeText.textContent = (car.timeLines && car.timeLines[0]) || car.relativeTime || '';
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        // The loco dims only post-event (isDimmed), never on a per-slot departed.
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        if (engineRef.timeText) engineRef.timeText.textContent = (eng.timeLines && eng.timeLines[0]) || eng.relativeTime || '';
      }
    },
    /* afterAttach() — fit the names (no truncation) and start the per-Car ambient
     *  undulation (sway + rock; rides a touch tight via --rt-ride). */
    afterAttach() {
      fitAll(svg);
      undulate(svg);
    },
  };
}

// 4) The default export IS the Theme: register it in src/train-renderer.js.
export default { key: 'lava', ensureStyles, build, buildTrack };
