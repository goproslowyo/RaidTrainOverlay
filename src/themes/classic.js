/**
 * classic — Classic Americana Theme. Ported from the original art
 * mockup, wired to the live Train view-model.
 *
 *  - viewBox only (no width/height) so CSS --train-height sizes it.
 *  - The locomotive shows the FIRST streamer, with their live state:
 *    the Now Marker during their Slot, Spotlight glow, and the post-event dim
 *    (enginedim) — it stays bright after their slot (eternal leader). The
 *    Organiser rides the tender right behind it (a coal-car credit, prototype C+E).
 *  - Car state is toggleable classes (rt-car--current / --departed / --spotlit) so
 *    Now + Spotlight coexist and a time tick updates in place. A departed
 *    Slot is lightly dimmed and stamped PLAYED (legibility — viewer feedback).
 *  - Glows use CSS drop-shadow over the static .cl-art group; wheels/smoke ride a
 *    sibling .cl-front layer, so a lit Car's filter bitmap is cached and the
 *    animations never re-trigger it (memory `theme-rendering-constraints`).
 *
 * Transparent only — no full-bleed background.
 */
import { SVG_NS, esc, wheel, smokeSVG, pointerSVG, avatarSVG, fitAll, undulate, toVehicles } from './shared-svg.js';

const ENG = 256;
const CAR = 200;
const TENDER = 158;
const GAP = 6;
const railY = 206;
const VIEW_TOP = -10;
const VIEW_BOTTOM = 250;
const TIME_LH = 12;
const COL = { now: '#fbbf24', spot: '#22d3ee', open: '#37b24d', org: '#caa24a' };
const STYLE_ID = 'rt-theme-classic-style';

const RAIL_HEAD = railY + 10;
const RAIL_BAND = 24;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;

const centerX = (x, w) => x + w / 2;

