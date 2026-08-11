/**
 * paper2 — Origami. Workshop direction per user: each vehicle is a different
 * folded-paper piece — the engine is a paper airplane, coaches cycle through
 * crane / sailboat / pinwheel — in classic origami paper colours with white
 * undersides and hard facet shading (no gradients on folds, just two tones +
 * white). Avatar rides as a round sticker; names on little paper tags below.
 * SVG medium, same contract as the roster themes.
 */
import { esc, avatarSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

let L = themeT();

const ENGINE_W = 190;
const CAR_W = 170;
const GAP = 14;
const railY = 148;               // desk line the pieces rest on
const VIEW_TOP = -26;
const VIEW_BOTTOM = 196;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
// paper colours: [main, shade, deep]
const PAPERS = [
  ['#e2566e', '#c43f57', '#9e2f44'],   // red
  ['#3fa7a0', '#2f8a84', '#1f6a66'],   // teal
  ['#e8b13d', '#cc9426', '#a87518'],   // mustard
  ['#8f7bc4', '#7561ab', '#5a4a8a'],   // lilac
];
const WHITE = '#f6f1e7', WHITE_SH = '#ddd5c4';
const INKTAG = '#4a4436';
const COL = { now: '#fbbf24', spot: '#22d3ee', open: '#3d9e57' };
const STYLE_ID = 'rt-theme-paper2-style';
const mid = (x, w) => x + w / 2;

export function ensureStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-paper2 .rt-car--departed { opacity: 0.85; }
    .rt-theme-paper2 .rt-car--departed .pp2-art { filter: saturate(0.4); }
    .rt-theme-paper2 .pp2-stamp { visibility: hidden; }
    .rt-theme-paper2 .rt-car--departed .pp2-stamp { visibility: visible; }
    .rt-theme-paper2 .rt-car--current .pp2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 9px ${COL.now}); }
    .rt-theme-paper2 .rt-car--spotlit .pp2-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-paper2 .rt-car--current.rt-car--spotlit .pp2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }
    .rt-rails-paper2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.018);
      background: #b9a98c; border-radius: 999px; box-shadow: 0 calc(var(--rt-th) * 0.006) calc(var(--rt-th) * 0.01) #00000030; }
  `;
  doc.head.appendChild(style);
}

export function buildTrack({ doc }) {
  const el = doc.createElement('div');
  el.className = 'rt-rails rt-rails-paper2';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((railY + 2 - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  return el;
}

const P = (pts, f) => `<polygon points="${pts}" fill="${f}"/>`;
/** soft contact shadow under a piece */
const shadow = (cx, rx) => `<ellipse cx="${cx}" cy="${railY + 4}" rx="${rx}" ry="5" fill="#00000022"/>`;
/** avatar sticker with a white rim */
function sticker(id, cx, cy, r, v) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="${WHITE}"/><circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="none" stroke="#00000018" stroke-width="1"/>` +
    avatarSVG(id, cx, cy, r, v.image, v.name, '#8a8070');
}
/** name tag: a little folded paper label below the piece */
function tag(cx, v, maxw) {
  const t = v.timeLines?.[0] ?? '';
  return `<path d="M ${cx - 52} ${railY + 12} L ${cx + 52} ${railY + 12} L ${cx + 52} ${railY + 40} L ${cx - 52} ${railY + 40} Z" fill="${WHITE}"/>` +
    `<path d="M ${cx - 52} ${railY + 12} L ${cx - 44} ${railY + 20} L ${cx - 52} ${railY + 20} Z" fill="${WHITE_SH}"/>` +
    `<text class="rt-fit pp2-name" data-maxw="${maxw}" x="${cx}" y="${railY + 26}" text-anchor="middle" font-weight="700" font-size="12.5" fill="${INKTAG}" font-family="'Public Sans', system-ui, sans-serif">${esc(v.name)}</text>` +
    `<text class="pp2-time" x="${cx}" y="${railY + 37}" text-anchor="middle" font-weight="600" font-size="9" fill="#8a8070" font-family="'DM Mono', monospace">${esc(t)}</text>`;
}
function nowFlag(cx) {
  return `<g class="rt-pointer rt-now-bob"><path d="M ${cx - 26} ${-18} L ${cx + 26} ${-18} L ${cx + 26} ${0} L ${cx} ${-6} L ${cx - 26} ${0} Z" fill="${COL.now}"/><text x="${cx}" y="${-5}" text-anchor="middle" font-weight="800" font-size="11" fill="#4a3110" font-family="'Public Sans', sans-serif">${esc(L('overlay.now'))}</text></g>`;
}
function stamp(cx, cy) {
  return `<g class="pp2-stamp" transform="rotate(-8 ${cx} ${cy})"><rect x="${cx - 38}" y="${cy - 13}" width="76" height="26" rx="2" fill="#f2e9b8ee" stroke="#c9b25a" stroke-width="1.5"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-weight="800" font-size="13" fill="#8a7326" letter-spacing="2" font-family="'Public Sans', sans-serif">${esc(L('overlay.played'))}</text></g>`;
}

