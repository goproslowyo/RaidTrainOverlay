/**
 * flat — Flat-illustration Theme. A clean, characterful flat-vector
 * train: a steam locomotive whose "face" is the first streamer's portrait, a brass
 * funnel + domes, a cab, a cowcatcher, big driving wheels, and flat passenger
 * coaches — all in flat colour blocks with a light/shadow 2-tone for subtle depth
 * (no gradients). Wired to the live Train view-model and adapted for the Overlay:
 *
 *  - viewBox only (no width/height) so CSS --train-height sizes it, with
 *    headroom above the chimney smoke / Now pointer so neither clips.
 *  - The locomotive shows the FIRST streamer, with their live state (Now
 *    Marker + Spotlight glow during their Slot, post-event dim) — it stays bright
 *    after their slot (eternal leader, never dims on the per-slot isDeparted). The
 *    Organiser rides the tender right behind it; a departed Slot is lightly dimmed
 *    and stamped PLAYED (legibility — viewer feedback).
 *  - State is toggleable classes (rt-car--current / --departed / --spotlit) so Now +
 *    Spotlight coexist and a time tick re-styles in place. The per-state time colour
 *    is a CSS rule on .fl-time.
 *  - Glows use CSS drop-shadow over a static .fl-art group; the wheels + smoke ride a
 *    sibling .fl-front layer, so a lit Car's filtered bitmap is cached and the
 *    animating parts never re-trigger it (memory `theme-rendering-constraints`).
 *
 * Transparent only — no full-bleed background.
 */
import { esc, wheel, smokeSVG, pointerSVG, avatarSVG, fitAll, undulate, toVehicles } from './shared-svg.js';

const ENGINE_W = 208;
const CAR_W = 176;
const TENDER_W = 138;
const GAP = 10;
const railY = 178; // wheel-contact line
const VIEW_TOP = -8;
const VIEW_BOTTOM = 200;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const TIME_LH = 13;
const COL = { now: '#fbbf24', spot: '#22d3ee', open: '#37b24d' };
// Flat palette: each surface is a base + a lighter top highlight + a darker shadow.
const C = {
  eng: '#f76707', engHi: '#ff922b', engLo: '#d9480f',
  blue: '#4263eb', blueHi: '#5c7cfa', blueLo: '#364fc7',
  cab: '#1f2d5c', cabHi: '#2f4080',
  dark: '#343a40', darkHi: '#4b5563', brass: '#fcc419', cream: '#fff9db',
  win: '#16213e', lamp: '#ffe066', tender: '#2b2118', purple: '#7048e8',
};
const STYLE_ID = 'rt-theme-flat-style';

const RAIL_HEAD = railY + 4;
const RAIL_BAND = 22;
const centerX = (x, w) => x + w / 2;

