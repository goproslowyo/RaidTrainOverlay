/**
 * comic2 — polish pass on the comic-book Theme. Keeps the strong parts (ink
 * outlines, halftone, speech-bubble names, hard offset shadows) and raises the
 * craft: a restrained pulp palette (paper cream + pulp red / cyan / yellow only),
 * halftone that tints WITH each body colour, a chunkier better-proportioned
 * engine, speed-line dashes behind the wheels, calmer POW bursts, and a red
 * rubber-stamp PLAYED. SVG medium, same contract as the roster themes.
 */
import { esc, wheel, pointerSVG, avatarSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

let L = themeT();

const ENGINE_W = 212;
const CAR_W = 172;
const GAP = 16;
const railY = 176;
const VIEW_TOP = -20;
const VIEW_BOTTOM = 202;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const INK = '#141210';
const PAPER = '#f6ecd6';
// Pulp trio only — cycled: red, cyan, yellow.
const TINTS = ['#d9463e', '#3fa7c4', '#f2c744', '#e8823c', '#69a244'];
const COL = { now: '#f2c744', spot: '#22d3ee', open: '#3d9e57' };
const STYLE_ID = 'rt-theme-comic2-style';
const mid = (x, w) => x + w / 2;

export function ensureStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-comic2 .rt-car--departed { opacity: 0.86; }
    .rt-theme-comic2 .rt-car--departed .c2-body { filter: grayscale(0.45) contrast(0.96); }
    .rt-theme-comic2 .c2-stamp { visibility: hidden; }
    .rt-theme-comic2 .rt-car--departed .c2-stamp { visibility: visible; }
    .rt-theme-comic2 .rt-car--current .c2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 9px ${COL.now}); }
    .rt-theme-comic2 .rt-car--spotlit .c2-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-comic2 .rt-car--current.rt-car--spotlit .c2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }
    .rt-theme-comic2 .c2-spark { visibility: hidden; }
    .rt-theme-comic2 .rt-car--spotlit .c2-spark { visibility: visible; }

    /* One sound-effect burst pops on the live car only — rarer, calmer than before. */
    .rt-theme-comic2 .c2-pow { opacity: 0; transform-box: fill-box; transform-origin: center; }
    .rt-theme-comic2 .rt-car--current .c2-pow { animation: c2-pow 9s ease-in-out infinite; }
    @keyframes c2-pow {
      0%, 86%, 100% { opacity: 0; transform: scale(0.2); }
      90% { opacity: 1; transform: scale(1.18); }
      93% { transform: scale(0.94); }
      97% { opacity: 1; transform: scale(1.04); }
    }
    /* Speed-line dashes behind the wheels — compositor-only shimmer. */
    .rt-theme-comic2 .c2-speed { animation: c2-speed 0.9s steps(2) infinite; }
    @keyframes c2-speed { 0% { opacity: 1; } 50% { opacity: 0.25; } 100% { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) {
      .rt-theme-comic2 .c2-pow, .rt-theme-comic2 .c2-speed { animation: none; opacity: 0; }
      .rt-theme-comic2 .c2-speed { opacity: 1; }
    }

    .rt-rails-comic2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.04); }
    .rt-rails-comic2::before { content: ''; position: absolute; inset: 0; background: ${INK}; border-radius: 999px; }
    .rt-rails-comic2::after { content: ''; position: absolute; left: 0; right: 0; top: 20%; height: 18%; background: #ffffff38; border-radius: 999px; }
  `;
  doc.head.appendChild(style);
}

export function buildTrack({ doc }) {
  const el = doc.createElement('div');
  el.className = 'rt-rails rt-rails-comic2';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((railY + 2 - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  return el;
}

/** Ink-outlined halftoned box with a hard offset shadow. The halftone is a
 *  darker shade of the SAME hue (pattern reused, multiplied by opacity). */
function inkBox(x, y, w, h, r, tint) {
  return `<rect x="${x + 5}" y="${y + 5}" width="${w}" height="${h}" rx="${r}" fill="${INK}"/>` +
    `<rect class="c2-body" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${tint}" stroke="${INK}" stroke-width="4"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#c2-dots)"/>` +
    `<rect x="${x + 4}" y="${y + 4}" width="${w - 8}" height="8" rx="4" fill="#ffffff" opacity=".35"/>`;
}

/** Name in a speech bubble (kept — it's the theme's best move). */
function bubble(cx, topY, w, name, maxw) {
  return `<rect x="${cx - w / 2 + 3}" y="${topY + 3}" width="${w}" height="27" rx="13.5" fill="${INK}"/>` +
    `<rect x="${cx - w / 2}" y="${topY}" width="${w}" height="27" rx="13.5" fill="#fff" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M ${cx - 6} ${topY + 25} L ${cx + 7} ${topY + 25} L ${cx + 1} ${topY + 35} Z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<text class="rt-fit" data-maxw="${maxw}" x="${cx}" y="${topY + 19}" text-anchor="middle" font-weight="800" font-size="14" fill="${INK}">${esc(name)}</text>`;
}

function porthole(id, cx, cy, r, image, name) {
  return `<circle cx="${cx + 3}" cy="${cy + 3}" r="${r + 4}" fill="${INK}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="${PAPER}" stroke="${INK}" stroke-width="4"/>` +
    avatarSVG(id, cx, cy, r, image, name, INK);
}

