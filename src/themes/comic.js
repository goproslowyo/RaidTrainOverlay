/**
 * comic — Comic-book Theme. A bold inked comic-strip train: heavy black
 * outlines, Ben-Day halftone shading, hard offset drop-shadows, a chunky steam
 * engine with a POOF! smoke cloud, speech-bubble names, and a NOW! star-burst.
 * Rebuilt as an SVG Theme (like classic/flat) so the inked linework is crisp at any
 * size. Wired to the live Train view-model:
 *
 *  - viewBox only (no width/height) so CSS --train-height sizes it.
 *  - The locomotive shows the FIRST streamer, with their live state (NOW!
 *    burst + Spotlight glow during their Slot, post-event dim) — bright eternal
 *    leader otherwise. The Organiser rides the tender; a departed Slot is lightly
 *    dimmed and stamped PLAYED.
 *  - State rides the shared rt-car--current/--departed/--spotlit classes; the glow is
 *    a CSS drop-shadow over the static .cm-art group, wheels/smoke in a sibling layer
 *    (memory `theme-rendering-constraints`).
 *
 * Transparent only — no full-bleed background.
 */
import { esc, wheel, pointerSVG, avatarSVG, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

// The translator the builders paint with: rebound to the active locale at the
// top of build() (themeT reads config.t), English until then.
let L = themeT();

const ENGINE_W = 200;
const CAR_W = 168;
const TENDER_W = 142;
const GAP = 16;            // room for the hard offset shadow between Cars
const railY = 176;
const VIEW_TOP = -16;
const VIEW_BOTTOM = 200;
const VIEW_H = VIEW_BOTTOM - VIEW_TOP;
const INK = '#111';
const TINTS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ffa94d', '#3bc9db'];
const COL = { now: '#fbbf24', spot: '#22d3ee', open: '#37b24d' };
const STYLE_ID = 'rt-theme-comic-style';
const centerX = (x, w) => x + w / 2;

export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-comic .rt-car--departed { opacity: 0.84; }
    .rt-theme-comic .rt-car--departed .cm-body { filter: grayscale(0.5) contrast(0.95); }
    .rt-theme-comic .cm-stamp { visibility: hidden; }
    .rt-theme-comic .rt-car--departed .cm-stamp { visibility: visible; }
    .rt-theme-comic .cm-spark { visibility: hidden; }
    .rt-theme-comic .rt-car--spotlit .cm-spark { visibility: visible; }
    .rt-theme-comic .rt-car--current .cm-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 9px ${COL.now}); }
    .rt-theme-comic .rt-car--spotlit .cm-art { filter: drop-shadow(0 0 4px ${COL.spot}) drop-shadow(0 0 9px ${COL.spot}); }
    .rt-theme-comic .rt-car--current.rt-car--spotlit .cm-art { filter: drop-shadow(0 0 4px ${COL.now}) drop-shadow(0 0 8px ${COL.spot}); }

    /* Comic sound effects (POW! BAM! …) that pop in and out at staggered times over
       the Train — compositor-only (transform/opacity), disabled under reduced-motion.
       The scale rides the outer .cm-pow; each effect's tilt is a static inner group. */
    .rt-theme-comic .cm-pow { opacity: 0; transform-box: fill-box; transform-origin: center; animation: cm-pow 13s ease-in-out infinite; }
    @keyframes cm-pow {
      0%, 84%, 100% { opacity: 0; transform: scale(0.1); }
      88% { opacity: 1; transform: scale(1.25); }
      91% { transform: scale(0.9); }
      94% { opacity: 1; transform: scale(1.06); }
      98% { opacity: 0.85; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) { .rt-theme-comic .cm-pow { animation: none; opacity: 0; } }

    .rt-rails-comic { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.045); }
    .rt-rails-comic::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 100%; background: #111; }
  `;
  document.head.appendChild(style);
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-comic';
  el.style.setProperty('--rt-rail-top', `calc(var(--rt-th) * ${((railY + 2 - VIEW_TOP) / VIEW_H).toFixed(4)})`);
  return el;
}

/** A halftone-dotted, ink-outlined rounded body with a hard offset shadow behind it. */
function inkBox(x, y, w, h, r, tint) {
  return `<rect x="${x + 5}" y="${y + 5}" width="${w}" height="${h}" rx="${r}" fill="${INK}"/>` +
    `<rect class="cm-body" x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${tint}" stroke="${INK}" stroke-width="4"/>` +
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="url(#cm-dots)"/>`;
}

/** A name in a comic speech bubble centred at (cx, topY). */
function bubble(cx, topY, w, name, maxw) {
  return `<rect x="${cx - w / 2}" y="${topY}" width="${w}" height="26" rx="13" fill="#fff" stroke="${INK}" stroke-width="3"/>` +
    `<path d="M ${cx - 6} ${topY + 24} L ${cx + 6} ${topY + 24} L ${cx} ${topY + 33} Z" fill="#fff" stroke="${INK}" stroke-width="3"/>` +
    `<text class="rt-fit" data-maxw="${maxw}" x="${cx}" y="${topY + 18}" text-anchor="middle" font-weight="800" font-size="14" fill="${INK}">${esc(name)}</text>`;
}

/** Ink porthole window framing the avatar. */
function porthole(id, cx, cy, r, image, name) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#fff" stroke="${INK}" stroke-width="4"/>` +
    avatarSVG(id, cx, cy, r, image, name, '#fff');
}

