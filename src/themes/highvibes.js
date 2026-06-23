/**
 * highvibes — "High Vibes" Theme: leaf-FORWARD potted cannabis plants.
 *
 * Ported from the signed-off, filter-FREE prototype
 * (test/manual/prototype-highvibes-mfa.html — the "MFA" perf-safe rework). One
 * potted plant per vehicle: a big detailed 7-point fan leaf dominant on top,
 * small glossy colas (soft brown/red/purple curling pistils + frost) peeking
 * from under the leaves, a frosted avatar medallion in front, planted in a tall
 * terracotta pot, with a few pot-leaves drifting freely above each plant.
 *
 *  - viewBox SVG only (the renderer sizes it to the Train height for free).
 *  - vehicles[0] is the locomotive = the ORGANISER, who conducts the train. It
 *    carries no per-slot live state (no NOW marker, no departed); it dims only
 *    on isDimmed (the Event is over). Every booked streamer rides a coach.
 *  - State is the shared .rt-car--current / --spotlit / --departed classes the
 *    renderer toggles on a tick, so a tick re-styles in place (never a rebuild).
 *
 * ZERO SVG filters (deliberate, for OBS perf). Every glow is a STATIC radial
 * GRADIENT behind the art, or a CSS drop-shadow over the STATIC art group; every
 * motion is a compositor transform/opacity, reduced-motion-safe. No JS timers, so
 * no teardown is needed. (Builder functions, gradients, and @keyframes are lifted
 * from the prototype verbatim where possible.)
 */
