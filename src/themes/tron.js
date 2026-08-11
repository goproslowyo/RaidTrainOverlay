/**
 * tron2 — tron, redesigned as actual light cycles (Legacy 5th-gen language):
 * two identical hubless glowing wheels, no canopy, a prone rider whose helmet
 * is the avatar, one continuous light line tracing the silhouette, and hard-
 * light ribbons trailing each cycle — the ribbon IS the coupler between units.
 * A departed slot derezzes: ribbon off, circuitry dimmed (film-accurate).
 * Strict cyan/white on black glass; the grid track is the game arena floor.
 */
import { esc, pointerSVG, avatarSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';
import { injectStyle } from './shared-html.js';

let L = themeT();

const CYCLE_W = 218;
const GAP = 34;                 // ribbon length between cycles
const railY = 158;              // wheel centreline
const WHEEL_R = 26;
const VIEW_TOP = -40;
const VIEW_BOTTOM = 192;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const BODY = '#131b26';
const BODY_HI = '#26333f';
const TUBE = '#7ee7ff';
const CORE = '#ffffff';
const COL = { now: '#ffd23e', spot: '#ffffff', open: '#3ddc97' };
const TINTS = ['#7ee7ff', '#ff9a2e', '#c07aff', '#5aff9c', '#ff5a6e'];
const STYLE_ID = 'rt-theme-tron2-style';
const mid = (x, w) => x + w / 2;

export function ensureStyles(doc) {
  injectStyle(doc, STYLE_ID, `
    .rt-theme-tron2 .tr2-art { filter: drop-shadow(0 0 5px #7ee7ff99); }
    .rt-theme-tron2 .rt-car--departed { opacity: 0.8; }
    /* derez: ribbon off, circuits dimmed */
    .rt-theme-tron2 .rt-car--departed .tr2-art { filter: none; }
    .rt-theme-tron2 .rt-car--departed .tr2-tube { stroke: #234450; }
    .rt-theme-tron2 .rt-car--departed .tr2-corefill { fill: #234450; }
    .rt-theme-tron2 .rt-car--departed .tr2-ribbon { visibility: hidden; }
    .rt-theme-tron2 .tr2-stamp { visibility: hidden; }
    .rt-theme-tron2 .rt-car--departed .tr2-stamp { visibility: visible; }
    .rt-theme-tron2 .rt-car--current .tr2-art { filter: drop-shadow(0 0 5px ${COL.now}) drop-shadow(0 0 13px ${COL.now}88); }
    .rt-theme-tron2 .rt-car--current .tr2-tube { stroke: ${COL.now}; }
    .rt-theme-tron2 .rt-car--current .tr2-corefill { fill: #fff6c8; }
    .rt-theme-tron2 .rt-car--spotlit .tr2-art { filter: drop-shadow(0 0 5px #fff) drop-shadow(0 0 13px #ffffff99); }
    .rt-theme-tron2 .rt-car--spotlit .tr2-tube { stroke: #fff; }
    .rt-theme-tron2 .rt-car--current.rt-car--spotlit .tr2-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 12px #fff); }
    .rt-theme-tron2 .tr2-time { fill: #9adcf0; }
    .rt-theme-tron2 .rt-car--current .tr2-time { fill: #ffedb0; }
    /* hubless wheels: a faint dashed energy ring rotates inside the rim */
    .rt-theme-tron2 .tr2-spin { transform-box: fill-box; transform-origin: center; animation: tr2-spin 1.1s linear infinite reverse; }
    /* ribbon shimmer: energy running down the trail */
    .rt-theme-tron2 .tr2-ribbonflow { stroke-dasharray: 14 10; animation: tr2-flow 0.8s linear infinite; }
    @keyframes tr2-spin { to { transform: rotate(360deg); } }
    @keyframes tr2-flow { to { stroke-dashoffset: -24; } }
    /* ribbon: the wall breathes and throws repeating energy sweeps away from the bike */
    .rt-theme-tron2 .tr2-ribbonwall { animation: tr2-breathe 2.8s ease-in-out infinite; }
    .rt-theme-tron2 .tr2-sweep { animation: tr2-sweep 1.6s linear infinite; }
    @keyframes tr2-breathe { 0%, 100% { opacity: .75; } 50% { opacity: 1; } }
    @keyframes tr2-sweep { 0% { transform: translateX(0); opacity: 0; } 12% { opacity: .9; } 80% { opacity: .35; } 100% { transform: translateX(var(--rlen)); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .rt-theme-tron2 .tr2-spin, .rt-theme-tron2 .tr2-ribbonwall, .rt-theme-tron2 .tr2-ribbonflow, .rt-theme-tron2 .tr2-sweep { animation: none; }
    }

    /* Track: the game-grid arena floor — black with receding white-cyan lines. */
    .rt-rails-tron2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.12); background: #02040a; }
    .rt-rails-tron2::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: calc(var(--rt-th) * 0.012);
      background: ${TUBE}; box-shadow: 0 0 calc(var(--rt-th) * 0.03) ${TUBE}, 0 0 calc(var(--rt-th) * 0.08) #7ee7ff77; }
    .rt-rails-tron2::after { content: ''; position: absolute; left: 0; right: 0; top: calc(var(--rt-th) * 0.012); bottom: 0;
      background:
        repeating-linear-gradient(90deg, #7ee7ff22 0 1.5px, transparent 1.5px calc(var(--rt-th) * 0.14)),
        linear-gradient(#7ee7ff18 1px, transparent 1px) 0 65% / 100% 35% no-repeat; }
  `);
}

export function buildTrack({ doc }) {
  const el = doc.createElement('div');
  el.className = 'rt-rails rt-rails-tron2';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((railY + WHEEL_R + 2 - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  return el;
}

/** Hubless wheel, Legacy-style: dark tyre edge, one WIDE glowing band with a
 *  white core line, empty centre, faint rotating energy ring. */
function hubless(cx, tint = TUBE) {
  const r = WHEEL_R;
  return `<circle cx="${cx}" cy="${railY}" r="${r + 2}" fill="none" stroke="#05070c" stroke-width="7"/>` +
    `<circle class="tr2-tube" cx="${cx}" cy="${railY}" r="${r - 4}" fill="none" stroke="${tint}" stroke-width="6" opacity=".95"/>` +
    `<circle class="tr2-corefill" cx="${cx}" cy="${railY}" r="${r - 4}" fill="none" stroke="${CORE}" stroke-width="1.5" style="filter:drop-shadow(0 0 3px ${tint})" stroke-opacity=".9" fill-opacity="0"/>` +
    `<g class="tr2-spin"><circle cx="${cx}" cy="${railY}" r="${r - 12}" fill="none" stroke="${tint}" stroke-width="1.25" stroke-dasharray="6 16" opacity=".5"/></g>`;
}

/** The ribbon: a continuous hard-light trail at hub height, running from under
 *  the bike all the way back across the gap — drawn BEHIND the machine so the
 *  bike appears to ride its own trail (film look). Constant brightness; only
 *  the caboose's tail end fades out. */
function ribbon(x1, len, fadeTail = false, tint = TUBE, gid = 0) {
  const top = railY - 26, bot = railY - 4;
  const body = fadeTail
    ? `<linearGradient id="tr2-f-${gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${tint}" stop-opacity="0.32"/><stop offset="1" stop-color="${tint}" stop-opacity="0"/></linearGradient><rect x="${x1}" y="${top}" width="${len}" height="${bot - top}" fill="url(#tr2-f-${gid})"/>` +
      `<rect x="${x1}" y="${top}" width="${len}" height="1.5" fill="url(#tr2-fade-core)"/>` +
      `<rect x="${x1}" y="${bot - 1.5}" width="${len}" height="1.5" fill="url(#tr2-fade-core)"/>`
    : `<rect x="${x1}" y="${top}" width="${len}" height="${bot - top}" fill="${tint}" opacity=".3"/>` +
      `<rect x="${x1}" y="${top}" width="${len}" height="1.5" fill="${tint}" opacity=".85"/>` +
      `<rect x="${x1}" y="${bot - 1.5}" width="${len}" height="1.5" fill="${tint}" opacity=".85"/>`;
  return `<g class="tr2-ribbon"><g class="tr2-ribbonwall">${body}</g>` +
    `<g class="tr2-sweep" style="--rlen:${len - 6}px"><rect x="${x1}" y="${top + 2}" width="5" height="${bot - top - 4}" rx="2.5" fill="${CORE}" opacity=".7" style="filter:blur(2.5px)"/></g></g>`;
}

/** One light cycle: the iconic enclosed-arc silhouette — one smooth dome from
 *  nose to tail with wheel cutouts (mask), the light line tracing the whole
 *  edge, and the rider's canopy visor carrying the avatar. */
function cycleUnit(x, w, v, i, opts = {}) {
  const { caboose = false, tint = TUBE } = opts;
  const fw = x + 36, rw = x + w - 36;
  let s = '';
  // trail as its own layer UNDER the filtered art group so the machine rides
  // on top of it: from the front wheel back across the coupler gap (caboose
  // gets a long fading tail instead). The ribbon breathes and sweeps, so it
  // must not sit inside .tr2-art — an animation under the glow drop-shadow
  // would re-raster the filter every frame.
  const trail = caboose ? ribbon(x + 14, w + GAP + 46, true, tint, i) : ribbon(x + 14, w + GAP - 12, false, tint, i);
  // ground reflection
  s += `<ellipse cx="${mid(x, w)}" cy="${railY + WHEEL_R + 2}" rx="${w * 0.44}" ry="4" fill="${tint}" opacity=".16" style="filter:blur(3px)"/>`;
  // low fuselage spar between the wheels, with glowing energy cell
  s += `<path d="M ${fw + 8} ${railY - 24} L ${rw - 10} ${railY - 26} L ${rw - 4} ${railY + 2} L ${fw + 14} ${railY + 4} Z" fill="${BODY}" stroke="${BODY_HI}" stroke-width="1.5"/>`;
  s += `<rect x="${x + Math.round(w * 0.42)}" y="${railY - 14}" width="20" height="11" rx="3" fill="#0b1420" stroke="${tint}" stroke-width="1.25"/>`;
  s += `<path class="tr2-tube" d="M ${x + Math.round(w * 0.42) + 3} ${railY - 11} h 14 M ${x + Math.round(w * 0.42) + 3} ${railY - 8} h 14 M ${x + Math.round(w * 0.42) + 3} ${railY - 5} h 14" stroke="#ffd23e" stroke-width="1.5" fill="none"/>`;
  // front prow: cowl hugging the front wheel, sweeping forward and down
  s += `<path d="M ${fw + 20} ${railY - 22} C ${fw + 16} ${railY - 42} ${fw - 12} ${railY - 46} ${fw - 27} ${railY - 30} C ${fw - 36} ${railY - 20} ${fw - 36} ${railY - 6} ${fw - 30} ${railY + 2} L ${fw - 21} ${railY - 2} C ${fw - 27} ${railY - 14} ${fw - 16} ${railY - 32} ${fw + 2} ${railY - 28} Z" fill="${BODY}" stroke="${BODY_HI}" stroke-width="1.5"/>`;
  s += `<path class="tr2-tube" d="M ${fw - 28} ${railY} C ${fw - 34} ${railY - 12} ${fw - 28} ${railY - 28} ${fw - 12} ${railY - 38}" fill="none" stroke="${tint}" stroke-width="2" stroke-linecap="round"/>`;
  // headlight on the prow
  s += `<circle class="tr2-corefill" cx="${fw - 26}" cy="${railY - 16}" r="2.5" fill="${CORE}"/>`;
  // rear cowl: fender sweeping from the tail over the rear wheel
  s += `<path d="M ${rw - 38} ${railY - 10} C ${rw - 34} ${railY - 38} ${rw - 6} ${railY - 50} ${rw + 18} ${railY - 36} C ${rw + 34} ${railY - 24} ${rw + 36} ${railY - 8} ${rw + 30} ${railY + 2} L ${rw + 20} ${railY - 2} C ${rw + 26} ${railY - 18} ${rw + 12} ${railY - 36} ${rw - 10} ${railY - 34} C ${rw - 24} ${railY - 32} ${rw - 30} ${railY - 20} ${rw - 28} ${railY - 6} Z" fill="${BODY}" stroke="${BODY_HI}" stroke-width="1.5"/>`;
  s += `<path class="tr2-tube" d="M ${rw - 34} ${railY - 8} C ${rw - 32} ${railY - 36} ${rw - 2} ${railY - 48} ${rw + 20} ${railY - 32}" fill="none" stroke="${tint}" stroke-width="2" stroke-linecap="round"/>`;
  // rider: prone silhouette — head forward, back flowing down into the tail
  const hx = fw + 38, hy = railY - 48;
  s += `<path d="M ${hx - 8} ${hy + 8} C ${hx + 10} ${hy - 8} ${hx + 28} ${hy - 4} ${hx + 40} ${hy + 4} C ${x + Math.round(w * 0.62)} ${railY - 44} ${rw - 38} ${railY - 40} ${rw - 20} ${railY - 28} L ${rw - 38} ${railY - 16} C ${rw - 52} ${railY - 28} ${x + Math.round(w * 0.55)} ${railY - 28} ${hx + 14} ${hy + 22} Z" fill="${BODY}" stroke="${BODY_HI}" stroke-width="1.5"/>`;
  // arm reaching forward-down to the bars
  s += `<path d="M ${hx + 2} ${hy + 14} L ${fw + 2} ${railY - 28}" stroke="${BODY}" stroke-width="8" stroke-linecap="round"/>`;
  // suit light line along the back
  s += `<path class="tr2-tube" d="M ${hx + 10} ${hy} C ${x + Math.round(w * 0.58)} ${railY - 48} ${rw - 44} ${railY - 44} ${rw - 26} ${railY - 30}" fill="none" stroke="${tint}" stroke-width="1.75" stroke-linecap="round"/>`;
  // helmet = the avatar, tucked low over the bars
  const r = 15;
  s += `<circle cx="${hx}" cy="${hy}" r="${r + 3}" fill="${BODY}"/>`;
  s += `<circle class="tr2-tube" cx="${hx}" cy="${hy}" r="${r + 3}" fill="none" stroke="${tint}" stroke-width="2" style="filter:drop-shadow(0 0 4px ${tint})"/>`;
  s += avatarSVG(`tr2-av-${i}`, hx, hy, r, v.image, v.name, BODY_HI);
  // HUD tag: name + time, grid-mono
  const cx = mid(x, w);
  s += `<text class="rt-fit tr2-name" data-maxw="${w - 30}" x="${cx}" y="46" text-anchor="middle" font-weight="700" font-size="15" letter-spacing="2.5" fill="${CORE}" font-family="'DM Mono', monospace" style="filter:drop-shadow(0 0 4px ${tint})">${esc(v.name)}</text>`;
  s += `<text class="tr2-time" x="${cx}" y="64" text-anchor="middle" font-size="10.5" letter-spacing="1.5" font-family="'DM Mono', monospace">${esc((v.timeLines ?? [''])[0] ?? '')}</text>`;
  // derez stamp
  const sy = railY + 14;
  s += `<g class="tr2-stamp"><rect x="${cx - 46}" y="${sy - 12}" width="92" height="24" rx="4" fill="#02040af0" stroke="#234450" stroke-width="1.5"/><text x="${cx}" y="${sy + 5}" text-anchor="middle" font-weight="700" font-size="12" fill="#4d7a8c" letter-spacing="4" font-family="'DM Mono', monospace">${esc(L('overlay.played'))}</text></g>`;
  const front = hubless(fw, tint) + hubless(rw, tint);
  return { body: s, trail, front, nowX: cx, nowY: 20 };
}

function openUnit(x, w, v) {
  const cx = mid(x, w);
  const baseY = railY + 8;
  const dome = `M ${x + 2} ${baseY} C ${x + 16} ${railY - 16} ${x + 54} ${railY - 28} ${x + 104} ${railY - 36} C ${x + 136} ${railY - 42} ${x + w - 52} ${railY - 54} ${x + w - 26} ${railY - 52} Q ${x + w - 8} ${railY - 50} ${x + w - 6} ${railY - 32} L ${x + w - 2} ${baseY} Z`;
  let s = `<path d="${dome}" fill="#0a1a1466" stroke="${COL.open}" stroke-width="2.5" stroke-dasharray="9 8"/>`;
  s += `<circle cx="${cx}" cy="${railY - 34}" r="16" fill="none" stroke="${COL.open}" stroke-width="2.5"/><text x="${cx}" y="${railY - 26}" text-anchor="middle" font-weight="700" font-size="24" fill="#9affd0">+</text>`;
  s += `<text class="rt-fit tr2-name" data-maxw="${w - 40}" x="${cx}" y="46" text-anchor="middle" font-weight="700" font-size="14" letter-spacing="3" fill="#9affd0" font-family="'DM Mono', monospace">${esc(L('overlay.open'))}</text>`;
  const t = v.timeLines?.[0] ? `${esc(L('overlay.signUp'))} · ${esc(v.timeLines[0])}` : esc(L('overlay.signUp'));
  s += `<text class="tr2-time" x="${cx}" y="64" text-anchor="middle" font-size="10.5" letter-spacing="1.5" fill="#8fe8c2" font-family="'DM Mono', monospace">${t}</text>`;
  return { body: s, front: '', nowX: cx, nowY: 20 };
}

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, state, dataAttr;
  if (unit.type === 'engine') {
    parts = cycleUnit(x, w, v, i, { tint: TINTS[0] });
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    dataAttr = ' data-engine="1"';
  } else if (v.isOpen) {
    parts = openUnit(x, w, v);
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = cycleUnit(x, w, v, i, { caboose: unit.type === 'caboose', tint: TINTS[i % TINTS.length] });
    state = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  const pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(parts.nowX, parts.nowY, COL.now, L('overlay.now'))}</g>`;
  return `<g class="rt-car${state}"${dataAttr}>${parts.trail ?? ''}<g class="tr2-art">${parts.body}</g>${parts.front}${pointer}</g>`;
}

export function build(train, opts = {}) {
  const { doc } = opts;
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const units = [];
  const hasEngine = vehicles[0]?.kind === 'engine';
  if (hasEngine) units.push({ type: 'engine', v: vehicles[0] });
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) units.push({ type: car.kind === 'open' ? 'open' : car.kind === 'caboose' ? 'caboose' : 'car', v: car });

  const xs = [];
  let acc = 0;
  for (const u of units) { xs.push(acc); acc += CYCLE_W + GAP; void u; }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => { body += renderUnit(u, xs[i], CYCLE_W, i); });

  const holder = doc.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-tron2" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:0.35">` +
    `<defs>` +
    `<linearGradient id="tr2-fade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${TUBE}" stop-opacity="0.32"/><stop offset="1" stop-color="${TUBE}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="tr2-fade-core" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${CORE}" stop-opacity="0.85"/><stop offset="1" stop-color="${CORE}" stop-opacity="0"/></linearGradient>` +
    `</defs>${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.tr2-time') }; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.tr2-time') });
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

/** Floor = wheel bottom (railY + WHEEL_R + rim stroke). */
export const foot = (railY + WHEEL_R + 4 - VIEW_TOP) / VIEW_H;

export default { key: 'tron', ensureStyles, build, buildTrack, foot };