function nowBurst(cx, y) {
  const star = `M ${cx} ${y - 26} L ${cx + 7} ${y - 9} L ${cx + 26} ${y - 9} L ${cx + 11} ${y + 3} L ${cx + 18} ${y + 22} L ${cx} ${y + 10} L ${cx - 18} ${y + 22} L ${cx - 11} ${y + 3} L ${cx - 26} ${y - 9} L ${cx - 7} ${y - 9} Z`;
  return `<g class="rt-pointer rt-now-bob"><path d="${star}" fill="${INK}" transform="translate(2 2)"/><path d="${star}" fill="#ffd23f" stroke="${INK}" stroke-width="3"/><text x="${cx}" y="${y + 1}" text-anchor="middle" font-weight="800" font-size="13" fill="${INK}">${esc(L('overlay.now'))}!</text></g>`;
}

function playedStamp(cx, cy) {
  return `<g class="cm-stamp" transform="rotate(-9 ${cx} ${cy})"><rect x="${cx - 40}" y="${cy - 15}" width="80" height="30" rx="7" fill="#fff" stroke="${INK}" stroke-width="3"/><text x="${cx}" y="${cy + 6}" text-anchor="middle" font-weight="800" font-size="16" fill="#c92a2a" letter-spacing="1">${esc(L('overlay.played'))}</text></g>`;
}
function spark(x, y) {
  return `<text class="cm-spark" x="${x}" y="${y}" font-size="30" font-weight="800" fill="#22d3ee" stroke="${INK}" stroke-width="1.5">★</text>`;
}

