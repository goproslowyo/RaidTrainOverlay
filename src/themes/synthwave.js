/**
 * synthwave2 — synthwave, redesigned as an outrun convoy. The Cars ARE the
 * scene now: low retro wedge sports cars (glass canopy, pop-up headlights,
 * chrome trim, turbine rims, magenta underglow) driving the original outrun
 * grid. Palette and glow language carried over from the shipped theme
 * (sunset-gradient bodies, cyan rings, amber lead car). SVG medium.
 */
import { esc, pointerSVG, avatarSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';
import { injectStyle } from './shared-html.js';

let L = themeT();

const LEAD_W = 232;
const CAR_W = 212;
const GAP = 26;
const railY = 170;               // wheel centreline
const VIEW_TOP = -32;
const VIEW_BOTTOM = 196;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const PINK = '#ff4fd8';
const CYAN = '#6ff7ff';
const AMBER = '#ffb24f';
const GLASS = '#140f2e';
const COL = { now: '#ffe75c', spot: '#6ff7ff', open: '#37e0a0' };
const STYLE_ID = 'rt-theme-synthwave2-style';
const mid = (x, w) => x + w / 2;

export function ensureStyles(doc) {
  injectStyle(doc, STYLE_ID, `
    .rt-theme-synthwave2 .sw2-art { filter: drop-shadow(0 0 6px #ff2bd655); }
    .rt-theme-synthwave2 .rt-car--departed { opacity: 0.8; }
    .rt-theme-synthwave2 .rt-car--departed .sw2-art { filter: saturate(0.5) drop-shadow(0 0 3px #ff2bd633); }
    .rt-theme-synthwave2 .sw2-stamp { visibility: hidden; }
    .rt-theme-synthwave2 .rt-car--departed .sw2-stamp { visibility: visible; }
    .rt-theme-synthwave2 .rt-car--current .sw2-art { filter: drop-shadow(0 0 6px ${COL.now}) drop-shadow(0 0 16px #ff2bd6aa); }
    .rt-theme-synthwave2 .rt-car--spotlit .sw2-art { filter: drop-shadow(0 0 6px ${CYAN}) drop-shadow(0 0 16px #6ff7ff77); }
    .rt-theme-synthwave2 .rt-car--current.rt-car--spotlit .sw2-art { filter: drop-shadow(0 0 5px ${COL.now}) drop-shadow(0 0 14px ${CYAN}); }
    .rt-theme-synthwave2 .sw2-time { fill: #a9e9f7; }
    .rt-theme-synthwave2 .rt-car--current .sw2-time { fill: #fff6c8; }
    /* headlight beam + underglow breathe on the live car */
    .rt-theme-synthwave2 .sw2-beam { opacity: 0; }
    .rt-theme-synthwave2 .rt-car--current .sw2-beam { opacity: 1; animation: sw2-beam 2.6s ease-in-out infinite; }
    @keyframes sw2-beam { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .rt-theme-synthwave2 .sw2-beam { animation: none; } }

    /* Track: the shipped theme's outrun grid, verbatim geometry. */
    .rt-rails-synthwave2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.46); }
    .rt-rails-synthwave2::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: calc(var(--rt-th) * 0.022);
      background: linear-gradient(90deg, #ff2bd6, #9b5cff, #00e5ff); background-size: 200% 100%;
      box-shadow: 0 0 calc(var(--rt-th) * 0.05) #ff2bd6cc, 0 0 calc(var(--rt-th) * 0.09) #00e5ff66;
      animation: sw2-neon-flow 3s linear infinite;
    }
    .sw2-grid { position: absolute; top: calc(var(--rt-th) * 0.022); left: 0; width: 100%; height: calc(var(--rt-th) * 0.42); opacity: 0.8; transform: perspective(calc(var(--rt-th) * 0.22)) rotateX(46deg); transform-origin: top; }
    .sw2-grid svg { width: 100%; height: 100%; display: block; }
    @keyframes sw2-neon-flow { to { background-position: 200% 0; } }
    /* wheels actually turn */
    .rt-theme-synthwave2 .sw2-wspin { transform-box: fill-box; transform-origin: center; animation: sw2-wspin 0.9s linear infinite; }
    @keyframes sw2-wspin { to { transform: rotate(-360deg); } }
    /* horizon scenery: striped retro sun (centre) + mountain ridges + palms */
    .sw2-horizon { position: absolute; left: 0; right: 0; bottom: 100%; height: calc(var(--rt-th) * 0.56); pointer-events: none; }
    .sw2-sun { position: absolute; left: 50%; bottom: calc(var(--rt-th) * -0.01); transform: translateX(-50%); height: 100%; filter: drop-shadow(0 0 calc(var(--rt-th) * 0.06) #ff2bd688); }
    .sw2-mtns { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--rt-th) * 0.2); background-repeat: repeat-x; background-position: bottom left; background-size: calc(var(--rt-th) * 3.4) 100%; opacity: .95; }
    .sw2-palms { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--rt-th) * 0.3); pointer-events: none; opacity: .9;
      background-repeat: repeat-x; background-position: bottom left; background-size: calc(var(--rt-th) * 2.6) 100%; }
    @media (prefers-reduced-motion: reduce) { .rt-rails-synthwave2::before, .rt-theme-synthwave2 .sw2-wspin { animation: none; } }
  `);
}

function gridFloorSVG(color) {
  const w = 1600, h = 58, vanish = w / 2;
  let p = '';
  for (let i = -16; i <= 16; i++) p += `<line x1="${vanish + i * 8}" y1="0" x2="${vanish + i * 50}" y2="${h}" stroke="${color}" stroke-width="1"/>`;
  for (let r = 1; r <= 6; r++) {
    const gy = h - (h * (7 - r)) / 7;
    p += `<line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="${color}" stroke-width="1"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="filter: drop-shadow(0 0 3px ${color})">${p}</svg>`;
}

export function buildTrack({ doc }) {
  const el = doc.createElement('div');
  el.className = 'rt-rails rt-rails-synthwave2';
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.885)');
  const palm = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 100"><g fill="#1b0f38" stroke="#ff5ad6" stroke-width="1.6"><path d="M60 100 C57 74 55 52 61 34 L67 34 C63 56 64 76 68 100 Z"/><path d="M64 36 C48 28 34 28 22 36 C36 22 54 22 64 30 C74 20 92 20 106 32 C92 26 76 28 64 36 Z"/><path d="M64 34 C56 20 44 14 30 14 C46 6 62 14 66 26 C72 12 88 6 102 12 C88 14 74 22 64 34 Z"/></g><g fill="#1b0f38" stroke="#ff5ad6" stroke-width="1.4" transform="translate(150 22) scale(0.72)"><path d="M60 108 C57 78 55 52 61 34 L67 34 C63 56 64 80 68 108 Z"/><path d="M64 36 C48 28 34 28 22 36 C36 22 54 22 64 30 C74 20 92 20 106 32 C92 26 76 28 64 36 Z"/><path d="M64 34 C56 20 44 14 30 14 C46 6 62 14 66 26 C72 12 88 6 102 12 C88 14 74 22 64 34 Z"/></g></svg>`);
  const mtns = encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 100" preserveAspectRatio="none"><path d="M0 100 L60 34 L110 78 L170 22 L235 84 L300 40 L360 92 L430 18 L500 74 L560 44 L620 88 L680 52 L680 100 Z" fill="#160b30" stroke="#ff5ad6" stroke-width="2" stroke-opacity=".7"/></svg>`);
  const sun = `<svg class="sw2-sun" viewBox="0 0 220 120" preserveAspectRatio="xMidYMax meet">` +
    `<defs><linearGradient id="sw2-sung" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe75c"/><stop offset="0.45" stop-color="#ff7ad6"/><stop offset="1" stop-color="#ff2bd6"/></linearGradient>` +
    `<mask id="sw2-sunm"><rect x="0" y="0" width="220" height="120" fill="#fff"/>` +
    `<rect x="0" y="58" width="220" height="3" fill="#000"/><rect x="0" y="68" width="220" height="4" fill="#000"/><rect x="0" y="79" width="220" height="5" fill="#000"/><rect x="0" y="91" width="220" height="6" fill="#000"/><rect x="0" y="104" width="220" height="7" fill="#000"/></mask></defs>` +
    `<circle cx="110" cy="118" r="102" fill="url(#sw2-sung)" mask="url(#sw2-sunm)"/></svg>`;
  el.innerHTML = `<div class="sw2-horizon">${sun}<div class="sw2-mtns" style="background-image:url('data:image/svg+xml,${mtns}')"></div><div class="sw2-palms" style="background-image:url('data:image/svg+xml,${palm}')"></div></div>` +
    `<div class="sw2-grid" style="opacity:.35">${gridFloorSVG('#00e5ff')}</div><div class="sw2-grid">${gridFloorSVG('#ff5ad6')}</div>`;
  return el;
}

/** Turbine rim: dark tyre, chrome dish, five spokes, neon ring — spinning. */
function rim(cx) {
  const r = 17;
  let spokes = '';
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    spokes += `<line x1="${cx}" y1="${railY}" x2="${(cx + Math.cos(a) * (r - 7)).toFixed(1)}" y2="${(railY + Math.sin(a) * (r - 7)).toFixed(1)}" stroke="#0a0618" stroke-width="3"/>`;
  }
  return `<circle cx="${cx}" cy="${railY}" r="${r}" fill="#0a0618"/>` +
    `<circle cx="${cx}" cy="${railY}" r="${r}" fill="none" stroke="${CYAN}" stroke-width="2.25" style="filter:drop-shadow(0 0 3px ${CYAN})"/>` +
    `<g class="sw2-wspin"><circle cx="${cx}" cy="${railY}" r="${r - 6.5}" fill="url(#sw2-chrome)"/>` + spokes +
    `<circle cx="${cx}" cy="${railY}" r="3" fill="#0a0618"/></g>`;
}

