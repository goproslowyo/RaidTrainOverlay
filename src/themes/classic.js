/**
 * classic2 — polish pass on classic. A Victorian express: Brunswick-green
 * boiler with brass boiler bands and a proper smokebox, burgundy cab with gold
 * lining, an engraved brass nameplate, and varnished-teak Pullman coaches with
 * clerestory roofs and gold coach lettering. Serif type. SVG medium.
 */
import { esc, wheel, smokeSVG, pointerSVG, avatarSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

let L = themeT();

const ENGINE_W = 234;
const CAR_W = 186;
const GAP = 12;
const railY = 176;
const VIEW_TOP = -30;
const VIEW_BOTTOM = 204;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const C = {
  green: '#1e4d38', greenHi: '#2c6a4e', greenLo: '#123526',
  burg: '#5c2430', burgHi: '#79313f', teak: '#7a4b28', teakHi: '#96603a', teakLo: '#5c3319',
  brass: '#d9a441', brassHi: '#f0c76a', ink: '#1a1712', cream: '#efe3c8', win: '#22303b', winHi: '#3a5468',
};
const COL = { now: '#fbbf24', spot: '#22d3ee', open: '#3f9e63' };
const SERIF = "Georgia, 'Times New Roman', serif";
const STYLE_ID = 'rt-theme-classic2-style';
const mid = (x, w) => x + w / 2;

export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-classic2 .rt-car--departed { opacity: 0.85; }
    .rt-theme-classic2 .rt-car--departed .cl2-art { filter: saturate(0.5) brightness(0.95); }
    .rt-theme-classic2 .cl2-stamp { visibility: hidden; }
    .rt-theme-classic2 .rt-car--departed .cl2-stamp { visibility: visible; }
    .rt-theme-classic2 .rt-car--current .cl2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 10px ${COL.now}aa); }
    .rt-theme-classic2 .rt-car--spotlit .cl2-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 10px ${COL.spot}aa); }
    .rt-theme-classic2 .rt-car--current.rt-car--spotlit .cl2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-classic2 .cl2-time { fill: #d8cdb2; }
    .rt-theme-classic2 .rt-car--current .cl2-time { fill: #fde68a; }
    .rt-theme-classic2 .rt-car--spotlit .cl2-time { fill: #a5f3fc; }

    /* Track: polished steel rail on dark timber sleepers. */
    .rt-rails-classic2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.085); }
    .rt-rails-classic2::before, .rt-rails-classic2::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-classic2::before { top: 0; height: calc(var(--rt-th) * 0.018); background: linear-gradient(#a8a294, #5c574c); box-shadow: 0 calc(var(--rt-th) * -0.005) 0 #d8d2c2; }
    .rt-rails-classic2::after { top: calc(var(--rt-th) * 0.022); bottom: 0;
      background: repeating-linear-gradient(90deg, #3a2d1e 0 calc(var(--rt-th) * 0.05), transparent calc(var(--rt-th) * 0.05) calc(var(--rt-th) * 0.115)); }
  `;
  document.head.appendChild(style);
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-classic2';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((railY + 12 - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  return el;
}

/** Spoked Victorian wheel with a brass hub. */
function vWheel(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 2.5}" fill="${C.ink}"/>` +
    wheel(cx, cy, r, '#2e2a24', 8, '#8a8578') +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="${C.brass}"/>`;
}
const coupler = (x) => `<rect x="${x - GAP - 3}" y="${railY - 30}" width="${GAP + 8}" height="6" rx="3" fill="${C.ink}"/>`;

function brassPlate(cx, cy, w, name, maxw) {
  return `<rect x="${cx - w / 2}" y="${cy - 13}" width="${w}" height="26" rx="4" fill="${C.brass}"/>` +
    `<rect x="${cx - w / 2 + 2}" y="${cy - 11}" width="${w - 4}" height="22" rx="3" fill="none" stroke="#8a6820" stroke-width="1.5"/>` +
    `<rect x="${cx - w / 2 + 2}" y="${cy - 11}" width="${w - 4}" height="5" rx="2.5" fill="${C.brassHi}" opacity=".7"/>` +
    `<text class="rt-fit" data-maxw="${maxw}" x="${cx}" y="${cy + 5.5}" text-anchor="middle" font-weight="700" font-size="14.5" fill="#3a2c10" font-family="${SERIF}">${esc(name)}</text>`;
}

function playedStamp(cx, cy) {
  return `<g class="cl2-stamp" transform="rotate(-8 ${cx} ${cy})">` +
    `<rect x="${cx - 46}" y="${cy - 14}" width="92" height="28" rx="4" fill="#efe3c8e8" stroke="#7a3a2a" stroke-width="2.5"/>` +
    `<text x="${cx}" y="${cy + 5.5}" text-anchor="middle" font-weight="700" font-size="14" fill="#7a3a2a" letter-spacing="3" font-family="${SERIF}">${esc(L('overlay.played'))}</text></g>`;
}

function clEngine(x, v, i) {
  const w = ENGINE_W;
  let s = '';
  // frame + cowcatcher
  s += `<rect x="${x + 8}" y="${railY - 20}" width="${w - 22}" height="9" rx="3" fill="${C.ink}"/>`;
  s += `<path d="M ${x} ${railY + 2} L ${x + 34} ${railY - 30} L ${x + 34} ${railY + 2} Z" fill="${C.burg}"/>`;
  s += `<path d="M ${x + 7} ${railY - 1} L ${x + 30} ${railY - 22} L ${x + 30} ${railY - 1} Z" fill="${C.burgHi}"/>`;
  // cab: burgundy with gold lining, arched roof
  s += `<rect x="${x + 158}" y="80" width="60" height="84" rx="7" fill="${C.burg}"/>`;
  s += `<rect x="${x + 163}" y="86" width="50" height="72" rx="5" fill="none" stroke="${C.brass}" stroke-width="1.75"/>`;
  s += `<path d="M ${x + 150} 82 Q ${x + 188} 66 ${x + 226} 82 L ${x + 224} 88 L ${x + 152} 88 Z" fill="${C.greenLo}"/>`;
  s += `<rect x="${x + 168}" y="94" width="40" height="30" rx="4" fill="${C.win}"/><rect x="${x + 168}" y="94" width="40" height="9" rx="4" fill="${C.winHi}"/>`;
  // boiler: green cylinder, brass bands, smokebox
  s += `<rect x="${x + 20}" y="100" width="146" height="56" rx="14" fill="${C.green}"/>`;
  s += `<rect x="${x + 30}" y="105" width="128" height="12" rx="6" fill="${C.greenHi}"/>`;
  s += `<rect x="${x + 26}" y="144" width="134" height="10" rx="5" fill="${C.greenLo}"/>`;
  s += `<rect x="${x + 92}" y="100" width="6" height="56" fill="${C.brass}"/><rect x="${x + 92}" y="100" width="6" height="10" fill="${C.brassHi}"/>`;
  s += `<rect x="${x + 128}" y="100" width="6" height="56" fill="${C.brass}"/><rect x="${x + 128}" y="100" width="6" height="10" fill="${C.brassHi}"/>`;
  // smokebox: dark drum + hinged door + brass number ring
  s += `<rect x="${x + 14}" y="98" width="26" height="60" rx="10" fill="#23201b"/>`;
  s += `<circle cx="${x + 27}" cy="128" r="15" fill="#2e2a24"/><circle cx="${x + 27}" cy="128" r="15" fill="none" stroke="${C.brass}" stroke-width="2"/><circle cx="${x + 27}" cy="128" r="3" fill="${C.brass}"/>`;
  // funnel with brass cap + steam dome + safety valve
  s += `<path d="M ${x + 40} 100 L ${x + 62} 100 L ${x + 66} 74 L ${x + 36} 74 Z" fill="#23201b"/>`;
  s += `<rect x="${x + 32}" y="64" width="38" height="11" rx="4" fill="${C.brass}"/><rect x="${x + 35}" y="66.5" width="32" height="3.5" rx="1.75" fill="${C.brassHi}"/>`;
  s += `<path d="M ${x + 84} 100 A 15 15 0 0 1 ${x + 114} 100 Z" fill="${C.brass}"/><path d="M ${x + 88} 96 A 11 11 0 0 1 ${x + 110} 96 L ${x + 110} 100 L ${x + 88} 100 Z" fill="${C.brassHi}" opacity=".6"/>`;
  s += `<rect x="${x + 138}" y="88" width="10" height="12" rx="3" fill="${C.brass}"/>`;
  // driver in the cab window
  const av = { cx: x + 188, cy: 112, r: 17 };
  s += avatarSVG(`cl2-av-${i}`, av.cx, av.cy, av.r, v.image, v.name, C.burgHi);
  // brass nameplate on the boiler
  s += brassPlate(x + 93, 130, 96, v.name, 82);
  const timeBaseY = 152;
  s += `<text class="cl2-time" data-base-y="${timeBaseY}" x="${x + 188}" y="${timeBaseY}" text-anchor="middle" font-size="11" font-family="${SERIF}">${esc((v.timeLines ?? [''])[0] ?? '')}</text>`;
  const front = smokeSVG(x + 51, 56, 1.1) +
    `<rect x="${x + 74}" y="${railY - 4}" width="96" height="5" rx="2.5" fill="#8a8578"/>` +
    vWheel(x + 44, railY, 12) + vWheel(x + 74, railY, 12) + vWheel(x + 118, railY, 20) + vWheel(x + 164, railY, 20) + vWheel(x + 204, railY, 14);
  return { body: s, front, nowX: x + 188, nowY: 46 };
}

function clCoach(x, w, v, i, caboose) {
  let s = i > 0 ? coupler(x) : '';
  // teak body with clerestory roof
  s += `<rect x="${x + 6}" y="96" width="${w - 12}" height="66" rx="8" fill="${C.teak}"/>`;
  s += `<rect x="${x + 6}" y="96" width="${w - 12}" height="8" rx="4" fill="${C.teakHi}"/>`;
  s += `<rect x="${x + 6}" y="150" width="${w - 12}" height="12" rx="6" fill="${C.teakLo}"/>`;
  // wood panel lines
  s += `<rect x="${x + 6}" y="118" width="${w - 12}" height="1.5" fill="#00000030"/><rect x="${x + 6}" y="140" width="${w - 12}" height="1.5" fill="#00000030"/>`;
  // clerestory
  s += `<rect x="${x + 22}" y="84" width="${w - 44}" height="14" rx="5" fill="${C.teakLo}"/>`;
  s += `<rect x="${x + 30}" y="87" width="${w - 60}" height="5" rx="2.5" fill="${C.winHi}" opacity=".8"/>`;
  if (caboose) s += `<circle cx="${x + w - 16}" cy="112" r="5" fill="#c03434"/><circle cx="${x + w - 16}" cy="112" r="7.5" fill="none" stroke="${C.brass}" stroke-width="1.75"/>`;
  // gold lining panel + windows
  s += `<rect x="${x + 14}" y="102" width="${w - 28}" height="54" rx="5" fill="none" stroke="${C.brass}" stroke-width="1.25" opacity=".7"/>`;
  for (let k = 0; k < 2; k++) {
    s += `<rect x="${x + w - 66 + k * 26}" y="106" width="18" height="20" rx="4" fill="${C.win}"/><rect x="${x + w - 66 + k * 26}" y="106" width="18" height="6" rx="3" fill="${C.winHi}"/>`;
  }
  // portrait in a brass porthole
  const av = { cx: x + 42, cy: 124, r: 22 };
  s += `<circle cx="${av.cx}" cy="${av.cy}" r="${av.r + 4}" fill="${C.brass}"/><circle cx="${av.cx}" cy="${av.cy}" r="${av.r + 4}" fill="none" stroke="#8a6820" stroke-width="1.5"/>`;
  s += avatarSVG(`cl2-av-${i}`, av.cx, av.cy, av.r, v.image, v.name, C.teakLo);
  // gold coach lettering
  s += `<text class="rt-fit" data-maxw="${w - 104}" x="${x + 74}" y="140" font-weight="700" font-size="14.5" fill="${C.brassHi}" letter-spacing="1" font-family="${SERIF}">${esc(v.name)}</text>`;
  const timeBaseY = 156;
  s += `<text class="cl2-time" data-base-y="${timeBaseY}" x="${x + 74}" y="${timeBaseY}" font-size="11" font-family="${SERIF}">${esc((v.timeLines ?? [''])[0] ?? '')}</text>`;
  s += playedStamp(mid(x, w), 126);
  const front = vWheel(x + 42, railY, 14) + vWheel(x + w - 42, railY, 14);
  return { body: s, front, nowX: x + 42, nowY: 54 };
}

function clOpen(x, w, v, i) {
  const cx = mid(x, w);
  let s = i > 0 ? coupler(x) : '';
  s += `<rect x="${x + 6}" y="96" width="${w - 12}" height="66" rx="8" fill="#1e161060"/>`;
  s += `<rect x="${x + 6}" y="96" width="${w - 12}" height="66" rx="8" fill="none" stroke="${COL.open}" stroke-width="3" stroke-dasharray="10 8"/>`;
  s += `<text x="${cx}" y="124" text-anchor="middle" font-weight="700" font-size="22" fill="#7fd6a4" font-family="${SERIF}" font-style="italic">${esc(L('overlay.open'))}</text>`;
  const t = v.timeLines?.[0] ? `${esc(L('overlay.signUp'))} · ${esc(v.timeLines[0])}` : esc(L('overlay.signUp'));
  s += `<text class="cl2-time" data-base-y="146" x="${cx}" y="146" text-anchor="middle" font-size="11" fill="#7fd6a4" font-family="${SERIF}">${t}</text>`;
  const front = vWheel(x + 44, railY, 14) + vWheel(x + w - 44, railY, 14);
  return { body: s, front, nowX: cx, nowY: 54 };
}

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, state, dataAttr;
  if (unit.type === 'engine') {
    parts = clEngine(x, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    dataAttr = ' data-engine="1"';
  } else if (v.isOpen) {
    parts = clOpen(x, w, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = clCoach(x, w, v, i, unit.type === 'caboose');
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  const pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(parts.nowX, parts.nowY, COL.now, L('overlay.now'))}</g>`;
  return `<g class="rt-car${state}"${dataAttr}><g class="cl2-art">${parts.body}</g>${parts.front}${pointer}</g>`;
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
  holder.innerHTML = `<svg class="rt-theme-classic2" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:0.9">${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.cl2-time') }; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.cl2-time') });
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

/** Floor = the biggest driving wheel (railY + 22.5). */
export const foot = (railY + 22.5 - VIEW_TOP) / VIEW_H;

export default { key: 'classic', ensureStyles, build, buildTrack, foot };
