/**
 * tron — Tron lightcycle Theme of the roster. Each vehicle is a LIGHTCYCLE
 * in side profile (facing the travel direction): a smaller glowing **front wheel**
 * that frames the broadcaster's avatar (the rider, leaning forward into the direction
 * of travel), a big hubless glowing **rear** drive wheel, and a sleek dark chassis
 * with a cyan light-spine between them. Ported in spirit from
 * the mockup and reworked to the lightcycle silhouette (the disc wheels are the
 * signature, not a card). Wired to the live Train view-model and adapted for the Overlay:
 *
 *  - Sizes to the Train height via the unit token --u: every length is
 *    calc(N * var(--u)) where --u = --rt-th / design-height, so the whole bike (wheels
 *    + chassis + rider) scales with --rt-th and the marquee width measure stays correct.
 *  - State rides the shared .rt-car--current / --departed / --spotlit classes the
 *    renderer toggles on a tick — they recolour the wheels' light-ring, the spine and
 *    the rider ring through a single `--glow`/`--hot` custom-prop cascade (Now +
 *    Spotlight coexist). Structural classes (engine/caboose/open) are build-time.
 *  - The loco is the Organiser's gold lightcycle — the conductor of the raid train; it
 *    has no Slot of its own, so it just leads and dims only post-event (isDimmed). Every
 *    streamer rides as a Car with a NOW chevron during their Slot; a departed Slot is
 *    lightly dimmed and stamped PLAYED (legibility — viewer feedback).
 *  - The hubless wheels are radial-gradient light-rings; a faint sensor tick on the
 *    .rt-wheel spins (base CSS, faster here) so the wheel reads as turning while the
 *    rider stays upright. Glows are CSS drop-shadow / box-shadow over static elements.
 *  - The Track is the glowing rail + receding hex grid, stationary, behind the Train.
 *
 * Transparent only — no full-bleed background.
 */
import { fitAll, undulate, toVehicles, esc, themeT } from './shared-svg.js';
import { ensureHtmlShared, injectStyle, htmlAvatar, stateClasses, timeLinesHTML } from './shared-html.js';

// Translator the builders paint with — rebound to the active locale in build();
// it persists for the in-place update() ticks (same locale until a re-render).
let L = themeT();

const STYLE_ID = 'rt-theme-tron-style';
// Bike bounding box (wheels ~108 tall) + the name/time strip below + NOW headroom above.
const DESIGN_H = 176;
const u = (n) => `calc(${n} * var(--u))`;

// Per-coach identity hues [glow, hot] so the bikes aren't all one colour (the
// lightcycle palette). Assigned by index, stable across re-renders + marquee copies.
// The loco (gold), tender (amber), Open (green) and the live states keep their own.
const TRON_HUES = [
  ['#18b6ff', '#aef6ff'], // cyan
  ['#ff3ea5', '#ff9ed0'], // magenta
  ['#2ee66e', '#a6ffc6'], // green
  ['#ff8a1f', '#ffc98a'], // orange
  ['#9b5cff', '#cdb0ff'], // violet
  ['#1fd6c4', '#a6fff4'], // teal
  ['#ff4d4d', '#ffa3a3'], // red
];

/** Per-Car style: the identity hue (coaches only) + a stable per-index glow-phase
 *  delay/duration so each bike breathes its colour slightly out of sync. */
function carStyle(i, hued) {
  const dur = (2.8 + (i % 4) * 0.35).toFixed(2);
  const delay = (-(i * 0.7 + (i % 3) * 0.4)).toFixed(2);
  let s = `--phase-dur:${dur}s;--phase-delay:${delay}s;`;
  if (hued) { const [g, h] = TRON_HUES[i % TRON_HUES.length]; s += `--base-glow:${g};--base-hot:${h};`; }
  return s;
}