/** ENGINE — paper airplane (dart) pointing left, nose slightly up. */
function oriPlane(x, v, i) {
  const nx = x + 6, ny = 96;               // nose
  const tx = x + 176, tTop = 58, tBot = 132;
  const [m, sh, dp] = PAPERS[1];
  let s = shadow(x + 96, 74);
  // under-wing (deep), body fold (white), top wing (main + shade facets)
  s += P(`${nx},${ny} ${tx},${tBot} ${x + 120},${tBot + 6}`, dp);
  s += P(`${nx},${ny} ${tx},${tTop} ${tx},${tBot}`, m);
  s += P(`${nx},${ny} ${tx},${tTop} ${x + 140},${ny + 8}`, sh);
  s += P(`${nx},${ny} ${x + 140},${ny + 8} ${tx},${tBot}`, WHITE);
  s += P(`${nx},${ny} ${x + 108},${ny + 4} ${x + 112},${tBot - 6}`, WHITE_SH);
  // centre crease
  s += `<line x1="${nx}" y1="${ny}" x2="${tx}" y2="${tBot}" stroke="#00000022" stroke-width="1.5"/>`;
  s += sticker(`pp2-av-${i}`, x + 128, 96, 19, v);
  s += tag(x + 96, v, 92);
  return { body: s, nowX: x + 96 };
}

/** Crane: body diamond, tall folded wing, zigzag neck + head, tail. */
function oriCrane(x, w, v, i, [m, sh, dp]) {
  const cx = mid(x, w), by = 118;          // body centre
  let s = shadow(cx, 60);
  // tail (right, points up-back)
  s += P(`${cx + 18},${by - 4} ${cx + 62},${by - 40} ${cx + 30},${by + 10}`, sh);
  // neck + head (left)
  s += P(`${cx - 18},${by - 4} ${cx - 56},${by - 46} ${cx - 26},${by + 8}`, m);
  s += P(`${cx - 56},${by - 46} ${cx - 72},${by - 34} ${cx - 52},${by - 32}`, dp);   // head
  // body diamond
  s += P(`${cx - 30},${by} ${cx},${by - 26} ${cx + 30},${by} ${cx},${railY - 2}`, m);
  s += P(`${cx - 30},${by} ${cx},${by - 26} ${cx},${railY - 2}`, WHITE);
  // big wing fold rising from the body
  s += P(`${cx - 14},${by - 10} ${cx + 8},${by - 66} ${cx + 34},${by - 8}`, sh);
  s += P(`${cx - 14},${by - 10} ${cx + 8},${by - 66} ${cx - 2},${by - 8}`, dp);
  s += `<line x1="${cx}" y1="${by - 26}" x2="${cx}" y2="${railY - 2}" stroke="#00000022" stroke-width="1.2"/>`;
  s += sticker(`pp2-av-${i}`, cx + 34, by - 34, 17, v);
  s += tag(cx, v, w - 84);
  s += stamp(cx, by - 4);
  return { body: s, nowX: cx };
}

/** Sailboat: hull trapezoid + two sails. */
function oriBoat(x, w, v, i, [m, sh, dp]) {
  const cx = mid(x, w), hy = railY - 26;
  let s = shadow(cx, 62);
  s += P(`${cx - 56},${hy} ${cx + 56},${hy} ${cx + 38},${railY - 2} ${cx - 38},${railY - 2}`, m);
  s += P(`${cx - 56},${hy} ${cx - 38},${railY - 2} ${cx - 30},${hy}`, dp);
  s += P(`${cx - 4},${hy - 4} ${cx - 4},${hy - 62} ${cx - 46},${hy - 4}`, WHITE);   // main sail
  s += P(`${cx - 4},${hy - 4} ${cx - 4},${hy - 62} ${cx - 16},${hy - 4}`, WHITE_SH);
  s += P(`${cx + 6},${hy - 4} ${cx + 6},${hy - 48} ${cx + 42},${hy - 4}`, sh);       // jib
  s += sticker(`pp2-av-${i}`, cx + 34, hy - 34, 17, v);
  s += tag(cx, v, w - 84);
  s += stamp(cx, hy - 8);
  return { body: s, nowX: cx };
}