const POWS = [['POW', '#ff5252'], ['BAM', '#4dabf7'], ['ZAP', '#69db7c'], ['WHAM', '#ffd43b'], ['BOOM', '#da77f2'], ['POP', '#ffa94d']];
/** A jagged comic sound-effect burst at (cx, cy) that pops in/out (.cm-pow), tilted. */
function powBurst(cx, cy, word, col, i) {
  const spikes = 11;
  let pts = '';
  for (let k = 0; k < spikes * 2; k++) {
    const a = (k / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = k % 2 === 0 ? 32 : 19;
    pts += `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * 0.82).toFixed(1)} `;
  }
  const rot = i % 2 ? 7 : -9;
  return `<g class="cm-pow" style="animation-delay:-${(i * 1.9).toFixed(1)}s"><g transform="rotate(${rot} ${cx} ${cy})">` +
    `<polygon points="${pts}" fill="${INK}" transform="translate(3 3)"/>` +
    `<polygon points="${pts}" fill="${col}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` +
    `<text x="${cx}" y="${cy + 5}" text-anchor="middle" font-weight="800" font-size="15" fill="#fff" stroke="${INK}" stroke-width="1" paint-order="stroke">${word}!</text></g></g>`;
}

// Each builder returns { body, front }: static inked art + animating wheel/smoke layer.

function comicEngine(x, v, i) {
  const by = 112, bh = 48;
  const av = { cx: x + 174, cy: by + 7, r: 16 };  // the driver, framed in the cab window
  let s = `<path d="M ${x + 2} ${railY - 2} L ${x + 26} ${railY - 24} L ${x + 26} ${railY - 2} Z" fill="${INK}"/>`; // cowcatcher
  s += inkBox(x + 150, by - 24, 46, bh + 28, 10, '#ff6b6b');                                                   // cab
  s += `<rect x="${x + 158}" y="${by - 6}" width="32" height="26" rx="5" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
  s += inkBox(x + 12, by, 144, bh, bh / 2, '#ff6b6b');                                                          // boiler
  s += `<path d="M ${x + 64} ${by - 2} L ${x + 86} ${by - 2} L ${x + 90} ${by - 28} L ${x + 60} ${by - 28} Z" fill="${INK}"/><rect x="${x + 56}" y="${by - 34}" width="38" height="9" rx="3" fill="${INK}"/>`; // funnel
  s += `<rect x="${x + 16}" y="${by + 7}" width="14" height="14" rx="3" fill="#ffe066" stroke="${INK}" stroke-width="2.5"/>`; // headlamp
  s += porthole(`cm-av-${i}`, av.cx, av.cy, av.r, v.image, v.name);
  s += bubble(x + 90, 112, 108, v.name, 94);  // over the boiler — clear of the cab-window driver
  const timeBaseY = 156;
  s += `<text class="cm-time" data-base-y="${timeBaseY}" x="${x + 90}" y="${timeBaseY}" text-anchor="middle" font-weight="800" font-size="11" fill="${INK}">${(v.timeLines ?? [''])[0] ?? ''}</text>`;
  s += spark(x + 188, by - 14);
  // FRONT: POOF cloud + big inked wheels.
  const cloud = `<g class="rt-smoke">${[[0, 0, 13], [13, -10, 10], [-10, -10, 9], [4, -22, 8]].map(([dx, dy, r]) =>
    `<circle cx="${x + 75 + dx}" cy="${by - 40 + dy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`).join('')}</g>`;
  const front = cloud +
    `<rect x="${x + 60}" y="${railY - 2}" width="56" height="5" rx="2" fill="${INK}"/>` +
    wheel(x + 30, railY, 11, INK, 6, '#fff') + wheel(x + 64, railY, 19, INK, 6, '#fff') + wheel(x + 114, railY, 19, INK, 6, '#fff') + wheel(x + 168, railY, 14, INK, 6, '#fff');
  return { body: s, front };
}

function comicCoach(x, w, v, i, caboose) {
  const av = { cx: x + 44, cy: 130, r: 27 };
  let s = i > 0 ? `<rect x="${x - GAP - 2}" y="${railY - 42}" width="${GAP + 6}" height="8" rx="4" fill="${INK}"/>` : '';
  s += inkBox(x + 8, 92, w - 16, 80, 12, TINTS[i % TINTS.length]);
  if (caboose) s += `<rect x="${x + w - 54}" y="74" width="38" height="22" rx="5" fill="${TINTS[i % TINTS.length]}" stroke="${INK}" stroke-width="4"/>`;
  s += porthole(`cm-av-${i}`, av.cx, av.cy, av.r, v.image, v.name);
  s += bubble(x + 118, 102, w - 84, v.name, w - 100);
  const timeBaseY = 158;
  s += `<text class="cm-time" data-base-y="${timeBaseY}" x="${x + 118}" y="${timeBaseY}" text-anchor="middle" font-weight="800" font-size="12" fill="${INK}">${(v.timeLines ?? [''])[0] ?? ''}</text>`;
  s += spark(x + w - 20, 98);
  s += playedStamp(centerX(x, w), 148);
  const front = wheel(x + 44, railY, 17, INK, 6, '#fff') + wheel(x + w - 44, railY, 17, INK, 6, '#fff');
  return { body: s, front };
}

function comicTender(x, w, org) {
  const cx = centerX(x, w);
  let s = `<rect x="${x - GAP - 2}" y="${railY - 42}" width="${GAP + 6}" height="8" rx="4" fill="${INK}"/>`;
  s += inkBox(x + 8, 100, w - 16, 72, 12, '#cfe3ff');
  s += porthole('cm-org', x + 36, 134, 21, org.image, org.name);
  s += `<rect x="${x + 60}" y="116" width="${w - 72}" height="22" rx="11" fill="#ffd23f" stroke="${INK}" stroke-width="3"/><text x="${x + 60 + (w - 72) / 2}" y="131" text-anchor="middle" font-weight="800" font-size="8.5" fill="${INK}" letter-spacing="0.5">${esc(L('overlay.organisedBy'))}</text>`;
  s += `<text class="rt-fit" data-maxw="${w - 22}" x="${centerX(x, w)}" y="164" text-anchor="middle" font-weight="800" font-size="14" fill="${INK}">${esc(org.name)}</text>`;
  const front = wheel(x + 40, railY, 16, INK, 6, '#cfe3ff') + wheel(x + w - 40, railY, 16, INK, 6, '#cfe3ff');
  return { body: s, front };
}

function comicOpen(x, w, v, i) {
  const cx = centerX(x, w);
  let s = i > 0 ? `<rect x="${x - GAP - 2}" y="${railY - 42}" width="${GAP + 6}" height="8" rx="4" fill="${INK}"/>` : '';
  s += `<rect x="${x + 8}" y="92" width="${w - 16}" height="80" rx="12" fill="#eafff0" stroke="${COL.open}" stroke-width="4" stroke-dasharray="11 8"/>`;
  s += `<circle cx="${cx}" cy="124" r="26" fill="#fff" stroke="${COL.open}" stroke-width="4"/><text x="${cx}" y="${134}" text-anchor="middle" font-weight="800" font-size="34" fill="${COL.open}">?</text>`;
  s += `<rect x="${cx - 42}" y="148" width="84" height="24" rx="12" fill="#fff" stroke="${COL.open}" stroke-width="3"/><text x="${cx}" y="165" text-anchor="middle" font-weight="800" font-size="13" fill="#246b33">${esc(L('overlay.signUp'))}</text>`;
  const front = wheel(x + 46, railY, 17, INK, 6, '#eafff0') + wheel(x + w - 46, railY, 17, INK, 6, '#eafff0');
  return { body: s, front };
}

function renderUnit(unit, x, w, i) {
  const v = unit.v;
  let parts, stateClasses, burst = '', dataAttr;
  if (unit.type === 'engine') {
    parts = comicEngine(x, v, i);
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (v.isDimmed ? ' rt-car--departed' : '');
    burst = nowBurst(x + 42, 56);
    dataAttr = ' data-engine="1"';
  } else if (unit.type === 'tender') {
    parts = comicTender(x, w, v);
    stateClasses = '';
    dataAttr = ' data-tender="1"';
  } else if (v.isOpen) {
    parts = comicOpen(x, w, v, i);
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '');
    burst = nowBurst(centerX(x, w), 72); // shown by CSS only when the open slot is the live one
    dataAttr = ` data-slot="${v.slotOrder}"`;
  } else {
    parts = comicCoach(x, w, v, i, unit.type === 'caboose');
    stateClasses = (v.isCurrent ? ' rt-car--current' : '') + (v.isDeparted ? ' rt-car--departed' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '');
    burst = nowBurst(centerX(x, w), 72);
    dataAttr = ` data-slot="${v.slotOrder}"`;
  }
  return `<g class="rt-car${stateClasses}"${dataAttr}><g class="cm-art">${parts.body}</g><g class="cm-front">${parts.front}</g>${burst}</g>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const units = [];
  // The Engine is the view-model's engine vehicle, NOT just vehicles[0]: post-event
  // (enginedim=finished + hidefinished) toVehicles DROPS the Engine, so vehicles[0] is
  // then a real Car and must render as a Car, not the loco.
  const hasEngine = vehicles[0]?.kind === 'engine';
  if (hasEngine) {
    const engine = vehicles[0];
    units.push({ type: 'engine', v: engine });
    if (engine?.organiser) units.push({ type: 'tender', v: engine.organiser });
  }
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) units.push({ type: car.kind === 'open' ? 'open' : car.kind === 'caboose' ? 'caboose' : 'car', v: car });

  const widthFor = (u) => (u.type === 'engine' ? ENGINE_W : u.type === 'tender' ? TENDER_W : CAR_W);
  const xs = [];
  let acc = 0;
  for (const u of units) { xs.push(acc); acc += widthFor(u) + GAP; }
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  units.forEach((u, i) => { body += renderUnit(u, xs[i], widthFor(u), i); });

  // Sound-effect bursts spread over the coaches, popping in/out at staggered times.
  let pows = '', pc = 0;
  units.forEach((u, i) => {
    if (u.type !== 'car' && u.type !== 'caboose') return;
    const [word, col] = POWS[pc % POWS.length];
    const cx = xs[i] + widthFor(u) * (0.5 + (pc % 2 ? 0.16 : -0.16));
    const cy = 54 + (pc % 3) * 8;
    pows += powBurst(cx, cy, word, col, pc);
    pc++;
  });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-comic" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img">` +
    `<defs><pattern id="cm-dots" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.7" fill="#00000022"/></pattern></defs>${body}${pows}</svg>`;
  const svg = holder.firstElementChild;

  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  svg.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) { engineRef = { group, timeText: group.querySelector('.cm-time') }; return; }
    if (group.dataset.tender) { tenderEls.push(group); return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeText: group.querySelector('.cm-time') });
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

export default { key: 'comic', ensureStyles, build, buildTrack };