import { esc, initials, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

// The translator the builders paint with: rebound to the active locale at the top
// of build() (themeT reads config.t), English until then. Viewer-facing words
// (OPEN / NOW / sign up! / PLAYED) come from L('overlay.*'), never hardcoded.
let L = themeT();

const ENG = 240;          // the locomotive (organiser) plant is a touch wider
const CAR = 210;          // one coach plant's width, in viewBox units
const GAP = 0;            // plants are self-contained; the train scrolls them apart visually
const VIEW_H = 400;       // viewBox height — all the art lives inside this box
const baseY = 300;        // the soil/ground line (the pot foot sits near here)
const cy = 176;           // the plant emblem's vertical centre
const STYLE_ID = 'rt-theme-highvibes-style';

/* Stable per-key pseudo-random in [0,1) — deterministic so a re-render (and every
 * marquee copy) keeps each plant's frost/pistil/soil scatter identical. */
const rng = (s) => { const x = Math.sin(s * 99.13) * 43758.5; return x - Math.floor(x); };

/* 1) ensureStyles() — inject the Theme's CSS once (keyed by an id). The Now /
 *    Spotlight GLOW is a CSS drop-shadow over the STATIC .hv-art group (the
 *    drifting leaves ride a sibling .hv-front layer), so a lit plant's filter
 *    bitmap caches across frames instead of re-rasterising the moving leaves
 *    (memory theme-rendering-constraints). Departed = a LIGHT opacity dim + a
 *    revealed PLAYED stamp, never heavy shade (viewer feedback). All ambient
 *    motion is compositor transform/opacity and disabled under reduced-motion. */
export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-highvibes .rt-car--current .hv-art { filter: drop-shadow(0 0 4px #7fff9f) drop-shadow(0 0 10px #5fc54f); }
    .rt-theme-highvibes .rt-car--spotlit .hv-art { filter: drop-shadow(0 0 4px #c9a8ef) drop-shadow(0 0 10px #a78bfa); }
    .rt-theme-highvibes .rt-car--current.rt-car--spotlit .hv-art { filter: drop-shadow(0 0 4px #7fff9f) drop-shadow(0 0 9px #a78bfa); }

    /* A handed-off Slot stays readable — a LIGHT dim + a PLAYED stamp, not heavy shade. */
    .rt-theme-highvibes .rt-car--departed { opacity: 0.84; }
    .rt-theme-highvibes .rt-car--departed image { filter: saturate(0.55); }
    .rt-theme-highvibes .hv-stamp { visibility: hidden; }
    .rt-theme-highvibes .rt-car--departed .hv-stamp { visibility: visible; }

    /* ── Ambient motion (compositor-only, reduced-motion-safe) ── */
    .rt-theme-highvibes .hv-leaf { transform-box: fill-box; transform-origin: center; animation-timing-function: linear; animation-iteration-count: infinite; will-change: transform; }
    /* Bigger, RIGHTWARD-biased tumble loops: the train rolls forward (LEFT), so the
       leaves waft up and trail backwards to the RIGHT (mostly +x), then settle. Larger
       amplitude than before = more movement. Closed loops so leaves never fly off. */
    @keyframes hv-driftA { 0%{transform:translate(0,0) rotate(0)} 25%{transform:translate(76px,-32px) rotate(95deg)} 50%{transform:translate(108px,-66px) rotate(185deg)} 75%{transform:translate(54px,-24px) rotate(280deg)} 100%{transform:translate(0,0) rotate(360deg)} }
    @keyframes hv-driftB { 0%{transform:translate(0,0) rotate(0)} 30%{transform:translate(48px,-44px) rotate(-130deg)} 64%{transform:translate(98px,-20px) rotate(-250deg)} 100%{transform:translate(0,0) rotate(-360deg)} }
    @keyframes hv-driftC { 0%{transform:translate(0,0) rotate(0)} 22%{transform:translate(52px,-18px) rotate(70deg)} 55%{transform:translate(92px,-58px) rotate(190deg)} 84%{transform:translate(42px,-12px) rotate(305deg)} 100%{transform:translate(0,0) rotate(360deg)} }
    /* The soil leaf-bed gently sways about its rooted base (compositor transform). */
    .rt-theme-highvibes .hv-bedleaf { transform-box: fill-box; transform-origin: center bottom; animation: hv-bedsway var(--bp,6s) ease-in-out infinite; will-change: transform; }
    @keyframes hv-bedsway { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
    /* Drifting spores rise + fade (opacity + transform only, never a filter/bloom). */
    .rt-theme-highvibes .hv-spore { transform-box: fill-box; transform-origin: center; animation: hv-rise linear infinite; will-change: transform, opacity; }
    @keyframes hv-rise { 0%{opacity:0; transform:translateY(8px) scale(.6)} 25%{opacity:.85} 100%{opacity:0; transform:translate(12px,-66px) scale(1.1)} }

    /* ── The stationary SCENE BAND (buildTrack) — a translucent backing + a
       rolling-hill landscape. The whole band is ONE element the renderer pins
       full-width behind the train and fades under track=periodic. Its hill
       layers drift sideways in place (compositor translate only), the resin
       ground glow breathes (opacity), and a few ambient motes rise — NO filters. */
    .rt-theme-highvibes .hv-scene { position: absolute; inset: 0; overflow: hidden; }
    .rt-theme-highvibes .hv-scene-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .rt-theme-highvibes .hv-hill { will-change: transform; animation: var(--hd, hv-hillA) var(--ht, 26s) ease-in-out infinite; }
    @keyframes hv-hillA { 0%,100%{transform:translateX(0)} 50%{transform:translateX(22px)} }
    @keyframes hv-hillB { 0%,100%{transform:translateX(0)} 50%{transform:translateX(-30px)} }
    @keyframes hv-hillC { 0%,100%{transform:translateX(0)} 50%{transform:translateX(16px)} }
    .rt-theme-highvibes .hv-groundglow { will-change: opacity; animation: hv-glowpulse 9s ease-in-out infinite; }
    @keyframes hv-glowpulse { 0%,100%{opacity:.5} 50%{opacity:.95} }
    .rt-theme-highvibes .hv-mote { will-change: transform, opacity; animation: hv-moterise linear infinite; }
    @keyframes hv-moterise { 0%{opacity:0; transform:translateY(10px) scale(.6)} 30%{opacity:.7} 100%{opacity:0; transform:translate(8px,-60px) scale(1.05)} }
    .rt-theme-highvibes .hv-scene-leaf { will-change: transform; animation: var(--sd, hv-driftA) var(--st, 30s) linear infinite; transform-box: fill-box; transform-origin: center; }

    @media (prefers-reduced-motion: reduce) {
      .rt-theme-highvibes .hv-leaf,
      .rt-theme-highvibes .hv-bedleaf,
      .rt-theme-highvibes .hv-spore,
      .rt-theme-highvibes .hv-hill,
      .rt-theme-highvibes .hv-groundglow,
      .rt-theme-highvibes .hv-mote,
      .rt-theme-highvibes .hv-scene-leaf { animation: none; }
    }
  `;
  document.head.appendChild(style);
}

/* The shared <defs> — every gradient lifted verbatim from the prototype. Emitted
 * once at the top of the single root <svg>, so all plants reference the same ids. */
function defs() {
  return `<defs>
  <linearGradient id="hv-resin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f9a3a"/><stop offset=".5" stop-color="#1f6e2a"/><stop offset="1" stop-color="#0d3e16"/></linearGradient>
  <linearGradient id="hv-stem" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1d5226"/><stop offset=".45" stop-color="#4aa343"/><stop offset="1" stop-color="#1d5226"/></linearGradient>
  <linearGradient id="hv-leafG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1f5e2a"/><stop offset=".6" stop-color="#3f9a3a"/><stop offset="1" stop-color="#7fe06c"/></linearGradient>
  <linearGradient id="hv-leafP" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#46286f"/><stop offset=".6" stop-color="#7a4fb0"/><stop offset="1" stop-color="#c79bf0"/></linearGradient>
  <linearGradient id="hv-leafD" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#17451a"/><stop offset="1" stop-color="#2c6e2e"/></linearGradient>
  <!-- HERO fan-leaf gradients: deep base → vivid mid → frosted tip -->
  <linearGradient id="hv-heroG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0f4a18"/><stop offset=".32" stop-color="#2e7d2e"/><stop offset=".68" stop-color="#5cc34a"/><stop offset="1" stop-color="#b6f29a"/></linearGradient>
  <linearGradient id="hv-heroP" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#3a1d63"/><stop offset=".34" stop-color="#6a3fa6"/><stop offset=".7" stop-color="#a274dd"/><stop offset="1" stop-color="#e6cffb"/></linearGradient>
  <linearGradient id="hv-heroD" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#26352a"/><stop offset=".6" stop-color="#46584a"/><stop offset="1" stop-color="#717f6f"/></linearGradient>
  <linearGradient id="hv-sideG" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0c3e15"/><stop offset=".55" stop-color="#2c7a2c"/><stop offset="1" stop-color="#74d35e"/></linearGradient>
  <linearGradient id="hv-sideP" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2c1850"/><stop offset=".55" stop-color="#5e379a"/><stop offset="1" stop-color="#b48fe0"/></linearGradient>
  <linearGradient id="hv-sideD" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#1d2a20"/><stop offset="1" stop-color="#566255"/></linearGradient>
  <!-- avatar disc: dark frosted glass so white initials read -->
  <radialGradient id="hv-disc" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#1c3a24"/><stop offset=".5" stop-color="#0e2414"/><stop offset="1" stop-color="#06120a"/></radialGradient>
  <radialGradient id="hv-discN" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#2a5a36"/><stop offset=".5" stop-color="#143a20"/><stop offset="1" stop-color="#08200f"/></radialGradient>
  <radialGradient id="hv-haloG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#caffd8" stop-opacity=".55"/><stop offset=".4" stop-color="#6cff93" stop-opacity=".22"/><stop offset="1" stop-color="#6cff93" stop-opacity="0"/></radialGradient>
  <radialGradient id="hv-haloP" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e7d4ff" stop-opacity=".6"/><stop offset=".4" stop-color="#b98cff" stop-opacity=".26"/><stop offset="1" stop-color="#b98cff" stop-opacity="0"/></radialGradient>
  <radialGradient id="hv-nowglow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#eafff0" stop-opacity=".85"/><stop offset=".45" stop-color="#7fff9f" stop-opacity=".4"/><stop offset="1" stop-color="#7fff9f" stop-opacity="0"/></radialGradient>
  <!-- GLOSSY mini-cola gradients: volumetric body + glossy lobes + sheen -->
  <radialGradient id="hv-bodyG" cx=".36" cy=".26" r=".95"><stop offset="0" stop-color="#d6f6b4"/><stop offset=".26" stop-color="#86cf66"/><stop offset=".58" stop-color="#3f9636"/><stop offset=".82" stop-color="#206428"/><stop offset="1" stop-color="#103a17"/></radialGradient>
  <radialGradient id="hv-bodyP" cx=".36" cy=".26" r=".95"><stop offset="0" stop-color="#f0e0ff"/><stop offset=".24" stop-color="#c4a0ee"/><stop offset=".55" stop-color="#8a5cc4"/><stop offset=".82" stop-color="#4d2c80"/><stop offset="1" stop-color="#2a1750"/></radialGradient>
  <radialGradient id="hv-bodyD" cx=".36" cy=".26" r=".95"><stop offset="0" stop-color="#cfcabb"/><stop offset=".4" stop-color="#8f8b7c"/><stop offset=".8" stop-color="#54514a"/><stop offset="1" stop-color="#34322c"/></radialGradient>
  <radialGradient id="hv-lobeG" cx=".34" cy=".24" r=".82"><stop offset="0" stop-color="#e6ffc4"/><stop offset=".22" stop-color="#a6e07f"/><stop offset=".58" stop-color="#4ea53f"/><stop offset="1" stop-color="#1c5b23"/></radialGradient>
  <radialGradient id="hv-lobeP" cx=".34" cy=".24" r=".82"><stop offset="0" stop-color="#f7ecff"/><stop offset=".22" stop-color="#d2b4f4"/><stop offset=".58" stop-color="#8c5ec6"/><stop offset="1" stop-color="#3c2468"/></radialGradient>
  <radialGradient id="hv-lobeD" cx=".34" cy=".24" r=".82"><stop offset="0" stop-color="#dad6c8"/><stop offset=".5" stop-color="#928d7e"/><stop offset="1" stop-color="#413f38"/></radialGradient>
  <radialGradient id="hv-specC" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffffff" stop-opacity=".95"/><stop offset=".55" stop-color="#ffffff" stop-opacity=".4"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
  <radialGradient id="hv-frostC" cx=".42" cy=".3" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".5"/><stop offset=".4" stop-color="#e8fff0" stop-opacity=".22"/><stop offset="1" stop-color="#e8fff0" stop-opacity="0"/></radialGradient>
  <radialGradient id="hv-dewC" cx=".4" cy=".34" r=".7"><stop offset="0" stop-color="#ffffff" stop-opacity=".9"/><stop offset=".5" stop-color="#eafff6" stop-opacity=".45"/><stop offset="1" stop-color="#eafff6" stop-opacity="0"/></radialGradient>
  <!-- terracotta pot -->
  <radialGradient id="hv-potG" cx=".5" cy=".2" r="1"><stop offset="0" stop-color="#d9742f"/><stop offset=".6" stop-color="#b85522"/><stop offset="1" stop-color="#7e3413"/></radialGradient>
  <radialGradient id="hv-potD" cx=".5" cy=".2" r="1"><stop offset="0" stop-color="#9a7860"/><stop offset=".6" stop-color="#6f5848"/><stop offset="1" stop-color="#473730"/></radialGradient>
</defs>`;
}

/* ── A small drifting "pot leaf" (for the background/foreground leaf scatter and
 *    the ambient leaf cloud). Lifted verbatim from the prototype's richLeaf. ── */
function leaflet(L, Wd, t = 5) {
  const p = [];
  for (let i = 0; i <= t; i++) {
    const u = i / t, y = -L * u, e = Math.sin(Math.PI * Math.pow(u, 0.8));
    p.push([Wd * e, y]);
    if (i < t) { const u2 = (i + 0.5) / t, y2 = -L * u2, e2 = Math.sin(Math.PI * Math.pow(u2, 0.8)); p.push([Wd * e2 * 0.52, y2]); }
  }
  const l = p.slice(0, -1).reverse().map(([x, y]) => [-x, y]);
  return 'M ' + [...p, ...l].map((q) => `${q[0].toFixed(1)} ${q[1].toFixed(1)}`).join(' L ') + ' Z';
}
function richLeaf(scale, gid, frost) {
  const cfg = [[-82, 34, 8], [-55, 50, 11], [-28, 62, 13], [0, 72, 14], [28, 62, 13], [55, 50, 11], [82, 34, 8]];
  let s = '<g>';
  for (const [a, L, Wd] of cfg) {
    s += `<g transform="rotate(${a})"><path d="${leaflet(L * scale, Wd * scale)}" fill="url(#${gid})" stroke="#13420f" stroke-width="1"/><line x1="0" y1="0" x2="0" y2="${(-L * scale * 0.86).toFixed(1)}" stroke="#a9e89a" stroke-width="1" opacity=".5"/></g>`;
  }
  if (frost) for (let k = 0; k < 6; k++) { const a = rng(k + 1) * 6.28, r = rng(k + 4) * 20 * scale; s += `<circle cx="${(Math.cos(a) * r).toFixed(1)}" cy="${(-10 * scale + Math.sin(a) * r).toFixed(1)}" r="${(0.7 + rng(k) * 0.7).toFixed(1)}" fill="#eafff0" opacity=".85"/>`; }
  return s + '</g>';
}

/* ── FAN-LEAF GENERATOR — one cannabis leaflet: a long lance with fine
 *    forward-raking serrations, widest ~32% up, tapering to a sharp tip. Grows
 *    straight UP from (0,0). Lifted verbatim from the prototype. ── */
function fanLeaflet(L, Wd, teeth) {
  const prof = (u) => {
    if (u < 0.08) return Wd * (u / 0.08) * 0.50;
    const t = (u - 0.08) / 0.92;
    return Wd * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.85);
  };
  const pts = [];
  for (let i = 0; i <= teeth; i++) {
    const u = i / teeth, y = -L * u, w = prof(u);
    pts.push([w, y]);
    if (i < teeth) {
      const um = (i + 0.40) / teeth, ym = -L * um, wm = prof(um);
      const cut = (um > 0.86) ? 0.10 : (0.18 + 0.12 * um);
      pts.push([wm * (1 - cut), ym]);
    }
  }
  let d = `M 0 0 L ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
  for (let i = pts.length - 1; i >= 0; i--) d += ` L ${(-pts[i][0]).toFixed(1)} ${pts[i][1].toFixed(1)}`;
  return d + ' Z';
}
/* A full 7-point fan leaf grown from the origin, pointing up. Verbatim. */
function fanLeaf(R, grad, vein, frost) {
  const blades = [
    [-78, 0.52, 0.150, 9],
    [-50, 0.76, 0.176, 12],
    [-24, 0.94, 0.190, 14],
    [0, 1.05, 0.180, 15],
    [24, 0.94, 0.190, 14],
    [50, 0.76, 0.176, 12],
    [78, 0.52, 0.150, 9],
  ];
  let s = '<g>';
  for (const [a, lf, wf, teeth] of blades) {
    const L = R * lf, Wd = R * wf;
    const path = fanLeaflet(L, Wd, teeth);
    s += `<g transform="rotate(${a})">`;
    s += `<path d="${path}" fill="url(#${grad})" stroke="#0a2e10" stroke-width="1.4" stroke-linejoin="round"/>`;
    s += `<path d="M 0 ${(-L * 0.06).toFixed(1)} L 0 ${(-L * 0.9).toFixed(1)}" stroke="#0d3a16" stroke-width="${(R * 0.016).toFixed(2)}" stroke-linecap="round" opacity=".55"/>`;
    s += `<path d="M 0 ${(-L * 0.06).toFixed(1)} L 0 ${(-L * 0.88).toFixed(1)}" stroke="${vein}" stroke-width="${(R * 0.008).toFixed(2)}" stroke-linecap="round" opacity=".45"/>`;
    for (let v = 1; v <= 3; v++) {
      const vu = 0.22 + v * 0.2, vy = -L * vu, vw = (Wd * Math.pow(Math.sin(Math.PI * Math.pow(vu, 0.62)), 0.85)) * 0.7;
      s += `<path d="M 0 ${vy.toFixed(1)} L ${vw.toFixed(1)} ${(vy - L * 0.1).toFixed(1)}" stroke="#0d3a16" stroke-width="${(R * 0.007).toFixed(2)}" opacity=".4"/>`;
      s += `<path d="M 0 ${vy.toFixed(1)} L ${(-vw).toFixed(1)} ${(vy - L * 0.1).toFixed(1)}" stroke="#0d3a16" stroke-width="${(R * 0.007).toFixed(2)}" opacity=".4"/>`;
    }
    if (frost) for (let k = 0; k < 8; k++) {
      const fu = 0.2 + rng(k + a * 0.1 + 1) * 0.72, fy = -L * fu;
      const fw = (Wd * Math.pow(Math.sin(Math.PI * Math.pow(fu, 0.62)), 0.85)) * (rng(k + 7) - 0.5) * 1.55;
      const big = rng(k + 5) > 0.7;
      s += `<circle cx="${fw.toFixed(1)}" cy="${fy.toFixed(1)}" r="${((big ? 1.1 : 0.55) + rng(k + 3) * 0.5).toFixed(1)}" fill="#eafff0" opacity="${big ? '.95' : '.7'}"/>`;
    }
    s += `</g>`;
  }
  return s + '</g>';
}

/* ── A MINIMAL GLOSSY COLA — a small volumetric teardrop bud with a few organic
 *    glossy lobes, a soft body specular, light frost, and soft curling
 *    brown/red/purple/amber pistil hairs. Tucked UNDER the leaf emblem. Lifted
 *    verbatim from the prototype (gradient ids prefixed hv-). ── */
function miniCola(bx, by, br, dep, spot, seed) {
  let s = '';
  const body = dep ? 'hv-bodyD' : (spot ? 'hv-bodyP' : 'hv-bodyG');
  const lobe = dep ? 'hv-lobeD' : (spot ? 'hv-lobeP' : 'hv-lobeG');
  const top = by - br * 1.9, bot = by + br * 0.42, hm = br * 0.72;
  const body_d = `M ${bx} ${top.toFixed(1)}`
    + ` C ${(bx + hm * 0.5).toFixed(1)} ${(top + br * 0.34).toFixed(1)} ${(bx + hm * 0.92).toFixed(1)} ${(by - br * 0.66).toFixed(1)} ${(bx + hm).toFixed(1)} ${(by - br * 0.14).toFixed(1)}`
    + ` C ${(bx + hm * 0.96).toFixed(1)} ${(by + br * 0.2).toFixed(1)} ${(bx + hm * 0.42).toFixed(1)} ${bot.toFixed(1)} ${bx} ${(bot + br * 0.04).toFixed(1)}`
    + ` C ${(bx - hm * 0.42).toFixed(1)} ${bot.toFixed(1)} ${(bx - hm * 0.96).toFixed(1)} ${(by + br * 0.2).toFixed(1)} ${(bx - hm).toFixed(1)} ${(by - br * 0.14).toFixed(1)}`
    + ` C ${(bx - hm * 0.92).toFixed(1)} ${(by - br * 0.66).toFixed(1)} ${(bx - hm * 0.5).toFixed(1)} ${(top + br * 0.34).toFixed(1)} ${bx} ${top.toFixed(1)} Z`;
  s += `<g transform="translate(${(br * 0.13).toFixed(1)},${(br * 0.15).toFixed(1)})"><path d="${body_d}" fill="#05140a" opacity="${dep ? '.32' : '.46'}"/></g>`;
  s += `<path d="${body_d}" fill="url(#${body})"/>`;
  const rows = [[0.2, 2, 0.34, 0.32], [-0.06, 3, 0.34, 0.5], [-0.36, 3, 0.31, 0.46], [-0.68, 3, 0.28, 0.38], [-1.0, 2, 0.25, 0.26], [-1.3, 1, 0.22, 0.0]];
  const lobes = [];
  rows.forEach((row, ri) => {
    const [yf, cnt, brf, spr] = row;
    for (let c = 0; c < cnt; c++) {
      const t = cnt === 1 ? 0.5 : c / (cnt - 1);
      const jx = (rng(seed + ri * 7 + c * 3) - 0.5) * 0.2, jy = (rng(seed + ri * 11 + c * 5) - 0.5) * 0.14;
      const sz = 0.74 + rng(seed + ri * 13 + c * 2) * 0.46;
      const lx = bx + ((t - 0.5) * 2 * spr + jx) * br, ly = by + (yf + jy) * br, lr = brf * br * sz, depth = rng(seed + ri * 17 + c * 4);
      lobes.push([lx, ly, lr, depth]);
    }
  });
  lobes.forEach(([lx, ly, lr, depth], k) => {
    const eggH = lr * 1.4, tilt = (rng(seed + k) - 0.5) * lr * 0.4;
    const egg = `M ${(lx + tilt).toFixed(1)} ${(ly - eggH).toFixed(1)}`
      + ` C ${(lx + lr * 1.02).toFixed(1)} ${(ly - eggH * 0.5).toFixed(1)} ${(lx + lr).toFixed(1)} ${(ly + lr * 0.55).toFixed(1)} ${lx} ${(ly + lr * 0.92).toFixed(1)}`
      + ` C ${(lx - lr).toFixed(1)} ${(ly + lr * 0.55).toFixed(1)} ${(lx - lr * 1.02).toFixed(1)} ${(ly - eggH * 0.5).toFixed(1)} ${(lx + tilt).toFixed(1)} ${(ly - eggH).toFixed(1)} Z`;
    s += `<path d="${egg}" fill="url(#${lobe})" stroke="#103a16" stroke-width=".6" stroke-opacity=".6"/>`;
    if (depth < 0.32) s += `<path d="${egg}" fill="#0c2e12" opacity="${(0.16 * (1 - depth / 0.32)).toFixed(2)}"/>`;
    if (!dep && depth > 0.55) s += `<ellipse cx="${(lx - lr * 0.26).toFixed(1)}" cy="${(ly - eggH * 0.42).toFixed(1)}" rx="${(lr * 0.26).toFixed(1)}" ry="${(lr * 0.32).toFixed(1)}" fill="url(#hv-specC)" opacity=".5"/>`;
  });
  s += `<ellipse cx="${(bx - br * 0.28).toFixed(1)}" cy="${(by - br * 0.9).toFixed(1)}" rx="${(br * 0.42).toFixed(1)}" ry="${(br * 0.6).toFixed(1)}" fill="url(#hv-specC)" opacity="${dep ? '.22' : '.62'}"/>`;
  if (!dep) s += `<ellipse cx="${(bx - br * 0.34).toFixed(1)}" cy="${(by - br * 1.0).toFixed(1)}" rx="${(br * 0.1).toFixed(1)}" ry="${(br * 0.14).toFixed(1)}" fill="#ffffff" opacity=".82"/>`;
  if (!dep) s += `<ellipse cx="${bx}" cy="${(by - br * 0.7).toFixed(1)}" rx="${(br * 0.8).toFixed(1)}" ry="${(br * 1.1).toFixed(1)}" fill="url(#hv-frostC)"/>`;
  if (!dep) for (let k = 0; k < 16; k++) {
    const dir = rng(k + seed) < 0.5 ? -1 : 1;
    const px = bx + (rng(k + 3) - 0.5) * br * 0.8;
    const py = by - br * (0.25 + rng(k + 7) * 1.3);
    const len = br * (0.28 + rng(k + 1) * 0.4), curl = 0.5 + rng(k + 2) * 0.6;
    const tx = px + dir * len * curl, ty = py - len * (0.6 + rng(k + 4) * 0.3);
    const col = ['#caa46a', '#c9743a', '#b8472a', '#8a5cc4', '#d4632a', '#e09a4e'][k % 6];
    s += `<path d="M ${px.toFixed(1)} ${py.toFixed(1)} q ${(dir * len * 0.3).toFixed(1)} ${(-len * 0.45).toFixed(1)} ${(tx - px).toFixed(1)} ${(ty - py).toFixed(1)}" stroke="${col}" stroke-width="${(br * 0.05).toFixed(1)}" fill="none" stroke-linecap="round" opacity=".92"/>`;
    if (k % 4 === 0) s += `<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${(br * 0.05).toFixed(1)}" fill="url(#hv-dewC)"/>`;
  }
  const tn = dep ? 10 : 30;
  for (let k = 0; k < tn; k++) {
    const a = rng(k + seed + 1) * 6.283, rr = Math.pow(rng(k + 9), 0.6) * br * 0.8;
    const fx = bx + Math.cos(a) * rr, fy = by - br * 0.5 + Math.sin(a) * rr * 1.25, big = rng(k + 5) > 0.85;
    s += `<circle cx="${fx.toFixed(1)}" cy="${fy.toFixed(1)}" r="${((big ? 1.3 : 0.55) + rng(k) * 0.5).toFixed(1)}" fill="#f4fff8" opacity="${dep ? '.26' : (big ? '.95' : '.58')}"/>`;
  }
  return s;
}

/* ── ONE POTTED PLANT — the leaf-dominant fan-leaf EMBLEM with minimal glossy
 *    COLAS tucked under it, planted in a terracotta POT, with a frosted avatar
 *    medallion in front. This is the STATIC art for one car (the glow filters
 *    target it). Restructured from the prototype's cola(): per-car state flags
 *    replace its fixed role string, the seed is the car index, and the open-slot
 *    branch paints OPEN / sign up! Returns the SVG-string art group contents.
 *
 *    `lead` = the engine (organiser); `now` = current; `spot` = spotlit;
 *    `dep` = departed (booked only). `R` is the plant scale; (x, y) its centre. */
function plantArt(x, y, R, v, i, { lead, now, spot, dep }) {
  const heroG = dep ? 'hv-heroD' : (spot ? 'hv-heroP' : 'hv-heroG');
  const sideG = dep ? 'hv-sideD' : (spot ? 'hv-sideP' : 'hv-sideG');
  const vein = dep ? '#9aa89a' : (spot ? '#e6cffb' : '#cfffb8');
  const seed = i + 1;
  const HR = R * 1.92;            // hero leaf reach
  const cyL = y - R * 0.18;       // emblem leaves grow from just above centre
  const potTop = y + R * 1.18;    // where the pot rim sits
  let s = `<g${dep ? ' opacity=".84"' : ''}>`;

  // ── OPEN slot: a simple frosted ring + OPEN / sign up!, no avatar, no cola.
  if (v.isOpen) {
    s += `<path d="M ${x} ${cyL.toFixed(1)} L ${x} ${(potTop - R * 0.05).toFixed(1)}" stroke="url(#hv-stem)" stroke-width="${(R * 0.12).toFixed(1)}" stroke-linecap="round"/>`;
    s += potSVG(x, R, potTop, seed, false);
    const my = y + R * 0.2, ar = R * 0.6;
    s += `<circle cx="${x}" cy="${my.toFixed(1)}" r="${(ar + 5).toFixed(1)}" fill="#06120a"/>`;
    s += `<circle cx="${x}" cy="${my.toFixed(1)}" r="${(ar + 2.5).toFixed(1)}" fill="none" stroke="#7fe06c" stroke-width="3" stroke-dasharray="9 8"/>`;
    s += `<text x="${x}" y="${(my - R * 0.04).toFixed(1)}" text-anchor="middle" font-weight="900" font-size="${Math.round(ar * 0.62)}" fill="#bfffce" font-family="ui-rounded,system-ui,sans-serif">${esc(L('overlay.open'))}</text>`;
    s += `<text x="${x}" y="${(my + R * 0.3).toFixed(1)}" text-anchor="middle" font-weight="700" font-size="${Math.round(ar * 0.34)}" fill="#9fcf9a" font-family="ui-rounded,system-ui,sans-serif">${esc(L('overlay.signUp'))}</text>`;
    return s + `</g>`;
  }

  // static halo glow behind the whole emblem (radial gradient, NOT a filter)
  if (!dep) {
    const halo = spot ? 'hv-haloP' : 'hv-haloG';
    s += `<ellipse cx="${x}" cy="${(cyL - R * 0.5).toFixed(1)}" rx="${(R * 1.7).toFixed(1)}" ry="${(R * 1.85).toFixed(1)}" fill="url(#${halo})"/>`;
  }

  // ── BACK FAN LEAVES — an upper pair past the hero's shoulders + a low pair.
  const sides = [[-72, 0.56, -0.32, -0.02], [72, 0.56, 0.32, -0.02], [-50, 0.44, -0.34, 0.42], [50, 0.44, 0.34, 0.42]];
  for (const [a, sc, ox, oy] of sides)
    s += `<g transform="translate(${(x + R * ox).toFixed(1)},${(cyL + R * oy).toFixed(1)}) rotate(${a})" opacity="${dep ? '.5' : '.9'}">${fanLeaf(HR * sc, sideG, vein, false)}</g>`;

  // ── soft dark crest shadow behind the hero leaf for depth
  s += `<g transform="translate(${x},${(cyL + 2).toFixed(1)})" opacity=".4">${fanLeaf(HR * 1.015, 'hv-heroD', '#0a2e10', false)}</g>`;

  // ── THE HERO 7-POINT FAN LEAF — the star, dead-centre behind the avatar.
  s += `<g transform="translate(${x},${cyL.toFixed(1)})">${fanLeaf(HR, heroG, vein, !dep)}</g>`;

  // ── THE MINIMAL GLOSSY COLAS — small frosted buds peeking from UNDER the hero
  //    leaf, in the wedges flanking the medallion + one tucked centre-low.
  if (!dep) {
    s += miniCola(x - R * 0.86, cyL - R * 0.22, R * 0.36, dep, spot, seed + 5);
    s += miniCola(x + R * 0.86, cyL - R * 0.22, R * 0.36, dep, spot, seed + 9);
    s += miniCola(x, y + R * 0.04, R * 0.3, dep, spot, seed + 3);
  }

  // little petiole/stem stub anchoring the leaf down toward the pot soil
  s += `<path d="M ${x} ${cyL.toFixed(1)} L ${x} ${(potTop - R * 0.05).toFixed(1)}" stroke="url(#hv-stem)" stroke-width="${(R * 0.12).toFixed(1)}" stroke-linecap="round"/>`;

  // ── TERRACOTTA POT — grounds the composition.
  s += potSVG(x, R, potTop, seed, dep);

  // ── AVATAR MEDALLION (front layer, over the leaf base, above the pot rim).
  const my = y + R * 0.2, ar = R * 0.6;
  const ring = lead ? '#f6cf6e' : spot ? '#c9a8ef' : now ? '#eafff0' : dep ? '#7d8a7a' : '#bfe6a0';
  s += `<circle cx="${x}" cy="${my.toFixed(1)}" r="${(ar + 5).toFixed(1)}" fill="#06120a"/>`;
  s += `<circle cx="${x}" cy="${my.toFixed(1)}" r="${(ar + 2.5).toFixed(1)}" fill="none" stroke="${ring}" stroke-width="${now ? 3 : 2}" opacity="${dep ? '.5' : '1'}"/>`;
  s += `<circle cx="${x}" cy="${my.toFixed(1)}" r="${ar.toFixed(1)}" fill="url(#${now ? 'hv-discN' : 'hv-disc'})"/>`;
  // avatarSVG-style fallback: initials first (over the disc sheen), then the
  // clipped image over them — a 404 on the flaky CDN still shows initials.
  s += `<ellipse cx="${(x - ar * 0.3).toFixed(1)}" cy="${(my - ar * 0.4).toFixed(1)}" rx="${(ar * 0.46).toFixed(1)}" ry="${(ar * 0.28).toFixed(1)}" fill="#eafff0" opacity="${dep ? '.18' : '.42'}"/>`;
  s += `<text x="${x}" y="${(my + ar * 0.36).toFixed(1)}" text-anchor="middle" font-weight="900" font-size="${Math.round(ar * 0.95)}" fill="${dep ? '#cdd8cb' : '#ffffff'}" font-family="ui-rounded,system-ui,sans-serif" letter-spacing="-0.5" paint-order="stroke" stroke="#06160c" stroke-width="${(ar * 0.06).toFixed(1)}">${esc(initials(v.name))}</text>`;
  if (v.image) {
    s += `<clipPath id="hv-av-${i}"><circle cx="${x}" cy="${my.toFixed(1)}" r="${ar.toFixed(1)}"/></clipPath>`;
    s += `<image href="${esc(v.image)}" x="${(x - ar).toFixed(1)}" y="${(my - ar).toFixed(1)}" width="${(ar * 2).toFixed(1)}" height="${(ar * 2).toFixed(1)}" clip-path="url(#hv-av-${i})" preserveAspectRatio="xMidYMid slice"/>`;
  }
  // tiny frost crystals dusting the medallion rim (ties it to the leaf)
  if (!dep) for (let k = 0; k < 9; k++) {
    const aa = rng(k + seed + 2) * 6.283, rr = (ar + 2.5);
    s += `<circle cx="${(x + Math.cos(aa) * rr).toFixed(1)}" cy="${(my + Math.sin(aa) * rr).toFixed(1)}" r="${(0.7 + rng(k) * 0.8).toFixed(1)}" fill="#f2fff6" opacity=".9"/>`;
  }

  return s + `</g>`;
}

/* The terracotta pot — lifted verbatim from the prototype (pot ids prefixed hv-). */
function potSVG(x, R, potTop, seed, dep) {
  const potW = R * 0.82, potH = R * 1.12, rimH = R * 0.2, rimOver = R * 0.16, botHalf = R * 0.6;
  const topY = potTop, botY = potTop + potH, rimY = potTop - rimH, rimHalf = potW + rimOver, pg = dep ? 'hv-potD' : 'hv-potG';
  let s = '';
  s += `<ellipse cx="${x}" cy="${(botY + R * 0.02).toFixed(1)}" rx="${(botHalf * 1.3).toFixed(1)}" ry="${(R * 0.1).toFixed(1)}" fill="#000" opacity=".34"/>`;
  s += `<path d="M ${(x - potW).toFixed(1)} ${topY.toFixed(1)} L ${(x + potW).toFixed(1)} ${topY.toFixed(1)} L ${(x + botHalf).toFixed(1)} ${(botY - R * 0.07).toFixed(1)} Q ${(x + botHalf).toFixed(1)} ${botY.toFixed(1)} ${(x + botHalf - R * 0.09).toFixed(1)} ${botY.toFixed(1)} L ${(x - botHalf + R * 0.09).toFixed(1)} ${botY.toFixed(1)} Q ${(x - botHalf).toFixed(1)} ${botY.toFixed(1)} ${(x - botHalf).toFixed(1)} ${(botY - R * 0.07).toFixed(1)} Z" fill="url(#${pg})" stroke="#5e260f" stroke-width="1.3"/>`;
  s += `<path d="M ${(x - potW * 0.6).toFixed(1)} ${(topY + R * 0.05).toFixed(1)} L ${(x - botHalf * 0.55).toFixed(1)} ${(botY - R * 0.06).toFixed(1)} L ${(x - botHalf * 0.55 + R * 0.13).toFixed(1)} ${(botY - R * 0.06).toFixed(1)} L ${(x - potW * 0.6 + R * 0.15).toFixed(1)} ${(topY + R * 0.05).toFixed(1)} Z" fill="#fff" opacity=".09"/>`;
  s += `<path d="M ${(x + potW).toFixed(1)} ${topY.toFixed(1)} L ${(x + botHalf).toFixed(1)} ${(botY - R * 0.07).toFixed(1)} L ${(x + botHalf - R * 0.16).toFixed(1)} ${(botY - R * 0.07).toFixed(1)} L ${(x + potW - R * 0.18).toFixed(1)} ${topY.toFixed(1)} Z" fill="#3a1607" opacity=".28"/>`;
  s += `<ellipse cx="${x}" cy="${topY.toFixed(1)}" rx="${(potW - R * 0.03).toFixed(1)}" ry="${(R * 0.12).toFixed(1)}" fill="#2a1a0e"/>`;
  if (!dep) for (let k = 0; k < 5; k++) { const sxx = x + (rng(k + seed + 4) - 0.5) * potW * 1.6; s += `<circle cx="${sxx.toFixed(1)}" cy="${(topY + (rng(k + 2) - 0.5) * R * 0.1).toFixed(1)}" r="${(0.8 + rng(k) * 0.7).toFixed(1)}" fill="#3c2816"/>`; }
  s += `<path d="M ${(x - rimHalf).toFixed(1)} ${rimY.toFixed(1)} L ${(x + rimHalf).toFixed(1)} ${rimY.toFixed(1)} L ${(x + rimHalf - R * 0.05).toFixed(1)} ${topY.toFixed(1)} L ${(x - rimHalf + R * 0.05).toFixed(1)} ${topY.toFixed(1)} Z" fill="url(#${pg})" stroke="#5e260f" stroke-width="1.3"/>`;
  s += `<ellipse cx="${x}" cy="${rimY.toFixed(1)}" rx="${rimHalf.toFixed(1)}" ry="${(R * 0.1).toFixed(1)}" fill="url(#${pg})" stroke="#5e260f" stroke-width="1.2"/>`;
  s += `<ellipse cx="${x}" cy="${rimY.toFixed(1)}" rx="${(rimHalf - R * 0.06).toFixed(1)}" ry="${(R * 0.07).toFixed(1)}" fill="#241509"/>`;
  s += `<path d="M ${(x - rimHalf + R * 0.08).toFixed(1)} ${(rimY - R * 0.03).toFixed(1)} Q ${x} ${(rimY - R * 0.13).toFixed(1)} ${(x + rimHalf - R * 0.08).toFixed(1)} ${(rimY - R * 0.03).toFixed(1)}" fill="none" stroke="#f0b878" stroke-width="2" opacity=".55"/>`;
  return s;
}

/* The ambient FRONT layer above/around one plant — kept OUT of the filtered
 * .hv-art group so the lit-plant glow bitmap caches across frames. Three families,
 * ALL bounded per car for perf (≈12 animating nodes/car, the prototype's own
 * per-unit density) and ALL compositor-only (drift/sway/opacity, no SVG filter):
 *   • drifting pot-leaves (the leaf-forward hero motion),
 *   • a small soil leaf-bed rooted at the ground line (swaying), and
 *   • a few rising frost spores. */
function leafCloud(x, w, i) {
  let s = '';
  // ── drifting pot-leaves above the plant — the leaf-FORWARD hero motion. Bumped
  //    toward the prototype's lush density (≈9/car) but still BOUNDED so 20+ cars ×
  //    marquee copies stay sane. A spread of sizes/depths reads richer. ──
  const N = 13;  // more floating leaves (user wanted more); still bounded per car
  for (let k = 0; k < N; k++) {
    const seed = i * 17 + k;
    const lx = x + (0.04 + rng(seed + 1) * 0.92) * w;
    const ly = 12 + rng(seed + 7) * 124;
    const sc = 0.28 + rng(seed + 2) * 0.46;
    const du = 12 + rng(seed) * 12;   // a touch faster = livelier
    const pur = (i + k) % 4 === 0;
    const drift = ['hv-driftA', 'hv-driftB', 'hv-driftC'][k % 3];
    const op = (0.46 + rng(seed + 4) * 0.28).toFixed(2); // depth via opacity, not blur
    s += `<g transform="translate(${lx.toFixed(0)},${ly.toFixed(0)})" opacity="${op}"><g class="hv-leaf" style="animation-name:${drift};animation-duration:${du.toFixed(0)}s;animation-delay:-${(k * 1.6).toFixed(1)}s">${richLeaf(sc, pur ? 'hv-leafP' : 'hv-leafG', sc > 0.52)}</g></g>`;
  }
  // ── soil leaf-bed: a few small leaflets rooted at the ground line, swaying
  //    about their base (frames the pots like the prototype's leaf bed) ──
  //    Varied COUNT (5-7/car), scattered positions, strong SIZE variation, a per-leaflet
  //    LEAN, and mixed green/purple — so the bed reads organic, not as uniform groups of 3.
  const B = 5 + Math.round(rng(i * 23 + 50) * 2);  // 5-7 per car, varies per car
  for (let k = 0; k < B; k++) {
    const seed = i * 23 + k + 100;
    const bx = x + (0.08 + rng(seed) * 0.84) * w;            // scattered, not even thirds
    const by = baseY + 30 - rng(seed + 3) * 12;
    const sc = 0.3 + rng(seed + 9) * 0.6;                    // 0.3-0.9 — strong size variation
    const rot = ((rng(seed + 4) - 0.5) * 60).toFixed(0);     // ±30° lean, so they're not all upright
    const pur = (i * 3 + k) % 4 === 0;                       // mix purple in
    const op = (0.78 + rng(seed + 6) * 0.22).toFixed(2);
    const per = (4.5 + rng(seed + 1) * 4).toFixed(1);
    s += `<g transform="translate(${bx.toFixed(0)},${by.toFixed(0)}) rotate(${rot})" opacity="${op}"><g class="hv-bedleaf" style="--bp:${per}s;animation-delay:-${(k * 0.37).toFixed(1)}s">${richLeaf(sc, pur ? 'hv-leafP' : 'hv-leafG', false)}</g></g>`;
  }
  // ── a few rising frost spores (gradient dots, no bloom) ──
  const SP = 3;  // capped per car
  for (let k = 0; k < SP; k++) {
    const seed = i * 31 + k + 200;
    const sx = x + (0.2 + rng(seed + 1) * 0.6) * w;
    const du = (5 + rng(seed) * 5).toFixed(1);
    s += `<circle class="hv-spore" cx="${sx.toFixed(0)}" cy="${(baseY - 6).toFixed(0)}" r="${(1.3 + rng(seed + 5) * 1.3).toFixed(1)}" fill="${k % 3 ? '#cdffd0' : '#ffe79a'}" style="animation-duration:${du}s;animation-delay:-${(k * 0.8).toFixed(1)}s"/>`;
  }
  return s;
}

/* The PLAYED stamp — always in the DOM, revealed by .rt-car--departed (CSS).
 * Light ink on a translucent backing so it reads over the leaves; angled low. */
function playedStamp(x, R, y) {
  const sx = x, sy = y + R * 0.9;
  return `<g class="hv-stamp" transform="rotate(-9 ${sx} ${sy.toFixed(1)})"><rect x="${(sx - 46).toFixed(1)}" y="${(sy - 16).toFixed(1)}" width="92" height="30" rx="5" fill="#10160f" opacity=".72" stroke="#cfe6c8" stroke-width="2.5"/><text x="${sx}" y="${(sy + 6).toFixed(1)}" text-anchor="middle" font-weight="900" font-size="15" fill="#cfe6c8" letter-spacing="2" font-family="system-ui">${esc(L('overlay.played'))}</text></g>`;
}

/* Bottom-anchored broadcaster name line (.rt-fit so it never truncates). */
function nameSVG(x, w, v) {
  const nameY = baseY + 108;
  return `<text class="rt-fit" data-maxw="${w - 24}" x="${x}" y="${nameY}" text-anchor="middle" font-weight="900" font-size="17" fill="#eafbe6" font-family="ui-rounded,system-ui,sans-serif">${esc(v.name)}</text>`;
}

/* ── ONE rolling-hill layer — a smooth chain of sinusoidal mounds spanning the
 *    full band width, closed down to the band floor. Deterministic (seeded rng),
 *    so every render and marquee copy draws the identical landscape. Built once
 *    in buildTrack(), never per-car. The path is wider than the viewBox (it runs
 *    -120…1320) so the layer can drift sideways without revealing an edge. ── */
function hillPath(baseY, amp, lumps, seed) {
  const x0 = -120, x1 = 1320, span = x1 - x0;
  const step = span / lumps;
  let d = `M ${x0} 100`;
  d += ` L ${x0} ${(baseY + amp * 0.4).toFixed(1)}`;
  for (let i = 0; i <= lumps; i++) {
    const x = x0 + i * step;
    // each crest height + a little horizontal jitter, both seeded for stability
    const h = baseY - amp * (0.55 + rng(seed + i * 3) * 0.45);
    const cx1 = x - step * (0.5 + (rng(seed + i * 5) - 0.5) * 0.2);
    const cy1 = baseY - amp * (0.1 + rng(seed + i * 7) * 0.2);
    if (i === 0) { d += ` L ${x.toFixed(1)} ${h.toFixed(1)}`; continue; }
    d += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)} ${(x - step * 0.5).toFixed(1)} ${h.toFixed(1)} ${x.toFixed(1)} ${h.toFixed(1)}`;
  }
  d += ` L ${x1} 100 Z`;
  return d;
}

/* 2) buildTrack() — the stationary SCENE BAND: a translucent dark backing (the
 *    live stream shows THROUGH it dimly) under a rolling-hill landscape with a
 *    connected resin ground glow + ambient drifting leaves and rising motes.
 *    ONE element, full canvas width, behind the train, fades under track=periodic.
 *    Everything is sized in fractions of --rt-th; the band's top aligns near the
 *    plant band and its height is ~1.05×--rt-th (a LOWER band — the top of the
 *    frame stays see-through). Filter-free; all motion is compositor-only. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails hv-scene';
  // Lower band: top just above the leaf crowns, height ~1.05×--rt-th so the
  // backing covers the train's vertical extent without ever filling the frame.
  el.style.cssText = `top: calc(var(--rt-th) * 0.30); height: calc(var(--rt-th) * 1.05);`;

  // (a) TRANSLUCENT backing — a theme-tinted vertical gradient at ~0.4 alpha so
  //     bright stream content reads dimly through it. NEVER opaque, NEVER the
  //     whole frame. Two stacked gradients: a soft sky-fade above the hills and a
  //     deeper resin-dark pool below, plus a centred glow that lifts the train.
  const backing = document.createElement('div');
  backing.style.cssText = [
    'position:absolute', 'inset:0',
    'background:' +
      'radial-gradient(120% 90% at 50% 92%, rgba(31,110,42,.34) 0%, rgba(13,62,22,.10) 60%, rgba(13,62,22,0) 100%),' +
      'linear-gradient(180deg, rgba(8,22,12,0) 0%, rgba(12,40,20,.30) 34%, rgba(13,62,22,.46) 70%, rgba(7,28,14,.5) 100%)',
  ].join(';');
  el.appendChild(backing);

  // (b) the rolling-hill landscape painted OVER the backing — three depth layers
  //     of dark-green mounds, a connected resin ground glow, ambient drifting
  //     pot-leaves and a few rising motes. preserveAspectRatio="none" lets the
  //     band stretch to any canvas width; smooth mounds tolerate the stretch.
  const VB = 100; // scene viewBox height
  // Crest baselines (lower number = higher on the band). The train ground line
  // sits near band-y 43, so the hills roll UP from there into the plant band:
  // far hills crest high & pale, the near ridge banks low & dark under the pots.
  const farY = 40, midY = 54, nearY = 70;

  // far range (palest, smallest amplitude) → near range (darkest, tallest)
  const hills =
    `<path class="hv-hill" style="--hd:hv-hillC;--ht:34s" d="${hillPath(farY, 26, 5, 11)}" fill="url(#hv-hillFar)" opacity=".68"/>` +
    `<path class="hv-hill" style="--hd:hv-hillA;--ht:28s" d="${hillPath(midY, 32, 6, 23)}" fill="url(#hv-hillMid)" opacity=".88"/>` +
    `<path class="hv-hill" style="--hd:hv-hillB;--ht:22s" d="${hillPath(nearY, 38, 7, 37)}" fill="url(#hv-hillNear)"/>`;

  // a connected resin ground glow hugging the near ridge (static radial, pulsing
  // opacity only — no filter)
  const groundGlow = `<rect class="hv-groundglow" x="-60" y="${(nearY - 6).toFixed(0)}" width="1320" height="${(VB - nearY + 12).toFixed(0)}" fill="url(#hv-resinGlow)"/>`;

  // ambient drifting pot-leaves scattered across the far/mid band (bounded count;
  // these belong to the scene, separate from the per-car leaf clouds). Seeded.
  let sceneLeaves = '';
  const NL = 9;
  for (let k = 0; k < NL; k++) {
    const lx = 60 + rng(k * 7 + 1) * 1080;
    const ly = 14 + rng(k * 7 + 3) * 44;
    const sc = 1.4 + rng(k * 7 + 5) * 1.6;          // scaled up: scene units are big
    const drift = ['hv-driftA', 'hv-driftB', 'hv-driftC'][k % 3];
    const du = (40 + rng(k * 7 + 2) * 26).toFixed(0);
    const pur = k % 4 === 0;
    sceneLeaves += `<g transform="translate(${lx.toFixed(0)},${ly.toFixed(0)}) scale(${(sc * 0.12).toFixed(3)})" opacity=".5"><g class="hv-scene-leaf" style="--sd:${drift};--st:${du}s;animation-delay:-${(k * 3.1).toFixed(1)}s">${richLeaf(1, pur ? 'hv-leafP' : 'hv-leafG', false)}</g></g>`;
  }

  // a few rising motes off the ground glow (gradient dots; opacity+transform only)
  let motes = '';
  const NM = 7;
  for (let k = 0; k < NM; k++) {
    const mx = 80 + rng(k * 11 + 1) * 1040;
    const r = (0.5 + rng(k * 11 + 4) * 0.7).toFixed(2);
    const du = (6 + rng(k * 11 + 2) * 6).toFixed(1);
    motes += `<circle class="hv-mote" cx="${mx.toFixed(0)}" cy="${(nearY + 4).toFixed(0)}" r="${r}" fill="${k % 3 ? '#cdffd0' : '#ffe79a'}" style="animation-duration:${du}s;animation-delay:-${(k * 0.9).toFixed(1)}s"/>`;
  }

  const sceneDefs =
    `<defs>` +
    `<linearGradient id="hv-hillFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f5a28"/><stop offset="1" stop-color="#123e1b"/></linearGradient>` +
    `<linearGradient id="hv-hillMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a5022"/><stop offset="1" stop-color="#0c3214"/></linearGradient>` +
    `<linearGradient id="hv-hillNear" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15461d"/><stop offset="1" stop-color="#07270f"/></linearGradient>` +
    `<radialGradient id="hv-resinGlow" cx=".5" cy=".1" r=".9"><stop offset="0" stop-color="#7fff9f" stop-opacity=".42"/><stop offset=".4" stop-color="#3f9a3a" stop-opacity=".2"/><stop offset="1" stop-color="#0d3e16" stop-opacity="0"/></radialGradient>` +
    `</defs>`;

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="hv-scene-svg rt-theme-highvibes" viewBox="0 0 1200 ${VB}" preserveAspectRatio="none" aria-hidden="true">${sceneDefs}${hills}${groundGlow}${sceneLeaves}${motes}</svg>`;
  el.appendChild(holder.firstElementChild);
  return el;
}

/* 3) build(train, opts) — build the Train art ONCE and return a handle. */
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
    const cx = xs[i] + w / 2;
    // The loco is the organiser — no Slot, so it dims only post-event (isDimmed),
    // never a per-slot isDeparted. Coaches use isDeparted.
    const departed = isEngine ? v.isDimmed : Boolean(v.isDeparted);
    const lead = isEngine;
    const now = !isEngine && Boolean(v.isCurrent);
    const spot = !isEngine && Boolean(v.isSpotlit);
    const R = isEngine ? 42 : now ? 40 : 36;
    const flags = { lead, now, spot, dep: departed };

    // static green NOW glow behind the current plant (radial gradient, not a filter)
    const nowGlow = now ? `<ellipse cx="${cx}" cy="${cy}" rx="120" ry="104" fill="url(#hv-nowglow)"/>` : '';

    const art = plantArt(cx, cy, R, v, i, flags);
    const stamp = v.isOpen ? '' : playedStamp(cx, R, cy);
    const name = nameSVG(cx, w, v);

    const state = (now ? ' rt-car--current' : '') + (spot ? ' rt-car--spotlit' : '') + (departed ? ' rt-car--departed' : '');
    const slot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
    // The Now Marker is always in the DOM; base CSS reveals it on .rt-car--current.
    // Omit it for the engine (no per-slot state) and for open slots.
    const pointer = (isEngine || v.isOpen) ? '' : `<g class="rt-pointer rt-now-bob">${nowMarkerSVG(cx, baseY + 64)}</g>`;

    // STATIC art group (glow filters target it) + an animating leaf cloud SIBLING
    // outside it + the NOW marker.
    body += `<g class="rt-car${state}"${slot}>${nowGlow}<g class="hv-art">${art}${stamp}${name}</g><g class="hv-front">${leafCloud(xs[i], w, i)}</g>${pointer}</g>`;
  });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-highvibes" viewBox="0 0 ${totalW} ${VIEW_H}" role="img" style="--rt-ride:1.2">${defs()}${body}</svg>`;
  const svg = holder.firstElementChild;

  // Keep references so a time tick re-styles in place (never a rebuild).
  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((g) => {
    if (g.dataset.engine) { engineRef = g; return; }
    carRefs.set(Number(g.dataset.slot), g);
  });

  return {
    node: svg,
    /* update(nextTrain) — re-style state IN PLACE on the renderer's tick: toggle
     *  the shared classes (no time text painted on the plants). Never rebuild. */
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        const g = carRefs.get(car.slotOrder);
        if (!g) continue;
        g.classList.toggle('rt-car--current', car.isCurrent);
        g.classList.toggle('rt-car--departed', car.isDeparted);
        g.classList.toggle('rt-car--spotlit', car.isSpotlit);
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
      }
    },
    /* afterAttach() — fit the names (no truncation) + start the per-Car undulation. */
    afterAttach() {
      fitAll(svg);
      undulate(svg);
    },
  };
}

/* The Now Marker — a labelled green tab + downward arrow (the prototype's LIVE-NOW
 * cue, recast as the contract's pointer; base CSS reveals it on .rt-car--current). */
function nowMarkerSVG(cx, y) {
  return `<rect x="${cx - 30}" y="${y - 20}" width="60" height="22" rx="6" fill="#5fc54f"/>` +
    `<text x="${cx}" y="${y - 4}" text-anchor="middle" font-weight="900" font-size="12" fill="#0c2410" font-family="system-ui">${esc(L('overlay.now'))}</text>` +
    `<path d="M ${cx - 7} ${y + 1} L ${cx + 7} ${y + 1} L ${cx} ${y + 12} Z" fill="#5fc54f"/>`;
}

// 4) The default export IS the Theme: register it in src/train-renderer.js.
export default { key: 'highvibes', ensureStyles, build, buildTrack };