export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-flat .rt-car--departed { opacity: 0.82; }
    .rt-theme-flat .rt-car--departed image { filter: saturate(0.55); }
    .rt-theme-flat .fl-stamp { visibility: hidden; }
    .rt-theme-flat .rt-car--departed .fl-stamp { visibility: visible; }
    .rt-theme-flat .rt-car--current .fl-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.now}); }
    .rt-theme-flat .rt-car--spotlit .fl-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 8px ${COL.spot}); }
    .rt-theme-flat .rt-car--current.rt-car--spotlit .fl-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }
    .rt-theme-flat .fl-time { fill: #dbeafe; }
    .rt-theme-flat .rt-car--current .fl-time { fill: #fde68a; }
    .rt-theme-flat .rt-car--spotlit .fl-time { fill: #a5f3fc; }

    .rt-rails-flat { top: var(--rt-rail-top); height: var(--rt-rail-h); }
    .rt-rails-flat::before, .rt-rails-flat::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-flat::before { top: 0; height: calc(var(--rt-th) * 0.022); background: #9aa3ad; box-shadow: 0 -1px 0 #cfd6dd; }
    .rt-rails-flat::after {
      top: calc(var(--rt-th) * 0.022); bottom: 0;
      background: repeating-linear-gradient(90deg, #6b4423 0 calc(var(--rt-th) * 0.05), transparent calc(var(--rt-th) * 0.05) calc(var(--rt-th) * 0.11));
    }
  `;
  document.head.appendChild(style);
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-flat';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((RAIL_HEAD - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  el.style.setProperty('--rt-rail-h', `calc(var(--rt-th) * ${(RAIL_BAND / VIEW_H).toFixed(4)})`);
  return el;
}

function timeTspans(lines, x, baseY) {
  return lines.map((line, i) => `<tspan x="${x}" y="${baseY + i * TIME_LH}">${esc(line)}</tspan>`).join('');
}
function setTimeLines(timeText, lines) {
  const x = timeText.getAttribute('x');
  const baseY = Number(timeText.dataset.baseY);
  timeText.replaceChildren();
  lines.forEach((line, i) => {
    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
    tspan.setAttribute('x', x);
    tspan.setAttribute('y', String(baseY + i * TIME_LH));
    tspan.textContent = line;
    timeText.appendChild(tspan);
  });
}

/** A flat 2-tone spoked wheel (dark tyre + a coloured rim band + brass hub). The
 *  base wheel() spins it; we layer a coloured rim ring behind for the flat look. */
function flatWheel(cx, cy, r, rim) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 2}" fill="${rim}"/>` + wheel(cx, cy, r, C.dark, 6, C.darkHi);
}

// Each builder returns { body, front }: static art (glow-filtered) + animating layer.

function flatEngine(x, v, i) {
  const by = 110, bh = 48;          // boiler band
  const av = { cx: x + 177, cy: by + 8, r: 17 };  // the driver, framed in the cab window
  // Frame / running board under the boiler.
  let s = `<rect x="${x + 8}" y="${railY - 20}" width="${ENGINE_W - 26}" height="9" rx="3" fill="${C.dark}"/>`;
  // Cowcatcher (pilot) at the front.
  s += `<path d="M ${x + 2} ${railY - 4} L ${x + 26} ${railY - 24} L ${x + 26} ${railY - 2} Z" fill="${C.dark}"/>`;
  for (let k = 0; k < 3; k++) s += `<line x1="${x + 8 + k * 5}" y1="${railY - 4}" x2="${x + 22}" y2="${railY - 16 + k * 4}" stroke="${C.darkHi}" stroke-width="1.5"/>`;
  // Cab (back).
  s += `<rect x="${x + 150}" y="${by - 22}" width="52" height="${bh + 28}" rx="7" fill="${C.eng}"/>`;
  s += `<rect x="${x + 154}" y="${by - 18}" width="44" height="16" rx="6" fill="${C.engHi}"/>`;
  s += `<rect x="${x + 144}" y="${by - 30}" width="64" height="12" rx="4" fill="${C.engLo}"/>`;
  s += `<rect x="${x + 160}" y="${by - 4}" width="34" height="28" rx="4" fill="${C.win}"/><rect x="${x + 163}" y="${by - 1}" width="28" height="11" rx="3" fill="#3b5bdb"/>`;
  // Boiler (rounded cylinder) with a light top band + two boiler bands.
  s += `<rect x="${x + 18}" y="${by}" width="138" height="${bh}" rx="${bh / 2}" fill="${C.eng}"/>`;
  s += `<rect x="${x + 28}" y="${by + 4}" width="120" height="14" rx="7" fill="${C.engHi}"/>`;
  s += `<rect x="${x + 96}" y="${by}" width="4" height="${bh}" fill="${C.engLo}"/><rect x="${x + 128}" y="${by}" width="4" height="${bh}" fill="${C.engLo}"/>`;
  // Funnel + brass domes on top.
  s += `<path d="M ${x + 70} ${by} L ${x + 92} ${by} L ${x + 96} ${by - 26} L ${x + 66} ${by - 26} Z" fill="${C.dark}"/><rect x="${x + 62} " y="${by - 32}" width="38" height="8" rx="3" fill="${C.dark}"/>`;
  s += `<path d="M ${x + 108} ${by} A 13 13 0 0 1 ${x + 134} ${by} Z" fill="${C.brass}"/><rect x="${x + 108}" y="${by - 3}" width="26" height="5" fill="#e8a90c"/>`;
  // Headlamp.
  s += `<rect x="${x + 16}" y="${by + 6}" width="13" height="13" rx="3" fill="${C.lamp}"/>`;
  // The streamer's portrait as the driver, in the cab window.
  s += `<circle cx="${av.cx}" cy="${av.cy}" r="${av.r + 4}" fill="${C.cream}"/>`;
  s += avatarSVG(`fl-av-${i}`, av.cx, av.cy, av.r, v.image, v.name, C.brass);
  // Nameplate + time on the boiler.
  s += `<rect x="${x + 72}" y="${by + 12}" width="74" height="26" rx="5" fill="${C.cream}" stroke="${C.engLo}" stroke-width="2"/>`;
  s += `<text class="rt-fit" data-maxw="66" x="${x + 109}" y="${by + 29}" text-anchor="middle" font-weight="800" font-size="13" fill="${C.engLo}">${esc(v.name)}</text>`;
  const timeBaseY = railY - 26;
  s += `<text class="fl-time" data-base-y="${timeBaseY}" x="${x + 109}" y="${timeBaseY}" text-anchor="middle" font-weight="700" font-size="11">${timeTspans(v.timeLines ?? [''], x + 109, timeBaseY)}</text>`;
  // FRONT (animating, outside the glow): smoke + driving wheels (+ a coupling rod).
  const front = smokeSVG(x + 81, by - 36, 1.15)
    + `<rect x="${x + 60}" y="${railY - 2}" width="58" height="5" rx="2" fill="${C.darkHi}"/>`
    + flatWheel(x + 30, railY, 10, C.engLo)
    + flatWheel(x + 64, railY, 19, C.engHi)
    + flatWheel(x + 114, railY, 19, C.engHi)
    + flatWheel(x + 168, railY, 14, C.engHi);
  return { body: s, front };
}

function flatTender(x, w, org) {
  const cx = centerX(x, w);
  let s = `<rect x="${x - GAP - 2}" y="${railY - 40}" width="${GAP + 6}" height="8" rx="4" fill="${C.dark}"/>`;
  s += `<rect x="${x + 8}" y="${railY - 18}" width="${w - 16}" height="9" rx="3" fill="${C.dark}"/>`;
  s += `<rect x="${x + 10}" y="104" width="${w - 20}" height="68" rx="10" fill="${C.tender}" stroke="${C.brass}" stroke-width="2"/>`;
  s += `<rect x="${x + 10}" y="104" width="${w - 20}" height="14" rx="7" fill="#1a140e"/>`;
  for (let k = 0; k < 6; k++) s += `<circle cx="${x + 22 + k * ((w - 44) / 5)}" cy="108" r="4" fill="${C.darkHi}"/>`; // heaped coal
  s += `<circle cx="${x + 34}" cy="138" r="23" fill="${C.cream}"/>`;
  s += avatarSVG('fl-org', x + 34, 138, 19, org.image, org.name, C.brass);
  s += `<text x="${x + 60}" y="130" font-weight="800" font-size="9" fill="#ffd8a8" letter-spacing="1">ORGANISED</text>`;
  s += `<text x="${x + 60}" y="142" font-weight="800" font-size="9" fill="#ffd8a8" letter-spacing="1">BY</text>`;
  s += `<text class="rt-fit" data-maxw="${w - 26}" x="${cx}" y="164" text-anchor="middle" font-weight="800" font-size="14" fill="#fff">${esc(org.name)}</text>`;
  const front = flatWheel(x + 38, railY, 14, '#5a4322') + flatWheel(x + w - 38, railY, 14, '#5a4322');
  return { body: s, front };
}

function flatCoach(x, w, v, i, caboose) {
  const av = { cx: x + 44, cy: 130, r: 27 };
  const roofCol = caboose ? C.purple : C.blueLo;
  let s = i > 0 ? `<rect x="${x - GAP - 2}" y="${railY - 40}" width="${GAP + 6}" height="8" rx="4" fill="${C.dark}"/>` : '';
  // Body with light top band + shadow foot.
  s += `<rect x="${x + 8}" y="96" width="${w - 16}" height="74" rx="14" fill="${C.blue}"/>`;
  s += `<rect x="${x + 14}" y="101" width="${w - 28}" height="24" rx="10" fill="${C.blueHi}"/>`;
  s += `<rect x="${x + 14}" y="156" width="${w - 28}" height="12" rx="6" fill="${C.blueLo}"/>`;
  // Roof (+ caboose cupola).
  s += `<rect x="${x + 4}" y="86" width="${w - 8}" height="16" rx="8" fill="${roofCol}"/>`;
  if (caboose) s += `<rect x="${x + w - 56}" y="68" width="36" height="22" rx="4" fill="${roofCol}"/><rect x="${x + w - 50}" y="73" width="24" height="12" rx="3" fill="${C.win}"/>`;
  // Avatar in a flat round window.
  s += `<circle cx="${av.cx}" cy="${av.cy}" r="${av.r + 4}" fill="${C.win}"/>`;
  s += avatarSVG(`fl-av-${i}`, av.cx, av.cy, av.r, v.image, v.name, '#fff');
  // A small flat window detail near the name.
  s += `<rect x="${x + 84}" y="104" width="${w - 100}" height="20" rx="4" fill="${C.win}"/><rect x="${x + 88}" y="107" width="${w - 108}" height="8" rx="3" fill="#3b5bdb"/>`;
  s += `<text class="rt-fit" data-maxw="${w - 96}" x="${x + 84}" y="142" font-weight="800" font-size="14" fill="#fff">${esc(v.name)}</text>`;
  const timeBaseY = 160;
  s += `<text class="fl-time" data-base-y="${timeBaseY}" x="${x + 84}" y="${timeBaseY}" font-weight="700" font-size="12">${timeTspans(v.timeLines, x + 84, timeBaseY)}</text>`;
  const sx = centerX(x, w), sy = 150;
  s += `<g class="fl-stamp" transform="rotate(-9 ${sx} ${sy})"><rect x="${sx - 38}" y="${sy - 14}" width="76" height="28" rx="4" fill="#0a1024" opacity="0.6" stroke="#bcd2ff" stroke-width="2.5"/><text x="${sx}" y="${sy + 6}" text-anchor="middle" font-weight="800" font-size="15" fill="#dbeafe" letter-spacing="2">PLAYED</text></g>`;
  const front = flatWheel(x + 44, railY, 15, C.blueHi) + flatWheel(x + w - 44, railY, 15, C.blueHi);
  return { body: s, front };
}

function flatOpen(x, w, v, i) {
  const cx = centerX(x, w);
  let s = i > 0 ? `<rect x="${x - GAP - 2}" y="${railY - 40}" width="${GAP + 6}" height="8" rx="4" fill="${C.dark}"/>` : '';
  s += `<rect x="${x + 10}" y="94" width="${w - 20}" height="76" rx="14" fill="none" stroke="${COL.open}" stroke-width="4" stroke-dasharray="10 7"/>`;
  s += `<text x="${cx}" y="130" text-anchor="middle" font-weight="800" font-size="30" fill="${COL.open}">OPEN</text>`;
  const openTime = v.timeLines[0] ? `sign up! · ${esc(v.timeLines[0])}` : 'sign up!';
  s += `<text class="fl-time" data-base-y="152" x="${cx}" y="152" text-anchor="middle" font-weight="700" font-size="12" fill="${COL.open}">${openTime}</text>`;
  const front = flatWheel(x + 46, railY, 15, '#2f9e44') + flatWheel(x + w - 46, railY, 15, '#2f9e44');
  return { body: s, front };
}

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, stateClasses, pointer = '', dataAttr;
  if (unit.type === 'engine') {
    parts = flatEngine(x, v, i);
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(x + 40, 60, COL.now, 'NOW')}</g>`;
    dataAttr = ' data-engine="1"';
  } else if (unit.type === 'tender') {
    parts = flatTender(x, w, v);
    stateClasses = '';
    dataAttr = ' data-tender="1"';
  } else if (v.isOpen) {
    parts = flatOpen(x, w, v, i);
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(centerX(x, w), 60, COL.now, 'NOW')}</g>`;
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = flatCoach(x, w, v, i, unit.type === 'caboose');
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(x + 44, 60, COL.now, 'NOW')}</g>`;
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  return `<g class="rt-car${stateClasses}"${dataAttr}><g class="fl-art">${parts.body}</g><g class="fl-front">${parts.front}</g>${pointer}</g>`;
}

export function build(train) {
  const vehicles = toVehicles(train);
  const units = [];
  const engine = vehicles[0];
  units.push({ type: 'engine', v: engine });
  if (engine?.organiser) units.push({ type: 'tender', v: engine.organiser });
  for (const car of vehicles.slice(1)) {
    units.push({ type: car.kind === 'open' ? 'open' : car.kind === 'caboose' ? 'caboose' : 'car', v: car });
  }

  const widthFor = (u) => (u.type === 'engine' ? ENGINE_W : u.type === 'tender' ? TENDER_W : CAR_W);
  const xs = [];
  let acc = 0;
  for (const u of units) { xs.push(acc); acc += widthFor(u) + GAP; }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => { body += renderUnit(u, xs[i], widthFor(u), i); });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-flat" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img">${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.fl-time') }; return; }
    if (group.dataset.tender) { tenderEls.push(group); return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.fl-time') });
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
      for (const el of tenderEls) el.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
    },
    afterAttach() { fitAll(svg); undulate(svg); },
  };
}

export default { key: 'flat', ensureStyles, build, buildTrack };
