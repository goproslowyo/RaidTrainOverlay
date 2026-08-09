/**
 * pixel2 — chunky-cute pixel train, rebuilt from the user's character sheets:
 * thick navy outlines, big pink toy wheels, blue body + pink roof + orange
 * accents, hard single highlights, everything on a strict 4px grid with
 * crispEdges. Names on captions below the track (kept from shipped pixel).
 * Stepped (not eased) bob and smoke. Wheels sit exactly on the rail.
 */
import { esc, avatarSVG, fitAll, toVehicles, themeT } from './shared-svg.js';

let L = themeT();

const ENGINE_W = 156;
const CAR_W = 168;
const GAP = 12;
const railY = 140;                 // wheel contact line
const VIEW_TOP = -24;
const VIEW_BOTTOM = 170;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const NAVY = '#1b2447', BLUE = '#33a9dc', BLUE_HI = '#7fd4f2',
  PINK = '#e0356e', PINK_HI = '#f06a92', ORANGE = '#f7a325', ORANGE_HI = '#ffc55e',
  SKY = '#bfe9fb';
const COL = { now: '#ffd23e', spot: '#22d3ee', open: '#3ddc97' };
const STYLE_ID = 'rt-theme-pixel2-style';
const R = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const mid = (x, w) => x + w / 2;

