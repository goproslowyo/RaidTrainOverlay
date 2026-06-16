/**
 * paper — Construction-paper cut-out Theme. A handmade paper-craft
 * diorama: cut-paper Cars in warm construction-paper tints, each lifted off the
 * canvas with a soft drop-shadow (the layered look), polaroid photos held on with
 * washi tape, a cut-paper steam locomotive, and handwritten labels. Rebuilt as an
 * SVG Theme (like classic/flat/comic) so the cut-paper shapes + shadows stay crisp.
 *
 *  - viewBox only (no width/height) so CSS --train-height sizes it.
 *  - The locomotive shows the FIRST streamer; it stays bright after their
 *    slot (eternal leader), dims only post-event. The Organiser rides the tender; a
 *    departed Slot is lightly dimmed and stamped PLAYED.
 *  - State rides the shared rt-car--current/--departed/--spotlit classes; the soft
 *    paper shadow + the Now/Spotlight glow are CSS drop-shadows over the static
 *    .pp-art group, wheels/smoke in a sibling layer (memory `theme-rendering-constraints`).
 *
 * Transparent only — no full-bleed background.
 */
import { esc, wheel, smokeSVG, pointerSVG, avatarSVG, fitAll, undulate, toVehicles } from './shared-svg.js';

const ENGINE_W = 206;
const CAR_W = 172;
const TENDER_W = 142;
const GAP = 12;
const railY = 178;
const VIEW_TOP = -14;
const VIEW_BOTTOM = 200;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const COL = { now: '#fbbf24', spot: '#22d3ee', open: '#2f9e44' };
const TINTS = ['#ef7d57', '#f4b942', '#3fa7a0', '#e0566f', '#6d7fd6', '#9c6ade'];
const ENG_TINT = '#ef7d57';
const INK = '#5a4632';            // handwritten ink / paper-edge brown
const STYLE_ID = 'rt-theme-paper-style';
const FONT = "'Baloo 2', 'Comic Sans MS', system-ui, sans-serif";
const centerX = (x, w) => x + w / 2;