/** The wedge body silhouette — low, long, faceted. Rocker drops to railY-6 so
 *  the wheels tuck into masked arch cutouts. */
function bodyPath(x, w) {
  const y = railY - 20;
  const yb = railY - 6;
  return `M ${x + 6} ${yb} L ${x + 2} ${y - 8} Q ${x + 2} ${y - 15} ${x + 12} ${y - 17} L ${x + 88} ${y - 24} L ${x + 112} ${y - 49} Q ${x + 116} ${y - 54} ${x + 125} ${y - 54} L ${x + w - 88} ${y - 54} Q ${x + w - 81} ${y - 54} ${x + w - 76} ${y - 47} L ${x + w - 52} ${y - 29} L ${x + w - 14} ${y - 25} Q ${x + w - 4} ${y - 23} ${x + w - 4} ${y - 15} L ${x + w - 4} ${yb - 7} Q ${x + w - 4} ${yb} ${x + w - 12} ${yb} Z`;
}

function canopyPath(x, w) {
  const y = railY - 20;
  return `M ${x + 114} ${y - 51} Q ${x + 118} ${y - 51} ${x + 125} ${y - 51} L ${x + w - 90} ${y - 51} Q ${x + w - 82} ${y - 51} ${x + w - 77} ${y - 45} L ${x + w - 62} ${y - 31} L ${x + 106} ${y - 31} Z`;
}