/** Pinwheel on a stick. */
function oriPinwheel(x, w, v, i, [m, sh, dp]) {
  const cx = mid(x, w), py = 92, r = 40;
  let s = shadow(cx, 40);
  s += `<line x1="${cx}" y1="${py}" x2="${cx}" y2="${railY - 2}" stroke="#b9a98c" stroke-width="5" stroke-linecap="round"/>`;
  for (let k = 0; k < 4; k++) {
    const a = k * 90;
    s += `<g transform="rotate(${a} ${cx} ${py})">` +
      P(`${cx},${py} ${cx + r},${py - r * 0.35} ${cx + r * 0.62},${py - r * 0.9}`, k % 2 ? m : sh) +
      P(`${cx},${py} ${cx + r * 0.62},${py - r * 0.9} ${cx + r * 0.2},${py - r * 0.55}`, WHITE) +
      `</g>`;
  }
  s += `<circle cx="${cx}" cy="${py}" r="5" fill="${dp}"/>`;
  s += sticker(`pp2-av-${i}`, cx + 44, py + 18, 17, v);
  s += tag(cx, v, w - 84);
  s += stamp(cx, py + 4);
  return { body: s, nowX: cx };
}

/** Open slot: a flat unfolded square with dashed crease lines. */
function oriOpen(x, w, v) {
  const cx = mid(x, w), sz = 74, ty = railY - 6 - sz;
  let s = `<rect x="${cx - sz / 2}" y="${ty}" width="${sz}" height="${sz}" fill="#eef3ec" stroke="${COL.open}" stroke-width="2.5" stroke-dasharray="8 6" transform="rotate(-4 ${cx} ${ty + sz / 2})"/>`;
  s += `<line x1="${cx - sz / 2}" y1="${ty + sz / 2}" x2="${cx + sz / 2}" y2="${ty + sz / 2}" stroke="#3d9e5766" stroke-width="1.5" stroke-dasharray="5 5" transform="rotate(-4 ${cx} ${ty + sz / 2})"/>`;
  s += `<line x1="${cx}" y1="${ty}" x2="${cx}" y2="${ty + sz}" stroke="#3d9e5766" stroke-width="1.5" stroke-dasharray="5 5" transform="rotate(-4 ${cx} ${ty + sz / 2})"/>`;
  s += `<text x="${cx}" y="${ty + sz / 2 + 8}" text-anchor="middle" font-weight="800" font-size="22" fill="${COL.open}" font-family="'Public Sans', sans-serif">+</text>`;
  const t = v.timeLines?.[0] ? `${L('overlay.signUp')} · ${v.timeLines[0]}` : L('overlay.signUp');
  return { body: s + tag(cx, { name: L('overlay.open'), timeLines: [t] }, w - 84), nowX: cx };
}

/** Butterfly: thin body diamond, two big upper wings, two smaller lower. */
function oriButterfly(x, w, v, i, [m, sh, dp]) {
  const cx = mid(x, w), by = 108;
  let s = shadow(cx, 52);
  s += P(`${cx - 6},${by - 8} ${cx - 58},${by - 44} ${cx - 44},${by + 4}`, m);       // upper L
  s += P(`${cx + 6},${by - 8} ${cx + 58},${by - 44} ${cx + 44},${by + 4}`, sh);      // upper R
  s += P(`${cx - 5},${by + 4} ${cx - 44},${by + 30} ${cx - 12},${by + 34}`, WHITE);  // lower L
  s += P(`${cx + 5},${by + 4} ${cx + 44},${by + 30} ${cx + 12},${by + 34}`, WHITE_SH); // lower R
  s += P(`${cx - 6},${by - 12} ${cx + 6},${by - 12} ${cx + 3},${by + 36} ${cx - 3},${by + 36}`, dp); // body
  s += `<line x1="${cx - 4}" y1="${by - 12}" x2="${cx - 12}" y2="${by - 24}" stroke="${dp}" stroke-width="1.5"/><line x1="${cx + 4}" y1="${by - 12}" x2="${cx + 12}" y2="${by - 24}" stroke="${dp}" stroke-width="1.5"/>`;
  s += sticker(`pp2-av-${i}`, cx + 40, by - 30, 17, v);
  s += tag(cx, v, w - 84);
  s += stamp(cx, by + 6);
  return { body: s, nowX: cx };
}