export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* A handed-off Slot stays readable — a light dim + a PLAYED stamp, not heavy
       shade (viewer feedback): names/avatars must still read. */
    .rt-theme-classic .rt-car--departed { opacity: 0.82; }
    .rt-theme-classic .rt-car--departed image { filter: saturate(0.55); }
    .rt-theme-classic .cl-stamp { visibility: hidden; }
    .rt-theme-classic .rt-car--departed .cl-stamp { visibility: visible; }

    .rt-theme-classic .rt-car--current .cl-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 9px ${COL.now}); }
    .rt-theme-classic .rt-car--spotlit .cl-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-classic .rt-car--current.rt-car--spotlit .cl-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }

    /* Stationary steel Track. */
    .rt-rails-classic { top: var(--rt-rail-top); height: var(--rt-rail-h); }
    .rt-rails-classic::before, .rt-rails-classic::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-classic::before { top: 0; height: calc(var(--rt-th) * 0.021); background: #9aa3ad; box-shadow: 0 -1px 0 #cfd6dd; }
    .rt-rails-classic::after {
      top: calc(var(--rt-th) * 0.021); bottom: 0;
      background: repeating-linear-gradient(90deg, #6b4423 0 calc(var(--rt-th) * 0.047), transparent calc(var(--rt-th) * 0.047) calc(var(--rt-th) * 0.102));
    }
  `;
  document.head.appendChild(style);
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-classic';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((RAIL_HEAD - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  el.style.setProperty('--rt-rail-h', `calc(var(--rt-th) * ${(RAIL_BAND / VIEW_H).toFixed(4)})`);
  return el;
}

/** Bottom-anchored stacked time lines (1 line for relative, up to 3 for tz). */
function timeTspans(lines, x, baseY) {
  return lines
    .map((line, i) => `<tspan x="${x}" y="${baseY - (lines.length - 1 - i) * TIME_LH}">${esc(line)}</tspan>`)
    .join('');
}

/** Rewrite a .cl-time block in place on a time tick — text only, no structure. */
function setTimeLines(timeText, lines) {
  const x = timeText.getAttribute('x');
  const baseY = Number(timeText.getAttribute('y'));
  timeText.replaceChildren();
  lines.forEach((line, i) => {
    const tspan = document.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', x);
    tspan.setAttribute('y', String(baseY - (lines.length - 1 - i) * TIME_LH));
    tspan.textContent = line;
    timeText.appendChild(tspan);
  });
}

// Each vehicle builder returns { body, front }: `body` is the static art the glow
// filters (cached); `front` is the animating wheel/smoke layer, outside the glow.

function classicEngine(x, v, i) {
  const wy = railY + 14;
  // STATIC body (cl-art) — glow-filtered when the loco is current / spotlit.
  let s = `<rect x="${x + 14}" y="${railY}" width="226" height="12" rx="3" fill="#7a1414"/>`;
  s += `<path d="M ${x + 16} ${railY} L ${x + 16} ${wy + 10} L ${x - 18} ${wy + 16} L ${x - 18} ${railY + 2} Z" fill="#c92a2a" stroke="#7a1414" stroke-width="2"/>`;
  for (let k = 0; k < 6; k++) s += `<line x1="${x + 14 - k * 5.5}" y1="${railY + 2}" x2="${x + 6 - k * 5.5}" y2="${wy + 14}" stroke="#7a1414" stroke-width="2"/>`;
  s += `<rect x="${x + 40}" y="${railY - 58}" width="150" height="62" rx="31" fill="#1c1c1c"/><rect x="${x + 40}" y="${railY - 18}" width="150" height="22" fill="#1c1c1c"/>`;
  s += `<circle cx="${x + 40}" cy="${railY - 27}" r="31" fill="#262626" stroke="#3a3a3a" stroke-width="2"/><circle cx="${x + 40}" cy="${railY - 27}" r="9" fill="#3a3a3a"/>`;
  s += `<rect x="${x + 18}" y="${railY - 44}" width="18" height="20" rx="3" fill="#f1b40a" stroke="#7a1414" stroke-width="2"/>`;
  for (let b = 0; b < 4; b++) s += `<rect x="${x + 62 + b * 30}" y="${railY - 58}" width="3" height="62" fill="#f1b40a" opacity="0.85"/>`;
  s += `<path d="M ${x + 52} ${railY - 58} L ${x + 48} ${railY - 96} L ${x + 76} ${railY - 96} L ${x + 72} ${railY - 58} Z" fill="#111"/><rect x="${x + 45}" y="${railY - 104}" width="34" height="10" rx="3" fill="#111"/>`;
  s += `<rect x="${x + 96}" y="${railY - 76}" width="24" height="22" rx="11" fill="#f1b40a"/><rect x="${x + 130}" y="${railY - 74}" width="20" height="20" rx="10" fill="#c92a2a"/>`;
  s += `<rect x="${x + 176}" y="${railY - 70}" width="60" height="70" rx="6" fill="#c92a2a" stroke="#7a1414" stroke-width="3"/><rect x="${x + 172}" y="${railY - 78}" width="68" height="12" rx="4" fill="#111"/>`;
  s += `<rect x="${x + 182}" y="${railY - 65}" width="48" height="48" rx="6" fill="#10243f" stroke="#f1b40a" stroke-width="2"/>`;
  s += avatarSVG(`cl-av-${i}`, x + 206, railY - 41, 19, v.image, v.name, '#f1b40a');  // the driver, in the cab window
  // Plate: the first streamer's name + their time (NOW during their slot), centred
  // under the avatar so the two read as one unit (like the coaches).
  const pw = 92;
  const cx = x + 128;
  const px = cx - pw / 2;
  const py = railY - 16;
  const timeBaseY = py + 24;
  s += `<rect x="${px}" y="${py}" width="${pw}" height="28" rx="6" fill="#1c1c1c" stroke="#f1b40a" stroke-width="2"/>`;
  s += `<text class="rt-fit" data-maxw="${pw - 10}" x="${cx}" y="${py + 13}" text-anchor="middle" font-weight="800" font-size="14" fill="#f1b40a">${esc(v.name)}</text>`;
  s += `<text class="cl-time" x="${cx}" y="${timeBaseY}" text-anchor="middle" font-weight="700" font-size="11" fill="#e9c46a">${timeTspans(v.timeLines ?? [''], cx, timeBaseY)}</text>`;
  // BACK (animating, behind the body): the big driving wheels — the boiler/frame
  // covers their tops so they peek out below and never block the avatar or plate.
  const back = wheel(x + 78, wy, 26, '#c92a2a', 6, '#5e0d0d') + wheel(x + 128, wy, 26, '#c92a2a', 6, '#5e0d0d') + wheel(x + 178, wy, 26, '#c92a2a', 6, '#5e0d0d')
    + wheel(x + 14, wy + 8, 13, '#c92a2a', 5, '#5e0d0d') + wheel(x + 38, wy + 8, 13, '#c92a2a', 5, '#5e0d0d');
  // FRONT (animating, outside the glow): smoke, above the funnel.
  const front = smokeSVG(x + 58, railY - 96, 1.25);
  return { back, body: s, front };
}

/** The Organiser's tender — a coal-car credit coupled behind the loco. */
function classicTender(x, w, org) {
  const wy = railY + 14;
  const bodyTop = railY - 78;
  const cx = centerX(x, w);
  let s = `<rect x="${x - 8}" y="${railY - 6}" width="16" height="9" rx="4" fill="#4b5563"/>`; // coupler to loco
  s += `<rect x="${x + 6}" y="${railY}" width="${w - 12}" height="10" rx="2" fill="#5e0d0d"/>`;
  s += `<rect x="${x + 8}" y="${bodyTop}" width="${w - 16}" height="78" rx="6" fill="#241a14" stroke="${COL.org}" stroke-width="2"/>`;
  s += `<rect x="${x + 8}" y="${bodyTop}" width="${w - 16}" height="12" rx="6" fill="#1c1c1c"/>`;
  for (let k = 0; k < 5; k++) s += `<circle cx="${x + 22 + k * ((w - 44) / 4)}" cy="${bodyTop + 6}" r="4" fill="#3a3a3a"/>`; // coal
  // Avatar top-left with the "ORGANISED BY" label beside it; the name gets its OWN
  // full-width line below so even a long handle fits (rt-fit condenses if needed).
  s += avatarSVG('cl-org', x + 32, bodyTop + 36, 19, org.image, org.name, COL.org);
  s += `<text x="${x + 60}" y="${bodyTop + 31}" font-weight="800" font-size="10" fill="#e9c46a" letter-spacing="1.5">ORGANISED</text>`;
  s += `<text x="${x + 60}" y="${bodyTop + 45}" font-weight="800" font-size="10" fill="#e9c46a" letter-spacing="1.5">BY</text>`;
  s += `<text class="rt-fit" data-maxw="${w - 22}" x="${cx}" y="${bodyTop + 69}" text-anchor="middle" font-weight="800" font-size="15" fill="#f1b40a">${esc(org.name)}</text>`;
  const front = wheel(x + 34, wy, 16, '#c92a2a', 6, '#5e0d0d') + wheel(x + w - 34, wy, 16, '#c92a2a', 6, '#5e0d0d');
  return { body: s, front };
}

function classicCoach(x, w, v, i, maxTimeLines, caboose) {
  const wy = railY + 14;
  const bodyTop = railY - 88;
  let s = `<rect x="${x + 6}" y="${railY}" width="${w - 12}" height="10" rx="2" fill="#7a1414"/>`;
  s += `<rect x="${x + 10}" y="${bodyTop}" width="${w - 20}" height="88" rx="8" fill="#c92a2a" stroke="#7a1414" stroke-width="2"/>`;
  s += `<rect x="${x + 4}" y="${bodyTop - 12}" width="${w - 8}" height="14" rx="6" fill="#1c1c1c"/><rect x="${x + 28}" y="${bodyTop - 20}" width="${w - 56}" height="12" rx="5" fill="#262626"/>`;
  if (caboose) s += `<rect x="${centerX(x, w) - 22}" y="${bodyTop - 44}" width="44" height="26" rx="4" fill="#7a1414" stroke="#111" stroke-width="2"/><rect x="${centerX(x, w) - 14}" y="${bodyTop - 38}" width="28" height="13" fill="#10243f"/>`;
  for (const wx of [x + 22, x + w - 42]) s += `<rect x="${wx}" y="${bodyTop + 14}" width="20" height="24" rx="3" fill="#fde9c8" stroke="#f1b40a" stroke-width="2"/>`;
  const extra = maxTimeLines - 1;
  const avR = extra === 0 ? 25 : 22 - extra * 3;
  const avCy = bodyTop + 26 - extra * 9;
  s += avatarSVG(`cl-av-${i}`, centerX(x, w), avCy, avR, v.image, v.name, '#f1b40a');
  const pw = w - 40;
  const px = x + 20;
  const cx = px + pw / 2;
  const timeBaseY = railY - 6;
  const nameY = timeBaseY - extra * TIME_LH - 14;
  const plateTop = nameY - 13;
  const plateH = timeBaseY + 7 - plateTop;
  s += `<rect x="${px}" y="${plateTop}" width="${pw}" height="${plateH}" rx="6" fill="#1c1c1c" stroke="#f1b40a" stroke-width="2"/>`;
  s += `<text class="rt-fit" data-maxw="${pw - 10}" x="${cx}" y="${nameY}" text-anchor="middle" font-weight="800" font-size="14" fill="#f1b40a">${esc(v.name)}</text>`;
  s += `<text class="cl-time" x="${cx}" y="${timeBaseY}" text-anchor="middle" font-weight="700" font-size="11" fill="#e9c46a">${timeTspans(v.timeLines, cx, timeBaseY)}</text>`;
  // PLAYED stamp — hidden until the Slot has departed (revealed by CSS). Light ink
  // on a translucent backing so it reads over the red body or any scene; sits low
  // on the body, angled across it.
  const sx = centerX(x, w);
  const sy = railY - 44;
  s += `<g class="cl-stamp" transform="rotate(-9 ${sx} ${sy})"><rect x="${sx - 40}" y="${sy - 15}" width="80" height="30" rx="4" fill="#2a0a0a" opacity="0.66" stroke="#ff9a9a" stroke-width="2.5"/><text x="${sx}" y="${sy + 6}" text-anchor="middle" font-weight="800" font-size="16" fill="#ffd0d0" letter-spacing="2">PLAYED</text></g>`;
  const front = [x + 34, x + 64, x + w - 64, x + w - 34]
    .map((cxw) => wheel(cxw, wy, 16, '#c92a2a', 6, '#5e0d0d')).join('');
  return { body: s, front };
}

function classicOpen(x, w, v) {
  const wy = railY + 14;
  const bodyTop = railY - 60;
  const cx = centerX(x, w);
  let s = `<rect x="${x + 6}" y="${railY}" width="${w - 12}" height="10" rx="2" fill="#7a1414"/>`;
  s += `<rect x="${x + 10}" y="${bodyTop}" width="${w - 20}" height="60" rx="8" fill="none" stroke="${COL.open}" stroke-width="4" stroke-dasharray="11 7"/>`;
  s += `<text x="${cx}" y="${bodyTop + 26}" text-anchor="middle" font-weight="800" font-size="24" fill="${COL.open}">OPEN</text>`;
  s += `<text x="${cx}" y="${bodyTop + 43}" text-anchor="middle" font-weight="700" font-size="11" fill="${COL.open}">sign up!</text>`;
  s += `<text class="cl-time" x="${cx}" y="${bodyTop + 55}" text-anchor="middle" font-weight="700" font-size="11" fill="${COL.open}">${timeTspans(v.timeLines, cx, bodyTop + 55)}</text>`;
  const front = [x + 34, x + 64, x + w - 64, x + w - 34]
    .map((cxw) => wheel(cxw, wy, 16, '#2f2f2f', 6, '#cfd6dd')).join('');
  return { body: s, front };
}

/** Wrap one unit's art in a state-bearing group (+ Now pointer where it applies). */
function renderUnit(unit, x, w, i, maxTimeLines) {
  const v = unit.v;
  let parts;
  let stateClasses;
  let pointer = '';
  let dataSlot = '';
  if (unit.type === 'engine') {
    parts = classicEngine(x, v, i);
    // The loco dims only post-event (isDimmed), never on its streamer's per-slot
    // departed — it stays bright as the eternal leader.
    stateClasses =
      (v.isCurrent ? ' rt-car--current' : '') +
      (v.isSpotlit ? ' rt-car--spotlit' : '') +
      (v.isDimmed ? ' rt-car--departed' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(centerX(x, w), 44, COL.now, 'NOW')}</g>`;
    dataSlot = ' data-engine="1"';
  } else if (unit.type === 'tender') {
    parts = classicTender(x, w, v);
    stateClasses = '';
    dataSlot = ' data-tender="1"';
  } else if (v.isOpen) {
    parts = classicOpen(x, w, v);
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(centerX(x, w), 44, COL.now, 'NOW')}</g>`;
    dataSlot = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = classicCoach(x, w, v, i, maxTimeLines, unit.type === 'caboose');
    stateClasses =
      (v.isCurrent ? ' rt-car--current' : '') +
      (v.isDeparted ? ' rt-car--departed' : '') +
      (v.isSpotlit ? ' rt-car--spotlit' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(centerX(x, w), 44, COL.now, 'NOW')}</g>`;
    dataSlot = ` data-slot="${v.slotOrder}"`;
  }
  // cl-back (e.g. the loco's driving wheels) renders behind the body; cl-front
  // (coach wheels, loco smoke) in front. Both are siblings of the glowed .cl-art.
  return `<g class="rt-car${stateClasses}"${dataSlot}><g class="cl-front">${parts.back || ''}</g><g class="cl-art">${parts.body}</g><g class="cl-front">${parts.front}</g>${pointer}</g>`;
}