function carUnit(x, w, v, i, opts = {}) {
  const { lead = false, caboose = false } = opts;
  const y = railY - 20;
  const yb = railY - 6;
  const stroke = lead ? AMBER : PINK;
  const fwx = x + 46, rwx = x + w - 46;
  let s = '';
  // ground glow / reflection
  s += `<ellipse cx="${mid(x, w)}" cy="${railY + 17}" rx="${w * 0.42}" ry="5" fill="#ff2bd6" opacity=".22" style="filter:blur(4px)"/>`;
  // body with wheel-arch cutouts
  s += `<mask id="sw2-m-${i}"><path d="${bodyPath(x, w)}" fill="#fff"/><circle cx="${fwx}" cy="${railY}" r="22" fill="#000"/><circle cx="${rwx}" cy="${railY}" r="22" fill="#000"/></mask>`;
  s += `<g mask="url(#sw2-m-${i})">`;
  s += `<path d="${bodyPath(x, w)}" fill="url(#sw2-sun)"/>`;
  // facet shading: darker lower body band + hood facet catch-light
  s += `<path d="M ${x + 2} ${y - 10} L ${x + w - 4} ${y - 14} L ${x + w - 4} ${yb} L ${x + 6} ${yb} Z" fill="#241045" opacity=".55"/>`;
  s += `<path d="M ${x + 12} ${y - 17} L ${x + 88} ${y - 24} L ${x + 84} ${y - 18} L ${x + 14} ${y - 12} Z" fill="#fff" opacity=".25"/>`;
  // slatted side intake ahead of the rear arch
  for (let k = 0; k < 4; k++) {
    s += `<path d="M ${x + w - 96 + k * 9} ${y - 28} L ${x + w - 90 + k * 9} ${y - 28} L ${x + w - 94 + k * 9} ${y - 8} L ${x + w - 100 + k * 9} ${y - 8} Z" fill="#1b0c38" opacity=".85"/>`;
  }
  s += `</g>`;
  // neon facet creases (the wireframe look): silhouette + panel lines
  s += `<path d="${bodyPath(x, w)}" fill="none" stroke="${stroke}" stroke-width="2.25"/>`;
  s += `<line x1="${x + 12}" y1="${y - 17}" x2="${x + w - 14}" y2="${y - 25}" stroke="#ff71bd" stroke-width="1.25" opacity=".8"/>`;
  s += `<path d="M ${x + 112} ${y - 49} L ${x + 106} ${y - 10}" stroke="#ff71bd" stroke-width="1" opacity=".55"/>`;
  s += `<path d="M ${x + w - 76} ${y - 47} L ${x + w - 72} ${y - 10}" stroke="#ff71bd" stroke-width="1" opacity=".55"/>`;
  // neon wheel-arch lips
  s += `<path d="M ${fwx - 22} ${yb} A 22 22 0 0 1 ${fwx + 22} ${yb}" fill="none" stroke="#ff71bd" stroke-width="1.5" opacity=".8"/>`;
  s += `<path d="M ${rwx - 22} ${yb} A 22 22 0 0 1 ${rwx + 22} ${yb}" fill="none" stroke="#ff71bd" stroke-width="1.5" opacity=".8"/>`;
  // glass canopy with scanlines
  s += `<path d="${canopyPath(x, w)}" fill="${GLASS}" stroke="${CYAN}" stroke-width="1.5"/>`;
  s += `<line x1="${x + 112}" y1="${y - 44}" x2="${x + w - 68}" y2="${y - 44}" stroke="${CYAN}" stroke-width="1" opacity=".5"/>`;
  s += `<line x1="${x + 109}" y1="${y - 38}" x2="${x + w - 64}" y2="${y - 38}" stroke="${CYAN}" stroke-width="1" opacity=".3"/>`;
  // lit pop-up headlight (the animated beam lives OUTSIDE the filtered art
  // group — an opacity animation under the glow drop-shadow would re-raster
  // the filter every frame)
  s += `<rect x="${x + 16}" y="${y - 24}" width="15" height="6" rx="2" fill="#ffe9a8" style="filter:drop-shadow(0 0 4px #ffe75c)"/>`;
  const beam = `<path class="sw2-beam" d="M ${x + 16} ${y - 21} L ${x - 30} ${y - 31} L ${x - 30} ${y - 9} Z" fill="#ffe75c" opacity=".5" style="filter:blur(2px)"/>`;
  // twin tail-light clusters on the kamm tail (Countach-style)
  s += `<rect x="${x + w - 10}" y="${y - 20}" width="5" height="5.5" rx="1" fill="#ff2b5c" style="filter:drop-shadow(0 0 3px #ff2b5c)"/>`;
  s += `<rect x="${x + w - 10}" y="${y - 12}" width="5" height="5.5" rx="1" fill="#ff2b5c" style="filter:drop-shadow(0 0 3px #ff2b5c)"/>`;
  if (caboose) {
    // streaming light trail off the tail bar
    s += `<rect x="${x + w - 2}" y="${y - 22}" width="30" height="2.5" fill="#ff2b5c" opacity=".8"/>`;
    s += `<rect x="${x + w - 2}" y="${y - 15}" width="20" height="2" fill="#ff2b5c" opacity=".45"/>`;
  }
  if (lead) {
    // proper Countach wing: flat blade on two raked struts over the tail
    s += `<path d="M ${x + w - 54} ${y - 50} L ${x + w - 46} ${y - 29} M ${x + w - 16} ${y - 52} L ${x + w - 10} ${y - 26}" stroke="#2a0a4a" stroke-width="4"/>`;
    s += `<path d="M ${x + w - 66} ${y - 55} L ${x + w + 6} ${y - 58} L ${x + w + 8} ${y - 52} L ${x + w - 64} ${y - 49} Z" fill="#2a0a4a" stroke="${AMBER}" stroke-width="1.75"/>`;
  }
  // driver: cyan avatar ring set on the door, under the canopy line
  const av = { cx: x + 128, cy: y - 16, r: 19 };
  s += `<circle cx="${av.cx}" cy="${av.cy}" r="${av.r + 4}" fill="${GLASS}"/>`;
  s += `<circle cx="${av.cx}" cy="${av.cy}" r="${av.r + 4}" fill="none" stroke="${lead ? '#ffd98a' : CYAN}" stroke-width="2.5" style="filter:drop-shadow(0 0 4px ${lead ? AMBER : CYAN})"/>`;
  s += avatarSVG(`sw2-av-${i}`, av.cx, av.cy, av.r, v.image, v.name, '#241a3d');
  // HUD tag above the roof: name + time
  const cx = mid(x, w);
  s += `<text class="rt-fit sw2-name" data-maxw="${w - 40}" x="${cx}" y="66" text-anchor="middle" font-weight="800" font-style="italic" font-size="17" fill="#fff" style="paint-order:stroke;stroke:#2a0a3add;stroke-width:3px;filter:drop-shadow(0 0 5px #ff2bd6)">${esc(v.name)}</text>`;
  s += `<text class="sw2-time" x="${cx}" y="82" text-anchor="middle" font-size="11" letter-spacing="1" font-family="'DM Mono', monospace">${esc((v.timeLines ?? [''])[0] ?? '')}</text>`;
  // PLAYED stamp across the door
  const sy = y - 30;
  s += `<g class="sw2-stamp" transform="rotate(-9 ${cx} ${sy})"><rect x="${cx - 44}" y="${sy - 13}" width="88" height="26" rx="5" fill="#2a0a2acc" stroke="#ff7ad6" stroke-width="2" style="filter:drop-shadow(0 0 5px #ff2bd699)"/><text x="${cx}" y="${sy + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="#ffe1f5" letter-spacing="2" style="filter:drop-shadow(0 0 3px #ff2bd6)">${esc(L('overlay.played'))}</text></g>`;
  const front = rim(x + 46) + rim(x + w - 46);
  return { body: s, beam, front, nowX: cx, nowY: 40 };
}