function nowBurst(cx, y) {
  const star = `M ${cx} ${y - 25} L ${cx + 7} ${y - 9} L ${cx + 25} ${y - 9} L ${cx + 11} ${y + 3} L ${cx + 17} ${y + 21} L ${cx} ${y + 10} L ${cx - 17} ${y + 21} L ${cx - 11} ${y + 3} L ${cx - 25} ${y - 9} L ${cx - 7} ${y - 9} Z`;
  return `<g class="rt-pointer rt-now-bob"><path d="${star}" fill="${INK}" transform="translate(3 3)"/><path d="${star}" fill="${COL.now}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><text x="${cx}" y="${y + 1}" text-anchor="middle" font-weight="800" font-size="12" fill="${INK}">${esc(L('overlay.now'))}!</text></g>`;
}

/** Red rubber-stamp PLAYED — outline only, authentically over-inked corner. */
function playedStamp(cx, cy) {
  return `<g class="c2-stamp" transform="rotate(-11 ${cx} ${cy})">` +
    `<rect x="${cx - 42}" y="${cy - 15}" width="84" height="30" rx="5" fill="#f6ecd6e6" stroke="#c92a2a" stroke-width="3.5"/>` +
    `<rect x="${cx - 38}" y="${cy - 11}" width="76" height="22" rx="3" fill="none" stroke="#c92a2a" stroke-width="1.5" opacity=".6"/>` +
    `<text x="${cx}" y="${cy + 6}" text-anchor="middle" font-weight="800" font-size="15" fill="#c92a2a" letter-spacing="2">${esc(L('overlay.played'))}</text></g>`;
}
const spark = (x, y) => `<text class="c2-spark" x="${x}" y="${y}" font-size="28" font-weight="800" fill="#22d3ee" stroke="${INK}" stroke-width="1.5">★</text>`;