export function ensureStyles() {
  ensureHtmlShared();
  injectStyle(STYLE_ID, `
    .tr {
      --u: calc(var(--rt-th) / ${DESIGN_H});
      --rt-ride: 0.6;  /* Ride character: tight — a lightcycle holds the line. */
      flex: none; display: flex; align-items: flex-end; gap: ${u(18)};
      font-family: 'Segoe UI', system-ui, sans-serif;
    }

    /* One lightcycle. --glow/--hot carry the colour for the whole bike: a per-Car
       identity hue (--base-glow/--base-hot, set inline) for the coaches, overridden
       by the fixed engine/tender/open colours and the live state classes below. */
    .tr-car { position: relative; width: ${u(200)}; height: ${u(176)}; text-align: center; color: #eaffff;
      --glow: var(--base-glow, #18b6ff); --hot: var(--base-hot, #aef6ff); }
    .tr-engine { --glow: #f4c430; --hot: #ffe9a8; }
    .tr-open   { --glow: #37e0a0; --hot: #a6ffd6; }

    /* Chassis: a low sleek pod spanning the hubs, near-black with a cyan light-spine
       and a canopy edge near the front. Sits behind the wheels. */
    .tr-body {
      position: absolute; left: ${u(40)}; right: ${u(20)}; bottom: ${u(82)}; height: ${u(40)};
      background: linear-gradient(168deg, #0a1825, #02060c);
      clip-path: polygon(0 56%, 16% 8%, 64% 0, 100% 40%, 100% 72%, 82% 100%, 10% 100%);
      box-shadow: inset 0 0 ${u(13)} #18b6ff1c;
    }
    .tr-body::before { content: ''; position: absolute; left: 12%; right: 6%; top: 40%; height: ${u(2)};
      background: var(--hot); box-shadow: 0 0 ${u(7)} var(--glow), 0 0 ${u(15)} var(--glow); }
    .tr-body::after { content: ''; position: absolute; right: 14%; top: 12%; width: ${u(28)}; height: ${u(12)};
      border-top: ${u(2)} solid var(--glow); border-right: ${u(2)} solid var(--glow); border-radius: 0 ${u(9)} 0 0;
      box-shadow: 0 0 ${u(7)} var(--glow); opacity: 0.85; }

    /* Hubless light-wheels: a center hole (the rear holds the rider), a glowing
       light-ring, a dark tire, transparent outside — the lightcycle disc. */
    .tr-wheel {
      position: absolute; bottom: ${u(40)}; border-radius: 50%;
      background: radial-gradient(circle,
        transparent 0 50%, var(--glow) 52% 57%, #08131e 60% 91%, #04080e 91% 95%, transparent 96%);
      box-shadow: 0 0 ${u(15)} var(--glow), inset 0 0 ${u(10)} var(--glow);
    }
    /* a single bright sensor tick that rides the spin so the wheel reads as turning */
    .tr-wheel::after { content: ''; position: absolute; left: 50%; top: 4%; width: ${u(3)}; height: ${u(8)};
      transform: translateX(-50%); background: var(--hot); border-radius: ${u(2)}; box-shadow: 0 0 ${u(5)} var(--glow); }
    /* Differential spin: two wheels rolling at the same linear speed turn at rates
       inversely proportional to their diameter, so the smaller front wheel completes
       more revolutions — it visibly spins faster than the big rear wheel (no longer
       the tell-tale "different sizes, same rate" giveaway). */
    .tr-front.rt-wheel { animation-duration: 1.33s; }  /* 1.7s × 86/110 */
    .tr-rear.rt-wheel  { animation-duration: 1.7s; }
    /* Colour-phase: a brighter --hot light-ring overlaid on the wheel whose OPACITY
       breathes (compositor-only — no filter re-raster), so each bike pulses between
       dimmer and brighter on its own hue. Per-Car delay/duration (set inline) keep
       neighbours out of sync. */
    .tr-wheel::before { content: ''; position: absolute; inset: 0; border-radius: 50%;
      background: radial-gradient(circle, transparent 0 50%, var(--hot) 52% 57%, transparent 61%);
      opacity: 0; animation: tron-glow var(--phase-dur, 3.2s) ease-in-out infinite var(--phase-delay, 0s); }
    @keyframes tron-glow { 0%, 100% { opacity: 0.04; } 50% { opacity: 0.7; } }
    /* Bike faces LEFT (the train's travel direction): the small front wheel leads on
       the left and carries the rider, the big rear drive wheel trails on the right. */
    .tr-rear  { right: ${u(2)}; width: ${u(110)}; height: ${u(110)}; }
    .tr-front { left: ${u(2)};  width: ${u(86)};  height: ${u(86)};  z-index: 2; }

    /* The rider: the avatar, STATIC, in the FRONT wheel's hub (a sibling of the spinning
       wheel so it doesn't rotate) — perched over the leading wheel so the bike reads as
       a motorcyclist leaning forward. Sized to the smaller front wheel's hub. */
    .tr-rider { position: absolute; left: ${u(2)}; bottom: ${u(40)}; width: ${u(86)}; height: ${u(86)};
      display: flex; align-items: center; justify-content: center; z-index: 3; }
    .tr-ring { position: relative; width: ${u(46)}; height: ${u(46)}; border-radius: 50%; overflow: hidden;
      background: #08111d; color: var(--hot); font-weight: 700; font-size: ${u(18)};
      filter: drop-shadow(0 0 ${u(2)} var(--hot)) drop-shadow(0 0 ${u(6)} var(--glow)); }
    .tr-ring-open { display: flex; align-items: center; justify-content: center; font-size: ${u(30)}; color: var(--glow); }

    /* Name + time on a strip below the bike (the wheels sit on the rail). */
    .tr-name { position: absolute; left: 0; right: 0; bottom: ${u(18)}; font-weight: 600; font-size: ${u(13)};
      letter-spacing: ${u(1)}; color: #fff; text-shadow: 0 0 ${u(8)} var(--glow); }
    .tr-time { position: absolute; left: 0; right: 0; bottom: ${u(3)}; font-size: ${u(11)}; color: #8fd0ec; letter-spacing: ${u(0.5)}; }
    .tr-time span { display: inline; }

    /* The always-present Now chevron (revealed by .rt-car--current via base CSS). */
    .tr-chev { position: absolute; top: ${u(-4)}; left: 50%; transform: translateX(-50%);
      color: #04060c; background: var(--hot); font-weight: 800; font-size: ${u(11)};
      padding: ${u(2)} ${u(8)}; border-radius: ${u(3)}; box-shadow: 0 0 ${u(12)} var(--hot); white-space: nowrap; z-index: 4; }

    /* Organiser tender: an amber lightcycle credit bike behind the loco. */
    .tr-tender { --glow: #ffb24f; --hot: #ffe0a8; }
    .tr-tender-label { position: absolute; left: 0; right: 0; bottom: ${u(22)}; font-weight: 800; font-size: ${u(9)};
      letter-spacing: ${u(1.5)}; color: var(--hot); text-shadow: 0 0 ${u(6)} var(--glow); }
    .tr-tender-name { position: absolute; left: 0; right: 0; bottom: ${u(5)}; font-weight: 700; font-size: ${u(14)};
      color: #fff; text-shadow: 0 0 ${u(8)} var(--glow); }

    /* PLAYED stamp: always present, revealed by .rt-car--departed. Angled over the bike. */
    .tr-stamp { visibility: hidden; position: absolute; left: 50%; top: ${u(40)}; transform: translateX(-50%) rotate(-8deg);
      white-space: nowrap; font-weight: 800; font-size: ${u(12)}; letter-spacing: ${u(2)}; color: #eaffff;
      padding: ${u(2)} ${u(10)}; background: #04121acc; border: ${u(1.5)} solid var(--glow);
      box-shadow: 0 0 ${u(9)} var(--glow); text-shadow: 0 0 ${u(6)} var(--glow); z-index: 4; }
    .tr-car.rt-car--departed .tr-stamp { visibility: visible; }

    /* State recolours the whole bike through --glow/--hot (live tick):
       current = white-hot, spotlit = bright cyan, departed = a muted dim. */
    .tr-car.rt-car--current  { --glow: #eaffff; --hot: #ffffff; }
    .tr-car.rt-car--spotlit  { --glow: #22d3ee; --hot: #a6f6ff; }
    .tr-car.rt-car--departed { --glow: #2a5a72; --hot: #4e8aa6; opacity: 0.82; }

    /* Glowing-rail + receding hex-grid Track (stationary; fractions of --rt-th). */
    .rt-rails-tron { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.32); }
    .rt-rails-tron::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: calc(var(--rt-th) * 0.016);
      background: #18b6ff; box-shadow: 0 0 calc(var(--rt-th) * 0.073) #18b6ff, 0 0 calc(var(--rt-th) * 0.157) #18b6ff88;
      animation: tron-rail-pulse 2.4s ease-in-out infinite;
    }
    .tr-grid {
      position: absolute; top: calc(var(--rt-th) * 0.02); left: 0; width: 100%; height: calc(var(--rt-th) * 0.3);
      opacity: 0.85; transform: perspective(calc(var(--rt-th) * 0.31)) rotateX(42deg); transform-origin: top;
    }
    .tr-grid svg { width: 100%; height: 100%; display: block; }
    @keyframes tron-rail-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
    @media (prefers-reduced-motion: reduce) {
      .rt-rails-tron::before { animation: none; }
      .tr-wheel::before { animation: none; opacity: 0.35; }
    }
  `);
}