export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-pixel2 { image-rendering: pixelated; }
    .rt-theme-pixel2 .rt-car--departed { opacity: 0.85; }
    .rt-theme-pixel2 .rt-car--departed .px2-art { filter: saturate(0.35); }
    .rt-theme-pixel2 .px2-stamp { visibility: hidden; }
    .rt-theme-pixel2 .rt-car--departed .px2-stamp { visibility: visible; }
    .rt-theme-pixel2 .rt-car--current .px2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.now}); }
    .rt-theme-pixel2 .rt-car--spotlit .px2-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 8px ${COL.spot}); }
    .rt-theme-pixel2 .rt-car--current.rt-car--spotlit .px2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }
    .rt-theme-pixel2 .px2-time { fill: #cbd5e8; }
    .rt-theme-pixel2 .rt-car--current .px2-time { fill: ${COL.now}; }
    .rt-theme-pixel2 .rt-car--spotlit .px2-time { fill: #a5f3fc; }
    /* stepped bob — pixel sprites don't ease */
    .rt-theme-pixel2 .px2-bob { animation: px2-bob 1.4s steps(2, jump-none) infinite; }
    @keyframes px2-bob { 0% { transform: translateY(0); } 100% { transform: translateY(-4px); } }
    .rt-theme-pixel2 .px2-smoke span, .rt-theme-pixel2 .px2-puff { animation: px2-puff 2s steps(4) infinite; }
    @keyframes px2-puff { 0% { opacity: 0.9; transform: translate(0, 0); } 100% { opacity: 0; transform: translate(12px, -28px); } }
    @media (prefers-reduced-motion: reduce) {
      .rt-theme-pixel2 .px2-bob, .rt-theme-pixel2 .px2-puff { animation: none; }
      .rt-theme-pixel2 .px2-puff { opacity: 0; }
    }
    .rt-rails-pixel2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.075); }
    .rt-rails-pixel2::before, .rt-rails-pixel2::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-pixel2::before { top: 0; height: 34%; background: ${NAVY}; }
    .rt-rails-pixel2::after { top: 34%; bottom: 0;
      background: repeating-linear-gradient(90deg, #8a5a2b 0 calc(var(--rt-th) * 0.045), transparent calc(var(--rt-th) * 0.045) calc(var(--rt-th) * 0.09)); }
  `;
  document.head.appendChild(style);
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-pixel2';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((railY - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  return el;
}

/** Chunky toy wheel built from grid rects: navy tyre, pink disc, navy hub. */
function pxWheel(cx, r) {
  const b = railY;                          // bottom flush with rail
  let s = '';
  s += R(cx - r + 4, b - 2 * r, 2 * r - 8, 2 * r, NAVY);
  s += R(cx - r, b - 2 * r + 4, 2 * r, 2 * r - 8, NAVY);
  s += R(cx - r + 8, b - 2 * r + 4, 2 * r - 16, 2 * r - 8, PINK);
  s += R(cx - r + 4, b - 2 * r + 8, 2 * r - 8, 2 * r - 16, PINK);
  s += R(cx - r + 8, b - 2 * r + 8, 8, 4, PINK_HI);
  s += R(cx - 6, b - r - 6, 12, 12, NAVY);
  return s;
}
/** Navy-outlined box: outline rect + inset fill. */
function box(x, y, w, h, fill) {
  return R(x, y, w, h, NAVY) + R(x + 4, y + 4, w - 8, h - 8, fill);
}
function nowFlag(cx) {
  return `<g class="rt-pointer rt-now-bob">${R(cx - 30, -20, 60, 24, NAVY)}${R(cx - 26, -16, 52, 16, COL.now)}<text x="${cx}" y="-4" text-anchor="middle" font-family="monospace" font-weight="800" font-size="12" fill="${NAVY}" letter-spacing="1">${esc(L('overlay.now'))}</text></g>`;
}
function caption(cx, v, maxw) {
  const t = v.timeLines?.[0] ?? '';
  return `<text class="rt-fit px2-name" data-maxw="${maxw}" x="${cx}" y="155" text-anchor="middle" font-family="monospace" font-weight="800" font-size="13" letter-spacing="2" fill="#fff" stroke="${NAVY}" stroke-width="3" paint-order="stroke">${esc(v.name)}</text>` +
    `<text class="px2-time" x="${cx}" y="167" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" letter-spacing="1">${esc(t)}</text>`;
}

function pxEngine(x, v, i) {
  let s = '';
  // nose (left = direction of travel): pink bumper, orange tank; cab at the rear
  s += box(x + 8, 96, 16, 26, PINK);
  s += box(x + 20, 84, 32, 42, ORANGE) + R(x + 24, 88, 24, 4, ORANGE_HI);
  s += box(x + 44, 92, 64, 34, BLUE) + R(x + 48, 96, 56, 4, BLUE_HI);
  s += box(x + 56, 64, 24, 32, ORANGE) + R(x + 60, 68, 16, 4, ORANGE_HI);
  s += box(x + 48, 52, 36, 16, PINK) + R(x + 52, 56, 28, 4, PINK_HI);
  // cab: pink roof, blue body, driver window facing forward
  s += box(x + 84, 52, 64, 16, PINK) + R(x + 88, 56, 56, 4, PINK_HI);
  s += box(x + 88, 64, 52, 62, BLUE) + R(x + 92, 68, 44, 4, BLUE_HI);
  s += R(x + 96, 76, 36, 36, NAVY) + R(x + 100, 80, 28, 28, SKY);
  s += avatarSVG(`px2-av-${i}`, x + 114, 94, 13, v.image, v.name, NAVY);
  s += caption(x + 78, { name: v.name, timeLines: v.timeLines }, 130);
  // stepped smoke puffs trailing back off the funnel — in the unfiltered front
  // layer, not .px2-art: the puff animates, and a state filter (current/spotlit/
  // departed saturate) over an animating subtree would re-raster every frame
  const front = `<g class="px2-puff">${R(x + 60, 36, 12, 12, '#fff')}${R(x + 70, 28, 8, 8, '#e6eef6')}</g>` +
    pxWheel(x + 36, 14) + pxWheel(x + 78, 14) + pxWheel(x + 118, 14);
  return { body: s, front, nowX: x + 78 };
}

function pxCoach(x, w, v, i, caboose) {
  let s = i > 0 ? R(x - GAP - 2, 112, GAP + 4, 8, NAVY) : '';
  // roof + body
  s += box(x + 4, 64, w - 8, 16, PINK) + R(x + 8, 68, w - 16, 4, PINK_HI);
  s += box(x + 8, 76, w - 16, 50, BLUE) + R(x + 12, 80, w - 24, 4, BLUE_HI);
  // avatar window (framed), passenger windows, orange door
  s += R(x + 16, 84, 40, 36, NAVY) + R(x + 20, 88, 32, 28, SKY);
  s += avatarSVG(`px2-av-${i}`, x + 36, 102, 13, v.image, v.name, NAVY);
  s += R(x + 68, 88, 28, 24, NAVY) + R(x + 72, 92, 20, 16, SKY) + R(x + 72, 92, 8, 4, '#fff');
  s += R(x + 104, 88, 28, 24, NAVY) + R(x + 108, 92, 20, 16, SKY) + R(x + 108, 92, 8, 4, '#fff');
  s += box(x + w - 28, 84, 20, 42, ORANGE);
  if (caboose) s += box(x + w - 44, 52, 24, 16, ORANGE) + R(x + w - 40, 56, 8, 4, ORANGE_HI);
  s += caption(mid(x, w), v, w - 30);
  const sx = mid(x, w);
  s += `<g class="px2-stamp">${R(sx - 38, 90, 76, 22, NAVY)}${R(sx - 34, 94, 68, 14, '#e6eef6')}<text x="${sx}" y="105" text-anchor="middle" font-family="monospace" font-weight="800" font-size="11" letter-spacing="2" fill="${NAVY}">${esc(L('overlay.played'))}</text></g>`;
  const front = pxWheel(x + 40, 14) + pxWheel(x + w - 40, 14);
  return { body: s, front, nowX: mid(x, w) };
}

function pxOpen(x, w, v, i) {
  const cx = mid(x, w);
  let s = i > 0 ? R(x - GAP - 2, 112, GAP + 4, 8, NAVY) : '';
  s += `<rect x="${x + 10}" y="66" width="${w - 20}" height="58" fill="#10251f55" stroke="${COL.open}" stroke-width="4" stroke-dasharray="8 8"/>`;
  s += R(cx - 14, 82, 28, 8, COL.open) + R(cx - 4, 72, 8, 28, COL.open);
  s += `<text class="px2-name" x="${cx}" y="155" text-anchor="middle" font-family="monospace" font-weight="800" font-size="13" letter-spacing="2" fill="#7fe0a8" stroke="${NAVY}" stroke-width="3" paint-order="stroke">${esc(L('overlay.open'))}</text>`;
  const t = v.timeLines?.[0] ? `${L('overlay.signUp')} · ${v.timeLines[0]}` : L('overlay.signUp');
  s += `<text class="px2-time" x="${cx}" y="167" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" letter-spacing="1" fill="#7fe0a8">${esc(t)}</text>`;
  const front = pxWheel(x + 40, 14) + pxWheel(x + w - 40, 14);
  return { body: s, front, nowX: cx };
}

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, state, dataAttr;
  if (unit.type === 'engine') {
    parts = pxEngine(x, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    dataAttr = ' data-engine="1"';
  } else if (v.isOpen) {
    parts = pxOpen(x, w, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = pxCoach(x, w, v, i, unit.type === 'caboose');
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  return `<g class="rt-car${state}"${dataAttr}><g class="px2-bob" style="animation-delay:${((i % 4) * 0.35).toFixed(2)}s"><g class="px2-art">${parts.body}</g><g>${parts.front}</g></g>${nowFlag(parts.nowX)}</g>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const units = [];
  const hasEngine = vehicles[0]?.kind === 'engine';
  if (hasEngine) units.push({ type: 'engine', v: vehicles[0] });
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) units.push({ type: car.kind === 'open' ? 'open' : car.kind === 'caboose' ? 'caboose' : 'car', v: car });
  const widthFor = (u) => (u.type === 'engine' ? ENGINE_W : CAR_W);
  const xs = [];
  let acc = 0;
  for (const u of units) { xs.push(acc); acc += widthFor(u) + GAP; }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => { body += renderUnit(u, xs[i], widthFor(u), i); });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-pixel2" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" shape-rendering="crispEdges" style="--rt-ride:0">${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.px2-time') }; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.px2-time'), isOpen: group.querySelector('.px2-stamp') === null && !group.dataset.engine });
  });

  return {
    node: svg,
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          ref.group.classList.toggle('rt-car--current', car.isCurrent);
          ref.group.classList.toggle('rt-car--departed', car.isDeparted);
          ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
          if (ref.timeText && !car.isOpen) ref.timeText.textContent = (car.timeLines ?? [car.relativeTime])[0] ?? '';
        }
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        if (engineRef.timeText) engineRef.timeText.textContent = (eng.timeLines ?? [eng.relativeTime ?? ''])[0] ?? '';
      }
    },
    afterAttach() { fitAll(svg); },
  };
}

/** Floor = the caption ink (times at y=174 + descenders ≈ VIEW_BOTTOM), NOT the
 *  rail — aligning on railY clipped the name/time captions below the canvas. The
 *  rail stays under the wheels via buildTrack's own --rt-rail-top. */
export const foot = (VIEW_BOTTOM - VIEW_TOP) / VIEW_H;

export default { key: 'pixel', ensureStyles, build, buildTrack, foot };