/** Speed-line dashes trailing behind a wheel pair. */
function speedLines(x, w) {
  let s = '<g class="c2-speed">';
  for (let k = 0; k < 3; k++) {
    const y = railY - 8 - k * 12;
    s += `<line x1="${x + 6}" y1="${y}" x2="${x + 34 - k * 8}" y2="${y}" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
  }
  return s + '</g>';
}

/** A jagged POW burst; revealed only on the live car. */
function powBurst(cx, cy, word, col) {
  const spikes = 10;
  let pts = '';
  for (let k = 0; k < spikes * 2; k++) {
    const a = (k / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 === 0 ? 28 : 17;
    pts += `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * 0.85).toFixed(1)} `;
  }
  return `<g class="c2-pow"><g transform="rotate(-8 ${cx} ${cy})">` +
    `<polygon points="${pts}" fill="${INK}" transform="translate(3 3)"/>` +
    `<polygon points="${pts}" fill="${col}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-weight="800" font-size="14" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke">${word}!</text></g></g>`;
}

function comicEngine(x, v, i) {
  const w = ENGINE_W, by = 108, bh = 52;
  const av = { cx: x + 178, cy: by + 6, r: 17 };
  let s = '';
  // frame + cowcatcher
  s += `<rect x="${x + 10}" y="${railY - 18}" width="${w - 30}" height="8" rx="3" fill="${INK}"/>`;
  s += `<path d="M ${x + 2} ${railY} L ${x + 30} ${railY - 26} L ${x + 30} ${railY} Z" fill="${INK}"/>`;
  s += `<path d="M ${x + 8} ${railY - 3} L ${x + 27} ${railY - 18} L ${x + 27} ${railY - 3} Z" fill="${PAPER}"/>`;
  // cab — paper with a red roof
  s += inkBox(x + 152, by - 26, 52, bh + 26, 9, PAPER);
  s += `<rect x="${x + 146}" y="${by - 36}" width="64" height="13" rx="5" fill="${TINTS[0]}" stroke="${INK}" stroke-width="3.5"/>`;
  s += `<rect x="${x + 160}" y="${by - 10}" width="36" height="30" rx="5" fill="#dff2f8" stroke="${INK}" stroke-width="3"/>`;
  // boiler — pulp red, rounded, two ink bands
  s += inkBox(x + 14, by, 142, bh, bh / 2, TINTS[0]);
  s += `<rect x="${x + 96}" y="${by}" width="5" height="${bh}" fill="${INK}"/><rect x="${x + 126}" y="${by}" width="5" height="${bh}" fill="${INK}"/>`;
  // funnel + brass dome
  s += `<path d="M ${x + 58} ${by - 2} L ${x + 84} ${by - 2} L ${x + 88} ${by - 30} L ${x + 54} ${by - 30} Z" fill="${INK}"/>`;
  s += `<rect x="${x + 50}" y="${by - 38}" width="42" height="10" rx="4" fill="${INK}"/><rect x="${x + 54}" y="${by - 35}" width="34" height="4" rx="2" fill="#fff" opacity=".3"/>`;
  s += `<path d="M ${x + 104} ${by} A 12 12 0 0 1 ${x + 128} ${by} Z" fill="${TINTS[2]}" stroke="${INK}" stroke-width="3"/>`;
  // headlamp
  s += `<rect x="${x + 18}" y="${by + 8}" width="15" height="15" rx="4" fill="${TINTS[2]}" stroke="${INK}" stroke-width="3"/>`;
  // driver porthole in the cab
  s += porthole(`c2-av-${i}`, av.cx, av.cy, av.r, v.image, v.name);
  s += bubble(x + 86, by - 4 - 34, 112, v.name, 98);
  const timeBaseY = 152;
  s += `<text class="c2-time" data-base-y="${timeBaseY}" x="${x + 86}" y="${timeBaseY}" text-anchor="middle" font-weight="800" font-size="11" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke">${esc((v.timeLines ?? [''])[0] ?? '')}</text>`;
  s += spark(x + 196, by - 20);
  const cloud = `<g class="rt-smoke">${[[0, 0, 13], [13, -10, 10], [-10, -10, 9], [4, -22, 8], [-3, -32, 6]].map(([dx, dy, r]) =>
    `<circle cx="${x + 71 + dx}" cy="${by - 44 + dy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`).join('')}</g>`;
  const front = cloud + speedLines(x - 26, w) +
    `<rect x="${x + 58}" y="${railY - 2}" width="60" height="5" rx="2.5" fill="${INK}"/>` +
    wheel(x + 34, railY, 11, INK, 6, '#fff') + wheel(x + 70, railY, 19, INK, 6, '#fff') + wheel(x + 118, railY, 19, INK, 6, '#fff') + wheel(x + 172, railY, 14, INK, 6, '#fff');
  return { body: s, front };
}