/** The receding hex grid as raw SVG (a honeycomb tiling, drop-shadow glow). */
function hexFloorSVG() {
  const w = 1600;
  const h = 56;
  const s = 22;
  const dx = s * 1.5;
  const dy = s * 0.866;
  let p = '';
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < w / dx + 2; col++) {
      const cx = col * dx + (row % 2 ? dx / 2 : 0);
      const cy = row * dy;
      p += `<path d="M ${cx - s} ${cy} l ${s / 2} ${-dy} l ${s} 0 l ${s / 2} ${dy} l ${-s / 2} ${dy} l ${-s} 0 z" fill="none" stroke="#18b6ff" stroke-width="1.2"/>`;
    }
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="filter: drop-shadow(0 0 4px #18b6ff)">${p}</svg>`;
}

/** Stationary glowing-rail + hex-grid Track, placed behind the Train by the renderer. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-tron';
  // Rail sits at the wheels' contact line (the bike box reaches ~0.79 of --rt-th).
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.77)');
  el.innerHTML = `<div class="tr-grid">${hexFloorSVG()}</div>`;
  return el;
}

/** The time block markup for a vehicle (add-unit / tz lines). */
function timeBlock(v) {
  if (v.isOpen) {
    const t = v.timeLines[0] ? ` · ${esc(v.timeLines[0])}` : '';
    return `<span>${esc(L('overlay.signUp'))}${t}</span>`;
  }
  return timeLinesHTML(v.timeLines);
}

/** One vehicle → a lightcycle .rt-car. The two wheels spin (.rt-wheel); the rider
 *  (avatar) is a static sibling in the rear hub. */
function tronCar(v, i) {
  const isEngine = v.kind === 'engine';
  const structural = [
    isEngine ? 'tr-engine' : '',
    v.kind === 'caboose' ? 'tr-caboose' : '',
    v.isOpen ? 'tr-open' : '',
  ].filter(Boolean).join(' ');
  const cls = `rt-car tr-car ${structural} ${stateClasses(v)}`.replace(/\s+/g, ' ').trim();
  const dataSlot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
  const chev = v.isOpen ? '' : `<div class="rt-pointer rt-now-bob tr-chev">▸ ${esc(L('overlay.now'))}</div>`;
  const rider = v.isOpen
    ? '<div class="tr-rider"><div class="tr-ring tr-ring-open">+</div></div>'
    : `<div class="tr-rider"><div class="tr-ring">${htmlAvatar(v)}</div></div>`;
  const name = v.isOpen ? esc(L('overlay.open')) : esc(v.name);
  const stamp = v.isOpen ? '' : `<div class="tr-stamp">${esc(L('overlay.played'))}</div>`;
  // Coaches (not the gold loco / green Open) carry an identity hue.
  const hued = !v.isOpen && !isEngine;
  return `<div class="${cls}"${dataSlot} style="${carStyle(i, hued)}">${chev}` +
    `<div class="tr-body"></div>` +
    `<div class="tr-wheel rt-wheel tr-front"></div><div class="tr-wheel rt-wheel tr-rear"></div>` +
    `${rider}` +
    `<div class="tr-name rt-fit">${name}</div><div class="tr-time">${timeBlock(v)}</div>${stamp}</div>`;
}

/** The Organiser tender: an amber lightcycle credit bike behind the loco.
 *  "ORGANISED BY" + the name on its own rt-fit line so a long handle condenses. */
function tronTender(org, i) {
  return `<div class="rt-car tr-car tr-tender" data-tender="1" style="${carStyle(i, false)}">` +
    `<div class="tr-body"></div>` +
    `<div class="tr-wheel rt-wheel tr-front"></div><div class="tr-wheel rt-wheel tr-rear"></div>` +
    `<div class="tr-rider"><div class="tr-ring">${htmlAvatar(org)}</div></div>` +
    `<div class="tr-tender-label">${esc(L('overlay.organisedBy'))}</div>` +
    `<div class="tr-tender-name rt-fit">${esc(org.name)}</div></div>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const node = document.createElement('div');
  node.className = 'tr rt-theme-tron';

  // Layout units: the loco (first streamer), then the Organiser tender right behind it
  // (omitted when the Organiser already drives the loco), then the Cars.
  const engine = vehicles[0];
  // Only treat vehicles[0] as the loco when it really IS the Engine: post-event
  // (enginedim=finished + hidefinished) toVehicles drops the Engine, so vehicles[0]
  // is then a Car — or the list is empty — and tronCar(undefined) would throw.
  const hasEngine = engine?.kind === 'engine';
  const units = [];
  let idx = 0;
  if (hasEngine) {
    units.push(tronCar(engine, idx++));
    if (engine.organiser) units.push(tronTender(engine.organiser, idx++));
  }
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) units.push(tronCar(car, idx++));
  node.innerHTML = units.join('');

  // Refs: Cars keyed by slotOrder; the Engine + tender tracked for the post-event dim.
  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  node.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) {
      engineRef = { group, timeEl: group.querySelector('.tr-time') };
      return;
    }
    if (group.dataset.tender) {
      tenderEls.push(group);
      return;
    }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeEl: group.querySelector('.tr-time'), isOpen: group.classList.contains('tr-open') });
  });

  return {
    node,
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          ref.group.classList.toggle('rt-car--current', car.isCurrent);
          ref.group.classList.toggle('rt-car--departed', car.isDeparted);
          ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
          if (ref.timeEl) ref.timeEl.innerHTML = timeBlock({ isOpen: ref.isOpen, timeLines: car.timeLines ?? [car.relativeTime] });
        }
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        // The loco shows the first streamer's live state but dims only post-event
        // (isDimmed), never on their per-slot departed — it is the eternal leader.
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        if (engineRef.timeEl) engineRef.timeEl.innerHTML = timeBlock({ isOpen: false, timeLines: eng.timeLines ?? [eng.relativeTime ?? ''] });
      }
      for (const el of tenderEls) el.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
    },
    afterAttach() {
      fitAll(node);
      undulate(node);
    },
  };
}

export default { key: 'tron', ensureStyles, build, buildTrack };