export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Every paper Car floats with a soft drop-shadow (the cut-paper lift). */
    .rt-theme-paper .pp-art { filter: drop-shadow(0 3px 2px #00000040); }
    .rt-theme-paper .rt-car--departed { opacity: 0.84; }
    .rt-theme-paper .rt-car--departed image { filter: saturate(0.5); }
    .rt-theme-paper .pp-stamp { visibility: hidden; }
    .rt-theme-paper .rt-car--departed .pp-stamp { visibility: visible; }
    .rt-theme-paper .rt-car--current .pp-art { filter: drop-shadow(0 3px 2px #00000040) drop-shadow(0 0 5px ${COL.now}) drop-shadow(0 0 9px ${COL.now}); }
    .rt-theme-paper .rt-car--spotlit .pp-art { filter: drop-shadow(0 3px 2px #00000040) drop-shadow(0 0 5px ${COL.spot}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-paper .rt-car--current.rt-car--spotlit .pp-art { filter: drop-shadow(0 3px 2px #00000040) drop-shadow(0 0 5px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }
    /* Soft paper-strip Track. */
    .rt-rails-paper { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.05); }
    .rt-rails-paper::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: calc(var(--rt-th) * 0.03);
      background: #caa06a; border-radius: calc(var(--rt-th) * 0.015); box-shadow: 0 calc(var(--rt-th) * 0.02) 0 calc(var(--rt-th) * -0.006) #00000022; }
  `;
  document.head.appendChild(style);
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-paper';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((railY + 2 - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  return el;
}

/** A cut-paper rounded rect with a subtly torn (deckled) top edge — paper, not a box. */
function paperPiece(x, y, w, h, fill) {
  const steps = Math.max(4, Math.round(w / 16));
  let d = `M ${x} ${y + 5}`;
  for (let k = 1; k <= steps; k++) {
    const px = x + (w * k) / steps;
    d += ` Q ${(px - w / steps / 2).toFixed(1)} ${y + (k % 2 ? 0 : 6)} ${px.toFixed(1)} ${y + (k % 2 ? 5 : 2)}`;
  }
  d += ` L ${x + w} ${y + h - 6} Q ${x + w} ${y + h} ${x + w - 6} ${y + h} L ${x + 6} ${y + h} Q ${x} ${y + h} ${x} ${y + h - 6} Z`;
  return `<path d="${d}" fill="${fill}"/>`;
}

/** A polaroid: a white paper frame (slightly tilted) around the circular photo, with
 *  a strip of washi tape over the top. */
function polaroid(id, cx, cy, r, image, name, tilt, tape) {
  const fw = r + 7;
  return `<g transform="rotate(${tilt} ${cx} ${cy})">` +
    `<rect x="${cx - fw}" y="${cy - fw}" width="${fw * 2}" height="${fw * 2 + 7}" rx="3" fill="#fff"/>` +
    avatarSVG(id, cx, cy, r, image, name, '#fff') +
    `<rect x="${cx - 14}" y="${cy - fw - 5}" width="28" height="11" rx="1" fill="${tape}" opacity="0.9" transform="rotate(-6 ${cx} ${cy - fw})"/>` +
    `</g>`;
}

const handLabel = (x, y, w, name, maxw, size = 15) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${size + 8}" rx="3" fill="#fffdf5"/>` +
  `<text class="rt-fit" data-maxw="${maxw}" x="${x + w / 2}" y="${y + size + 1}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="${size}" fill="${INK}">${esc(name)}</text>`;

// Each builder returns { body, front }: static cut-paper art + animating wheel/smoke.

function paperEngine(x, v, i) {
  const by = 108, bh = 50;
  let s = `<path d="M ${x + 2} ${railY - 4} L ${x + 26} ${railY - 26} L ${x + 26} ${railY - 4} Z" fill="${INK}"/>`; // paper cowcatcher
  s += paperPiece(x + 148, by - 22, 52, bh + 26, ENG_TINT);                                                       // cab
  s += `<rect x="${x + 158}" y="${by - 4}" width="32" height="26" rx="3" fill="#fff7e8"/>`;                       // cab window (paper)
  s += paperPiece(x + 14, by, 142, bh, ENG_TINT);                                                                 // boiler
  s += `<path d="M ${x + 66} ${by + 2} L ${x + 90} ${by + 2} L ${x + 94} ${by - 26} L ${x + 62} ${by - 26} Z" fill="${INK}"/><rect x="${x + 58}" y="${by - 32}" width="40" height="8" rx="3" fill="${INK}"/>`; // funnel
  s += `<path d="M ${x + 106} ${by + 1} A 13 12 0 0 1 ${x + 132} ${by + 1} Z" fill="#fde9c8"/>`;                  // dome
  // Polaroid of the streamer in the cab window — the driver.
  s += polaroid(`pp-av-${i}`, x + 174, by + 8, 16, v.image, v.name, -3, '#86d9d3cc');
  s += handLabel(x + 74, by + 16, 70, v.name, 60, 14);
  const timeBaseY = railY - 28;
  s += `<text class="pp-time" data-base-y="${timeBaseY}" x="${x + 109}" y="${timeBaseY}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="11" fill="${INK}">${(v.timeLines ?? [''])[0] ?? ''}</text>`;
  const front = smokeSVG(x + 78, by - 38, 1.1)
    + paperWheel(x + 34, railY, 11) + paperWheel(x + 70, railY, 17) + paperWheel(x + 116, railY, 17) + paperWheel(x + 170, railY, 13);
  return { body: s, front };
}

function paperWheel(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy + 1}" r="${r}" fill="#00000018"/>` + wheel(cx, cy, r, '#6b4a22', 6, '#caa06a');
}

function paperCoach(x, w, v, i, caboose) {
  const tilt = i % 2 ? 1.4 : -1.4;
  const tint = caboose ? TINTS[(i + 2) % TINTS.length] : TINTS[i % TINTS.length];
  const tape = ['#86d9d3cc', '#f4b09acc', '#a6c8f0cc'][i % 3];
  let s = i > 0 ? `<rect x="${x - GAP - 2}" y="${railY - 40}" width="${GAP + 6}" height="8" rx="4" fill="#caa06a"/>` : '';
  s += `<g transform="rotate(${tilt} ${centerX(x, w)} 132)">`;
  s += paperPiece(x + 8, 90, w - 16, 84, tint);
  s += polaroid(`pp-av-${i}`, x + 42, 126, 27, v.image, v.name, i % 2 ? 3 : -2, tape);
  s += handLabel(x + 80, 110, w - 92, v.name, w - 104, 15);
  const timeBaseY = 158;
  s += `<text class="pp-time" data-base-y="${timeBaseY}" x="${x + 80 + (w - 92) / 2}" y="${timeBaseY}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="12" fill="${INK}">${(v.timeLines ?? [''])[0] ?? ''}</text>`;
  const sx = centerX(x, w), sy = 150;
  s += `<g class="pp-stamp" transform="rotate(-8 ${sx} ${sy})"><rect x="${sx - 38}" y="${sy - 14}" width="76" height="28" rx="3" fill="#fff7ec" stroke="#b23a2a" stroke-width="2.5"/><text x="${sx}" y="${sy + 6}" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="15" fill="#b23a2a" letter-spacing="2">PLAYED</text></g>`;
  s += `</g>`;
  const front = paperWheel(x + 44, railY, 15) + paperWheel(x + w - 44, railY, 15);
  return { body: s, front };
}

function paperTender(x, w, org) {
  const cx = centerX(x, w);
  let s = `<rect x="${x - GAP - 2}" y="${railY - 40}" width="${GAP + 6}" height="8" rx="4" fill="#caa06a"/>`;
  s += `<g transform="rotate(-1 ${cx} 132)">`;
  s += paperPiece(x + 8, 98, w - 16, 76, '#d8b98a');
  s += polaroid('pp-org', x + 38, 132, 20, org.image, org.name, -3, '#f4b09acc');
  s += `<text x="${x + 66}" y="124" font-family="${FONT}" font-weight="800" font-size="10" fill="#6b4a22" letter-spacing="1">ORGANISED BY</text>`;
  s += handLabel(x + 64, 134, w - 78, org.name, w - 92, 15);
  s += `</g>`;
  const front = paperWheel(x + 40, railY, 14) + paperWheel(x + w - 40, railY, 14);
  return { body: s, front };
}

function paperOpen(x, w, v, i) {
  const cx = centerX(x, w);
  let s = i > 0 ? `<rect x="${x - GAP - 2}" y="${railY - 40}" width="${GAP + 6}" height="8" rx="4" fill="#caa06a"/>` : '';
  s += `<rect x="${x + 10}" y="92" width="${w - 20}" height="80" rx="8" fill="#eafff0" stroke="${COL.open}" stroke-width="3" stroke-dasharray="9 7"/>`;
  s += `<text x="${cx}" y="130" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="30" fill="${COL.open}">OPEN</text>`;
  const openTime = v.timeLines[0] ? `cut me in! · ${esc(v.timeLines[0])}` : 'cut me in!';
  s += `<text class="pp-time" data-base-y="152" x="${cx}" y="152" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="12" fill="${COL.open}">${openTime}</text>`;
  const front = paperWheel(x + 46, railY, 15) + paperWheel(x + w - 46, railY, 15);
  return { body: s, front };
}

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, stateClasses, pointer = '', dataAttr;
  if (unit.type === 'engine') {
    parts = paperEngine(x, v, i);
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(x + 42, 56, COL.now, 'NOW')}</g>`;
    dataAttr = ' data-engine="1"';
  } else if (unit.type === 'tender') {
    parts = paperTender(x, w, v);
    stateClasses = '';
    dataAttr = ' data-tender="1"';
  } else if (v.isOpen) {
    parts = paperOpen(x, w, v, i);
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(centerX(x, w), 56, COL.now, 'NOW')}</g>`;
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = paperCoach(x, w, v, i, unit.type === 'caboose');
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    pointer = `<g class="rt-pointer rt-now-bob">${pointerSVG(x + 42, 54, COL.now, 'NOW')}</g>`;
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  return `<g class="rt-car${stateClasses}"${dataAttr}><g class="pp-art">${parts.body}</g><g class="pp-front">${parts.front}</g>${pointer}</g>`;
}

export function build(train) {
  const vehicles = toVehicles(train);
  const units = [];
  const engine = vehicles[0];
  units.push({ type: 'engine', v: engine });
  if (engine?.organiser) units.push({ type: 'tender', v: engine.organiser });
  for (const car of vehicles.slice(1)) units.push({ type: car.kind === 'open' ? 'open' : car.kind === 'caboose' ? 'caboose' : 'car', v: car });

  const widthFor = (u) => (u.type === 'engine' ? ENGINE_W : u.type === 'tender' ? TENDER_W : CAR_W);
  const xs = [];
  let acc = 0;
  for (const u of units) { xs.push(acc); acc += widthFor(u) + GAP; }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => { body += renderUnit(u, xs[i], widthFor(u), i); });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-paper" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img">${body}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.pp-time') }; return; }
    if (group.dataset.tender) { tenderEls.push(group); return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.pp-time') });
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
      for (const el of tenderEls) el.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
    },
    afterAttach() { fitAll(svg); undulate(svg); },
  };
}

export default { key: 'paper', ensureStyles, build, buildTrack };