function openUnit(x, w, v) {
  const cx = mid(x, w);
  const y = railY - 20;
  let s = `<path d="${bodyPath(x, w)}" fill="#0f2418cc" stroke="${COL.open}" stroke-width="3" stroke-dasharray="10 8"/>`;
  s += `<circle cx="${cx}" cy="${y - 30}" r="18" fill="none" stroke="${COL.open}" stroke-width="2.5"/><text x="${cx}" y="${y - 21}" text-anchor="middle" font-weight="800" font-size="26" fill="#9affd0">+</text>`;
  s += `<text class="rt-fit sw2-name" data-maxw="${w - 60}" x="${cx}" y="66" text-anchor="middle" font-weight="800" font-style="italic" font-size="16" fill="#9affd0" style="filter:drop-shadow(0 0 5px #37e0a0)">${esc(L('overlay.open'))}</text>`;
  const t = v.timeLines?.[0] ? `${esc(L('overlay.signUp'))} · ${esc(v.timeLines[0])}` : esc(L('overlay.signUp'));
  s += `<text class="sw2-time" x="${cx}" y="82" text-anchor="middle" font-size="11" letter-spacing="1" fill="#9affd0" font-family="'DM Mono', monospace">${t}</text>`;
  const front = rim(x + 46) + rim(x + w - 46);
  return { body: s, front, nowX: cx, nowY: 40 };
}

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, state, dataAttr;
  if (unit.type === 'engine') {
    parts = carUnit(x, w, v, i, { lead: true });
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    dataAttr = ' data-engine="1"';
  } else if (v.isOpen) {
    parts = openUnit(x, w, v);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = carUnit(x, w, v, i, { caboose: unit.type === 'caboose' });
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  const pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(parts.nowX, parts.nowY, COL.now, L('overlay.now'))}</g>`;
  return `<g class="rt-car${state}"${dataAttr}><g class="sw2-art">${parts.body}</g>${parts.beam ?? ''}${parts.front}${pointer}</g>`;
}

export function build(train, opts = {}) {
  const { doc } = opts;
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const units = [];
  const hasEngine = vehicles[0]?.kind === 'engine';
  if (hasEngine) units.push({ type: 'engine', v: vehicles[0] });
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) units.push({ type: car.kind === 'open' ? 'open' : car.kind === 'caboose' ? 'caboose' : 'car', v: car });

  const widthFor = (u) => (u.type === 'engine' ? LEAD_W : CAR_W);
  const xs = [];
  let acc = 0;
  for (const u of units) { xs.push(acc); acc += widthFor(u) + GAP; }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => { body += renderUnit(u, xs[i], widthFor(u), i); });

  const holder = doc.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-synthwave2" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:0.6">` +
    `<defs>` +
    `<linearGradient id="sw2-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdb9f2"/><stop offset="0.4" stop-color="#8a5cc8"/><stop offset="0.75" stop-color="#5b2a78"/><stop offset="1" stop-color="#2a1058"/></linearGradient>` +
    `<linearGradient id="sw2-chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8ecf4"/><stop offset="0.5" stop-color="#8a93ad"/><stop offset="0.52" stop-color="#5c6480"/><stop offset="1" stop-color="#e8ecf4"/></linearGradient>` +
    `</defs>${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.sw2-time') }; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.sw2-time') });
  });

  const setTime = (el, lines) => { if (el) el.textContent = (lines ?? [''])[0] ?? ''; };
  return {
    node: svg,
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          ref.group.classList.toggle('rt-car--current', car.isCurrent);
          ref.group.classList.toggle('rt-car--departed', car.isDeparted);
          ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
          if (!car.isOpen) setTime(ref.timeText, car.timeLines ?? [car.relativeTime]);
        }
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        setTime(engineRef.timeText, eng.timeLines ?? [eng.relativeTime ?? '']);
      }
    },
    afterAttach() { fitAll(svg); undulate(svg); },
  };
}

/** Floor = tyre bottom (railY + 17 + stroke). */
export const foot = (railY + 19 - VIEW_TOP) / VIEW_H;

export default { key: 'synthwave', ensureStyles, build, buildTrack, foot };