function comicCoach(x, w, v, i, caboose) {
  const av = { cx: x + 46, cy: 132, r: 26 };
  const tint = TINTS[i % TINTS.length];
  let s = i > 0 ? `<rect x="${x - GAP - 2}" y="${railY - 40}" width="${GAP + 6}" height="8" rx="4" fill="${INK}"/>` : '';
  s += inkBox(x + 8, 94, w - 16, 78, 12, tint);
  if (caboose) {
    s += `<rect x="${x + w - 58 + 3}" y="77" width="40" height="22" rx="5" fill="${INK}"/>`;
    s += `<rect x="${x + w - 58}" y="74" width="40" height="22" rx="5" fill="${PAPER}" stroke="${INK}" stroke-width="3.5"/>`;
  }
  s += porthole(`c2-av-${i}`, av.cx, av.cy, av.r, v.image, v.name);
  // window strip filling the body's right half
  for (let k = 0; k < 3; k++) {
    s += `<rect x="${x + 86 + k * 26}" y="104" width="18" height="16" rx="3" fill="#dff2f8" stroke="${INK}" stroke-width="3"/>`;
  }
  s += bubble(x + 120, 64, w - 88, v.name, w - 104);
  const timeBaseY = 158;
  s += `<text class="c2-time" data-base-y="${timeBaseY}" x="${x + 120}" y="${timeBaseY}" text-anchor="middle" font-weight="800" font-size="12" fill="#fff" stroke="${INK}" stroke-width="3" paint-order="stroke">${esc((v.timeLines ?? [''])[0] ?? '')}</text>`;
  s += spark(x + w - 22, 100);
  s += playedStamp(mid(x, w), 148);
  const front = speedLines(x - 22, w) + wheel(x + 46, railY, 17, INK, 6, '#fff') + wheel(x + w - 46, railY, 17, INK, 6, '#fff');
  return { body: s, front };
}

function comicOpen(x, w, v, i) {
  const cx = mid(x, w);
  let s = i > 0 ? `<rect x="${x - GAP - 2}" y="${railY - 40}" width="${GAP + 6}" height="8" rx="4" fill="${INK}"/>` : '';
  s += `<rect x="${x + 8}" y="94" width="${w - 16}" height="78" rx="12" fill="${PAPER}" opacity=".5"/>`;
  s += `<rect x="${x + 8}" y="94" width="${w - 16}" height="78" rx="12" fill="none" stroke="${COL.open}" stroke-width="4" stroke-dasharray="11 8"/>`;
  s += `<circle cx="${cx}" cy="126" r="24" fill="#fff" stroke="${COL.open}" stroke-width="4"/><text x="${cx}" y="136" text-anchor="middle" font-weight="800" font-size="30" fill="${COL.open}">?</text>`;
  s += `<rect x="${cx - 44}" y="${148}" width="88" height="22" rx="11" fill="#fff" stroke="${COL.open}" stroke-width="3"/><text x="${cx}" y="164" text-anchor="middle" font-weight="800" font-size="12" fill="#24713a">${esc(L('overlay.signUp'))}</text>`;
  const front = wheel(x + 48, railY, 17, INK, 6, '#fff') + wheel(x + w - 48, railY, 17, INK, 6, '#fff');
  return { body: s, front };
}

const POWS = [['POW', '#d9463e'], ['ZOOM', '#3fa7c4'], ['CHOO', '#f2c744']];

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, state, extras = '', dataAttr;
  if (unit.type === 'engine') {
    parts = comicEngine(x, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    extras = nowBurst(x + 44, 46);
    dataAttr = ' data-engine="1"';
  } else if (v.isOpen) {
    parts = comicOpen(x, w, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    extras = nowBurst(mid(x, w), 58);
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = comicCoach(x, w, v, i, unit.type === 'caboose');
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    const [word, col] = POWS[i % POWS.length];
    extras = nowBurst(x + 46, 58) + powBurst(x + w - 34, 44, word, col);
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  return `<g class="rt-car${state}"${dataAttr}><g class="c2-art">${parts.body}</g><g class="c2-front">${parts.front}</g>${extras}</g>`;
}

export function build(train, opts = {}) {
  const { doc } = opts;
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

  const holder = doc.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-comic2" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:1.25">` +
    `<defs><pattern id="c2-dots" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.6" fill="#00000033"/></pattern></defs>${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.c2-time') }; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.c2-time') });
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

/** Floor = the biggest inked wheel (cy = railY, r = 19). */
export const foot = (railY + 19 - VIEW_TOP) / VIEW_H;

export default { key: 'comic', ensureStyles, build, buildTrack, foot };
