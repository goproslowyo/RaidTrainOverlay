/**
 * flat2 — "Streamliner" polish pass on flat. Keeps the flat 2-tone vector language
 * but rebuilds the art as a cohesive mid-century streamliner: one warm palette
 * (cream + deep teal + coral), a rounded diesel nose instead of the toy steam
 * engine, a continuous livery band that carries every avatar, and consistent
 * light (top highlight / bottom shade on every surface). Same contract, perf
 * rules, and state classes as the roster themes.
 */
import { esc, wheel, smokeSVG, pointerSVG, avatarSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

let L = themeT();

const ENGINE_W = 236;
const CAR_W = 184;
const GAP = 12;
const railY = 176;
const VIEW_TOP = -34;
const VIEW_BOTTOM = 206;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const TIME_LH = 13;
const bTop = 92, bBot = 164;             // car body band
const C = {
  cream: '#f2e8d5', creamHi: '#faf4e6', creamLo: '#ddcfb4',
  teal: '#175a57', tealHi: '#20716d', tealLo: '#0e403e',
  coral: '#dd6e56', coralHi: '#e98a74', coralLo: '#b8503b',
  ink: '#28251f', inkHi: '#4a453a', brass: '#d9a441',
  win: '#12333b', winHi: '#1d4a53',
};
const COL = { now: '#fbbf24', spot: '#22d3ee', open: '#3f9e63' };
const STYLE_ID = 'rt-theme-flat2-style';
const mid = (x, w) => x + w / 2;

export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-flat2 .rt-car--departed { opacity: 0.86; }
    .rt-theme-flat2 .rt-car--departed image { filter: saturate(0.55); }
    .rt-theme-flat2 .f2-stamp { visibility: hidden; }
    .rt-theme-flat2 .rt-car--departed .f2-stamp { visibility: visible; }
    .rt-theme-flat2 .rt-car--current .f2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 9px ${COL.now}); }
    .rt-theme-flat2 .rt-car--spotlit .f2-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-flat2 .rt-car--current.rt-car--spotlit .f2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }
    .rt-theme-flat2 .f2-time { fill: #d9cfb9; }
    .rt-theme-flat2 .rt-car--current .f2-time { fill: #fde68a; }
    .rt-theme-flat2 .rt-car--spotlit .f2-time { fill: #a5f3fc; }
    /* Name/time contrast floor over busy scenes (same trick as pride). */
    .rt-theme-flat2 .f2-name, .rt-theme-flat2 .f2-time { paint-order: stroke; stroke: #171410; stroke-width: 2.5px; stroke-opacity: .45; stroke-linejoin: round; }

    .rt-rails-flat2 { top: var(--rt-rail-top); height: var(--rt-rail-h); }
    .rt-rails-flat2::before, .rt-rails-flat2::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-flat2::before { top: 0; height: calc(var(--rt-th) * 0.02); background: #8f8878; box-shadow: 0 -1px 0 #c9c0aa; }
    .rt-rails-flat2::after {
      top: calc(var(--rt-th) * 0.02); bottom: 0;
      background: repeating-linear-gradient(90deg, #4c4437 0 calc(var(--rt-th) * 0.045), transparent calc(var(--rt-th) * 0.045) calc(var(--rt-th) * 0.1));
    }
  `;
  document.head.appendChild(style);
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-flat2';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((railY + 6 - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  el.style.setProperty('--rt-rail-h', `calc(var(--rt-th) * ${(16 / VIEW_H).toFixed(4)})`);
  return el;
}

function timeTspans(lines, x, baseY) {
  return (lines?.length ? lines : ['']).map((line, i) => `<tspan x="${x}" y="${baseY + i * TIME_LH}">${esc(line)}</tspan>`).join('');
}
function setTimeLines(timeText, lines) {
  const x = timeText.getAttribute('x');
  const baseY = Number(timeText.dataset.baseY);
  timeText.replaceChildren();
  (lines?.length ? lines : ['']).forEach((line, i) => {
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', x);
    tspan.setAttribute('y', String(baseY + i * TIME_LH));
    tspan.textContent = line;
    timeText.appendChild(tspan);
  });
}

/** Flat streamliner wheel: dark tyre, cream disc, teal hub. */
function f2Wheel(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="${C.ink}"/>` + wheel(cx, cy, r, C.creamLo, 6, '#00000033');
}
/** Coupler bar between units. */
const coupler = (x) => `<rect x="${x - GAP - 3}" y="${railY - 34}" width="${GAP + 8}" height="7" rx="3.5" fill="${C.ink}"/>`;
/** Under-body skirt + bogie shadow. */
const skirt = (x, w) => `<rect x="${x + 12}" y="${bBot}" width="${w - 24}" height="8" rx="3" fill="${C.ink}"/>`;

/** The steam express locomotive — a flat-vector boiler + smokebox + tall cab,
 *  coral funnel and cowcatcher, big driving wheels with a coupling rod. The
 *  driver rides the cab window. */
function f2Engine(x, v, i) {
  const w = ENGINE_W;
  const av = { cx: x + 181, cy: 112, r: 20 };
  let s = '';
  // running board + coral cowcatcher
  s += `<rect x="${x + 6}" y="${railY - 16}" width="${w - 20}" height="8" rx="3" fill="${C.ink}"/>`;
  s += `<path d="M ${x + 2} ${railY + 2} L ${x + 30} ${railY - 26} L ${x + 30} ${railY + 2} Z" fill="${C.coral}"/>`;
  s += `<path d="M ${x + 9} ${railY} L ${x + 27} ${railY - 16} L ${x + 27} ${railY} Z" fill="${C.coralHi}"/>`;
  // cab: tall block at the rear, coral roof, driver in the window
  s += `<rect x="${x + 150}" y="84" width="62" height="80" rx="8" fill="${C.teal}"/>`;
  s += `<rect x="${x + 150}" y="84" width="62" height="8" rx="4" fill="${C.tealHi}"/>`;
  s += `<rect x="${x + 150}" y="152" width="62" height="12" rx="6" fill="${C.tealLo}"/>`;
  s += `<rect x="${x + 144}" y="72" width="74" height="13" rx="5" fill="${C.coral}"/>`;
  s += `<rect x="${x + 144}" y="72" width="74" height="4" rx="2" fill="${C.coralHi}"/>`;
  s += `<rect x="${x + 157}" y="96" width="48" height="34" rx="6" fill="${C.win}"/>`;
  s += `<circle cx="${av.cx}" cy="${av.cy}" r="${av.r + 4}" fill="${C.creamHi}"/>`;
  s += avatarSVG(`f2-av-${i}`, av.cx, av.cy, av.r, v.image, v.name, C.teal);
  // boiler cylinder with light top / shaded belly + two bands
  s += `<rect x="${x + 12}" y="104" width="142" height="48" rx="24" fill="${C.teal}"/>`;
  s += `<rect x="${x + 26}" y="108" width="120" height="12" rx="6" fill="${C.tealHi}"/>`;
  s += `<rect x="${x + 26}" y="142" width="128" height="10" rx="5" fill="${C.tealLo}"/>`;
  s += `<rect x="${x + 118}" y="104" width="4" height="48" fill="${C.tealLo}"/>`;
  // smokebox face (dark disc + hinged door), coral funnel, brass dome
  s += `<circle cx="${x + 30}" cy="128" r="24" fill="${C.tealLo}"/>`;
  s += `<circle cx="${x + 26}" cy="128" r="17" fill="${C.ink}"/><circle cx="${x + 26}" cy="128" r="7" fill="${C.inkHi}"/>`;
  s += `<path d="M ${x + 40} 104 L ${x + 64} 104 L ${x + 68} 78 L ${x + 36} 78 Z" fill="${C.coral}"/>`;
  s += `<rect x="${x + 32}" y="68" width="40" height="11" rx="4.5" fill="${C.coralLo}"/>`;
  s += `<rect x="${x + 36}" y="71" width="32" height="3.5" rx="1.75" fill="${C.coralHi}"/>`;
  s += `<path d="M ${x + 84} 104 A 14 14 0 0 1 ${x + 112} 104 Z" fill="${C.brass}"/><rect x="${x + 84}" y="100" width="28" height="5" rx="2.5" fill="#b8862f"/>`;
  // headlamp on the smokebox
  s += `<rect x="${x + 16}" y="92" width="15" height="13" rx="3" fill="#ffe9a8"/><rect x="${x + 16}" y="92" width="15" height="13" rx="3" fill="none" stroke="${C.brass}" stroke-width="2"/>`;
  // cream nameplate on the boiler
  s += `<rect x="${x + 54}" y="117" width="82" height="25" rx="5" fill="${C.cream}"/><rect x="${x + 54}" y="117" width="82" height="5" rx="2.5" fill="${C.creamHi}"/>`;
  s += `<text class="rt-fit f2-name" data-maxw="72" x="${x + 95}" y="135" text-anchor="middle" font-weight="800" font-size="14" fill="${C.tealLo}" style="paint-order:none;stroke:none">${esc(v.name)}</text>`;
  const timeBaseY = 46;
  s += `<text class="f2-time" data-base-y="${timeBaseY}" x="${x + 181}" y="${timeBaseY}" text-anchor="middle" font-weight="700" font-size="11" fill="#cfe3dd" style="paint-order:none;stroke:none">${timeTspans(v.timeLines, x + 181, timeBaseY)}</text>`;
  const front = smokeSVG(x + 52, 60, 1.05)
    + `<rect x="${x + 92}" y="${railY - 5}" width="84" height="5" rx="2.5" fill="${C.creamLo}"/>`
    + f2Wheel(x + 40, railY, 11) + f2Wheel(x + 66, railY, 11)
    + f2Wheel(x + 108, railY, 19) + f2Wheel(x + 154, railY, 19) + f2Wheel(x + 194, railY, 13);
  return { body: s, front };
}

/** A streamliner coach: teal body, cream livery band with the avatar + name,
 *  slim window strip up top, coral pinstripe. */
function f2Coach(x, w, v, i, caboose) {
  const av = { cx: x + 42, cy: 128, r: 23 };
  let s = i > 0 ? coupler(x) : '';
  s += `<rect x="${x + 6}" y="${bTop}" width="${w - 12}" height="${bBot - bTop}" rx="12" fill="${C.teal}"/>`;
  s += `<rect x="${x + 6}" y="${bTop}" width="${w - 12}" height="8" rx="4" fill="${C.tealHi}"/>`;
  s += `<rect x="${x + 6}" y="${bBot - 12}" width="${w - 12}" height="12" rx="6" fill="${C.tealLo}"/>`;
  // window strip
  s += `<rect x="${x + 18}" y="${bTop + 8}" width="${w - 36}" height="14" rx="7" fill="${C.win}"/>`;
  s += `<rect x="${x + 18}" y="${bTop + 8}" width="${w - 36}" height="5" rx="2.5" fill="${C.winHi}"/>`;
  // cream livery band
  s += `<rect x="${x + 6}" y="112" width="${w - 12}" height="34" fill="${C.cream}"/>`;
  s += `<rect x="${x + 6}" y="112" width="${w - 12}" height="4" fill="${C.creamHi}"/>`;
  // coral pinstripe under the band
  s += `<rect x="${x + 6}" y="148" width="${w - 12}" height="3" fill="${C.coral}"/>`;
  if (caboose) {
    s += `<rect x="${x + w - 46}" y="${bTop - 14}" width="30" height="16" rx="4" fill="${C.coral}"/>`;
    s += `<rect x="${x + w - 46}" y="${bTop - 14}" width="30" height="5" rx="2.5" fill="${C.coralHi}"/>`;
    s += `<circle cx="${x + w - 10}" cy="${bBot - 20}" r="4" fill="#e2483a"/>`;
  }
  // avatar set into the cream band
  s += `<circle cx="${av.cx}" cy="${av.cy}" r="${av.r + 5}" fill="${C.creamHi}"/>`;
  s += avatarSVG(`f2-av-${i}`, av.cx, av.cy, av.r, v.image, v.name, C.teal);
  s += `<text class="rt-fit f2-name" data-maxw="${w - 98}" x="${x + 78}" y="133" font-weight="800" font-size="15" fill="${C.tealLo}" style="paint-order:none;stroke:none">${esc(v.name)}</text>`;
  const timeBaseY = 160;
  s += `<text class="f2-time" data-base-y="${timeBaseY}" x="${x + 78}" y="${timeBaseY}" font-weight="700" font-size="11" style="paint-order:none;stroke:none">${timeTspans(v.timeLines, x + 78, timeBaseY)}</text>`;
  s += skirt(x, w);
  const sx = mid(x, w), sy = 130;
  s += `<g class="f2-stamp" transform="rotate(-8 ${sx} ${sy})"><rect x="${sx - 40}" y="${sy - 14}" width="80" height="28" rx="4" fill="#2b1d14d9" stroke="#e8cf9f" stroke-width="2"/><text x="${sx}" y="${sy + 6}" text-anchor="middle" font-weight="800" font-size="14" fill="#f3e4c2" letter-spacing="2">${esc(L('overlay.played'))}</text></g>`;
  const front = f2Wheel(x + 40, railY, 14) + f2Wheel(x + w - 40, railY, 14);
  return { body: s, front };
}

function f2Open(x, w, v, i) {
  const cx = mid(x, w);
  let s = i > 0 ? coupler(x) : '';
  s += `<rect x="${x + 8}" y="${bTop}" width="${w - 16}" height="${bBot - bTop}" rx="12" fill="#10251f66"/>`;
  s += `<rect x="${x + 8}" y="${bTop}" width="${w - 16}" height="${bBot - bTop}" rx="12" fill="none" stroke="${COL.open}" stroke-width="3.5" stroke-dasharray="9 7"/>`;
  s += `<text x="${cx}" y="126" text-anchor="middle" font-weight="800" font-size="26" fill="#7fd6a4">${esc(L('overlay.open'))}</text>`;
  const signUp = L('overlay.signUp');
  const openTime = v.timeLines?.[0] ? `${esc(signUp)} · ${esc(v.timeLines[0])}` : esc(signUp);
  s += `<text class="f2-time" data-base-y="150" x="${cx}" y="150" text-anchor="middle" font-weight="700" font-size="12" fill="#7fd6a4" style="paint-order:none;stroke:none">${openTime}</text>`;
  const front = f2Wheel(x + 42, railY, 14) + f2Wheel(x + w - 42, railY, 14);
  return { body: s, front };
}

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, state, pointer = '', dataAttr;
  if (unit.type === 'engine') {
    parts = f2Engine(x, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(x + 181, 26, COL.now, L('overlay.now'))}</g>`;
    dataAttr = ' data-engine="1"';
  } else if (v.isOpen) {
    parts = f2Open(x, w, v, i);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(mid(x, w), 58, COL.now, L('overlay.now'))}</g>`;
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = f2Coach(x, w, v, i, unit.type === 'caboose');
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(x + 42, 58, COL.now, L('overlay.now'))}</g>`;
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  return `<g class="rt-car${state}"${dataAttr}><g class="f2-art">${parts.body}</g><g class="f2-front">${parts.front}</g>${pointer}</g>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const units = [];
  const hasEngine = vehicles[0]?.kind === 'engine';
  if (hasEngine) units.push({ type: 'engine', v: vehicles[0] });
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) {
    units.push({ type: car.kind === 'open' ? 'open' : car.kind === 'caboose' ? 'caboose' : 'car', v: car });
  }
  const widthFor = (u) => (u.type === 'engine' ? ENGINE_W : CAR_W);
  const xs = [];
  let acc = 0;
  for (const u of units) { xs.push(acc); acc += widthFor(u) + GAP; }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => { body += renderUnit(u, xs[i], widthFor(u), i); });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-flat2" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:0.85">${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.f2-time') }; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.f2-time') });
  });

  return {
    node: svg,
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          ref.group.classList.toggle('rt-car--current', car.isCurrent);
          ref.group.classList.toggle('rt-car--departed', car.isDeparted);
          ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
          if (ref.timeText && !car.isOpen) setTimeLines(ref.timeText, car.timeLines ?? [car.relativeTime]);
        }
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        if (engineRef.timeText) setTimeLines(engineRef.timeText, eng.timeLines ?? [eng.relativeTime ?? '']);
      }
    },
    afterAttach() { fitAll(svg); undulate(svg); },
  };
}

/** Floor = the biggest wheel rim (cy = railY, r+2 = 21). */
export const foot = (railY + 21 - VIEW_TOP) / VIEW_H;

export default { key: 'flat', ensureStyles, build, buildTrack, foot };