/** Fish: faceted body pointing left, split tail folds, dot eye. */
function oriFish(x, w, v, i, [m, sh, dp]) {
  const cx = mid(x, w), fy = 116;
  let s = shadow(cx, 56);
  s += P(`${cx - 54},${fy} ${cx + 16},${fy - 34} ${cx + 16},${fy + 30}`, m);         // body
  s += P(`${cx - 54},${fy} ${cx + 16},${fy - 34} ${cx - 8},${fy}`, WHITE);           // top facet
  s += P(`${cx + 16},${fy - 34} ${cx + 52},${fy - 44} ${cx + 30},${fy - 2}`, sh);    // tail up
  s += P(`${cx + 16},${fy + 30} ${cx + 52},${fy + 36} ${cx + 30},${fy - 2}`, dp);    // tail down
  s += `<circle cx="${cx - 38}" cy="${fy - 4}" r="3" fill="#3a3428"/>`;
  s += sticker(`pp2-av-${i}`, cx + 2, fy - 2, 17, v);
  s += tag(cx, v, w - 84);
  s += stamp(cx, fy - 6);
  return { body: s, nowX: cx };
}

/** Tulip: three-point blossom on a green stem with one folded leaf. */
function oriTulip(x, w, v, i, [m, sh, dp]) {
  const cx = mid(x, w), ty = 78;
  let s = shadow(cx, 34);
  s += `<line x1="${cx}" y1="${ty + 26}" x2="${cx}" y2="${railY - 2}" stroke="#5e9a56" stroke-width="5" stroke-linecap="round"/>`;
  s += P(`${cx},${railY - 26} ${cx + 34},${railY - 46} ${cx + 6},${railY - 12}`, '#79b56e');  // leaf
  s += P(`${cx - 30},${ty + 26} ${cx - 30},${ty - 6} ${cx - 8},${ty + 12}`, sh);     // left petal
  s += P(`${cx + 30},${ty + 26} ${cx + 30},${ty - 6} ${cx + 8},${ty + 12}`, dp);     // right petal
  s += P(`${cx - 30},${ty + 26} ${cx},${ty - 18} ${cx + 30},${ty + 26}`, m);         // centre petal
  s += P(`${cx - 30},${ty + 26} ${cx},${ty - 18} ${cx},${ty + 26}`, WHITE);
  s += sticker(`pp2-av-${i}`, cx + 38, ty + 34, 17, v);
  s += tag(cx, v, w - 84);
  s += stamp(cx, ty + 18);
  return { body: s, nowX: cx };
}

const SHAPES = [oriCrane, oriBoat, oriPinwheel, oriButterfly, oriFish, oriTulip];

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, state, dataAttr;
  if (unit.type === 'engine') {
    parts = oriPlane(x, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    dataAttr = ' data-engine="1"';
  } else if (v.isOpen) {
    parts = oriOpen(x, w, v);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = SHAPES[i % SHAPES.length](x, w, v, i, PAPERS[i % PAPERS.length]);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  return `<g class="rt-car${state}"${dataAttr}><g class="pp2-art">${parts.body}</g>${nowFlag(parts.nowX)}</g>`;
}

export function build(train, opts = {}) {
  const { doc } = opts;
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const units = [];
  const hasEngine = vehicles[0]?.kind === 'engine';
  if (hasEngine) units.push({ type: 'engine', v: vehicles[0] });
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) units.push({ type: car.kind === 'open' ? 'open' : 'car', v: car });
  const widthFor = (u) => (u.type === 'engine' ? ENGINE_W : CAR_W);
  const xs = [];
  let acc = 0;
  for (const u of units) { xs.push(acc); acc += widthFor(u) + GAP; }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => { body += renderUnit(u, xs[i], widthFor(u), i); });

  const holder = doc.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-paper2" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:0.9">${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.pp2-time') }; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.pp2-time') });
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
    afterAttach() { fitAll(svg); undulate(svg); },
  };
}

/** Floor = the name-tag bottom (railY + 40). */
export const foot = (railY + 40 - VIEW_TOP) / VIEW_H;

export default { key: 'paper', ensureStyles, build, buildTrack, foot };