export function build(train, opts = {}) {
  const maxTimeLines = opts.maxTimeLines || 1;
  const vehicles = toVehicles(train);

  // Layout units: engine, then the Organiser tender (when the loco isn't already
  // the Organiser fallback), then the Cars.
  const units = [];
  const engine = vehicles[0];
  units.push({ type: 'engine', v: engine });
  if (engine?.organiser) units.push({ type: 'tender', v: engine.organiser });
  for (const car of vehicles.slice(1)) {
    units.push({ type: car.kind === 'open' ? 'open' : car.kind === 'caboose' ? 'caboose' : 'car', v: car });
  }

  const widthFor = (u) => (u.type === 'engine' ? ENG : u.type === 'tender' ? TENDER : CAR);
  const xs = [];
  let acc = 0;
  for (const u of units) {
    xs.push(acc);
    acc += widthFor(u) + GAP;
  }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => {
    body += renderUnit(u, xs[i], widthFor(u), i, maxTimeLines);
  });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-classic" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_BOTTOM - VIEW_TOP}" role="img">${body}</svg>`;
  const svg = holder.firstElementChild;

  // Refs: Cars keyed by slotOrder; the Engine + tender tracked for post-event dim.
  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) {
      engineRef = { group, timeText: group.querySelector('.cl-time') };
      return;
    }
    if (group.dataset.tender) {
      tenderEls.push(group);
      return;
    }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.cl-time') });
  });

  return {
    node: svg,
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          ref.group.classList.toggle('rt-car--current', car.isCurrent);
          ref.group.classList.toggle('rt-car--departed', car.isDeparted);
          ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
          if (ref.timeText) setTimeLines(ref.timeText, car.timeLines ?? [car.relativeTime]);
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
    afterAttach() {
      fitAll(svg);
      undulate(svg);
    },
  };
}

export default { key: 'classic', ensureStyles, build, buildTrack };
