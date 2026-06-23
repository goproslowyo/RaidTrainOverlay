/**
 * synthwave — Synthwave Theme, the first HTML/CSS Theme of the
 * roster (renamed from the mockup's "neon"; theme=neon aliases here). Ported
 * from the original art mockup, wired to the live Train view-model and adapted
 * for the Overlay:
 *
 *  - Sizes to the Train height via the unit token --u: every length
 *    is calc(N * var(--u)) where --u = --rt-th / design-height, so the whole
 *    Theme scales with --rt-th (and the scale param) and the marquee width
 *    measurement stays correct in the same tick.
 *  - Car state rides the shared .rt-car--current / --departed / --spotlit classes
 *    (toggled by the renderer on a time tick), not build-time classes, so Now +
 *    Spotlight coexist and updates never rebuild. Structural classes
 *    (engine / caboose / open) are build-time.
 *  - The Now pointer is always present and revealed by .rt-car--current (base CSS).
 *  - The loco shows the FIRST streamer, carrying their live state (the
 *    Now Marker during their Slot, Spotlight, and the post-event dim) — it stays
 *    bright after their slot (eternal leader). The Organiser rides a prominent
 *    .sw-tender credit car right behind it; a departed Slot is lightly dimmed and
 *    stamped PLAYED (legibility — viewer feedback).
 *  - The Track is the outrun grid (the synthwave grid strip as
 *    Track): a stationary, full-width neon rail + receding grid, painted behind
 *    the Train; its gradient-flow animation disables under reduced-motion.
 *
 * Transparent only — no full-bleed background. Sunset-gradient Cars,
 * cyan avatar rings, neon glows.
 */
import { fitAll, undulate, toVehicles, esc, themeT } from './shared-svg.js';
import { ensureHtmlShared, injectStyle, htmlAvatar, htmlWheel, stateClasses, timeLinesHTML } from './shared-html.js';

// Translator the builders paint with — rebound to the active locale in build().
let L = themeT();

const STYLE_ID = 'rt-theme-synthwave-style';
// Design height in px (Car body + wheels); the floating Now pointer overhangs
// above it into the canvas. --u = --rt-th / this.
const DESIGN_H = 210;
const u = (n) => `calc(${n} * var(--u))`;

export function ensureStyles() {
  ensureHtmlShared();
  injectStyle(STYLE_ID, `
    .sw {
      --u: calc(var(--rt-th) / ${DESIGN_H});
      flex: none;
      display: flex;
      align-items: flex-end;
      gap: ${u(16)};
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    .sw-link { width: ${u(16)}; height: ${u(3)}; align-self: center; margin-bottom: ${u(60)}; background: linear-gradient(90deg, #ff2bd6, #00e5ff); box-shadow: 0 0 ${u(8)} #ff2bd6; }
    .sw-car {
      position: relative; width: ${u(140)}; padding: ${u(16)} ${u(12)} ${u(10)}; text-align: center;
      border-radius: ${u(14)}; border: ${u(2)} solid #ff4fd8;
      background: linear-gradient(180deg, #241a52 0%, #5b2a78 45%, #b83a73 78%, #ff7a59 100%);
      box-shadow: 0 0 ${u(18)} #ff2bd644, inset 0 0 ${u(16)} #00e5ff14;
    }
    .sw-engine { border-color: #ffb24f; box-shadow: 0 0 ${u(22)} #ffb24f55, inset 0 0 ${u(16)} #ff7a5922; }
    .sw-caboose { border-color: #a04fff; }
    .sw-ring {
      position: relative; width: ${u(84)}; height: ${u(84)}; margin: 0 auto ${u(10)}; border-radius: 50%; overflow: hidden;
      border: ${u(3)} solid #6ff7ff; box-shadow: 0 0 ${u(16)} #6ff7ff, inset 0 0 ${u(10)} #6ff7ff88;
      background: #241a3d; color: #7ef9ff; font-size: ${u(30)};
    }
    .sw-name { font-weight: 800; font-size: ${u(14)}; color: #fff; letter-spacing: ${u(0.5)}; text-shadow: 0 0 ${u(8)} #ff2bd6, 0 ${u(1)} 0 #5b1a5b; }
    .sw-time { font-size: ${u(12)}; color: #ffe1f5; margin-top: ${u(2)}; text-shadow: 0 0 ${u(6)} #ff2bd688; }
    .sw-time span { display: block; }
    .sw-wheels { display: flex; justify-content: space-between; padding: 0 ${u(14)}; margin: ${u(10)} ${u(-6)} 0; }
    .sw-w { width: ${u(22)}; height: ${u(22)}; background: #0a0618; box-shadow: 0 0 ${u(10)} #00e5ff88, inset 0 0 0 ${u(2)} #00e5ff; --spk: #6ff7ff; }
    .sw-pointer { position: absolute; top: ${u(-24)}; left: 50%; transform: translateX(-50%); color: #2a0a2a; background: #ffe75c; font-weight: 800; font-size: ${u(11)}; padding: ${u(2)} ${u(8)}; border-radius: ${u(5)}; box-shadow: 0 0 ${u(12)} #ffe75caa; white-space: nowrap; }

    /* Organiser tender: a prominent coal-car credit coupled right
       behind the loco. Darker outrun-night body, amber rim, so it reads as a
       distinct car that fuels the train rather than another streamer Slot. */
    .sw-tender {
      position: relative; width: ${u(132)}; padding: ${u(14)} ${u(12)} ${u(10)}; text-align: center;
      border-radius: ${u(14)}; border: ${u(2)} solid #ffb24f;
      background: linear-gradient(180deg, #160f33 0%, #2a1a4a 60%, #3a2140 100%);
      box-shadow: 0 0 ${u(16)} #ffb24f44, inset 0 0 ${u(14)} #ff2bd611;
    }
    .sw-tender .sw-ring { border-color: #ffd98a; box-shadow: 0 0 ${u(14)} #ffb24faa, inset 0 0 ${u(10)} #ffb24f66; color: #ffd98a; }
    .sw-tender-label { font-weight: 800; font-size: ${u(10)}; letter-spacing: ${u(1.5)}; color: #ffd98a; text-shadow: 0 0 ${u(6)} #ffb24f88; margin-top: ${u(6)}; }
    .sw-tender-name { font-weight: 800; font-size: ${u(15)}; color: #fff; letter-spacing: ${u(0.5)}; text-shadow: 0 0 ${u(8)} #ffb24f, 0 ${u(1)} 0 #3a2140; margin-top: ${u(1)}; }
    .sw-tender.rt-car--departed { opacity: 0.8; filter: grayscale(0.25); }

    /* Open Slot: dashed green frame, "+" ring. */
    .sw-open { background: linear-gradient(180deg, #13351f, #1f5b32); border-style: dashed; border-color: #37e0a0; }
    .sw-ring-open { border-color: #37e0a0; box-shadow: 0 0 ${u(14)} #37e0a0; display: flex; align-items: center; justify-content: center; font-size: ${u(42)}; color: #9affd0; }
    .sw-open .sw-name, .sw-open .sw-time { color: #9affd0; text-shadow: 0 0 ${u(6)} #37e0a0; }
    .sw-open .sw-w { box-shadow: 0 0 ${u(10)} #37e0a0, inset 0 0 0 ${u(2)} #37e0a0; --spk: #9affd0; }

    /* State treatments ride the shared .rt-car--* classes (live time tick). A
       handed-off Slot stays readable — a light dim + a PLAYED stamp, not heavy
       shade (viewer feedback): names/avatars must still read. */
    .sw-car.rt-car--departed { opacity: 0.8; filter: grayscale(0.2); }
    .sw-stamp {
      visibility: hidden; position: absolute; top: ${u(96)}; left: 50%;
      transform: translateX(-50%) rotate(-9deg); white-space: nowrap;
      font-weight: 800; font-size: ${u(13)}; letter-spacing: ${u(2)}; color: #ffe1f5;
      padding: ${u(2)} ${u(10)}; border-radius: ${u(4)};
      background: #2a0a2acc; border: ${u(2)} solid #ff7ad6; box-shadow: 0 0 ${u(10)} #ff2bd699;
      text-shadow: 0 0 ${u(6)} #ff2bd6;
    }
    .sw-car.rt-car--departed .sw-stamp { visibility: visible; }
    .sw-car.rt-car--current { border-color: #ffe75c; box-shadow: 0 0 ${u(30)} #ffe75c66, inset 0 0 ${u(18)} #ffe75c22; }
    .sw-car.rt-car--current .sw-ring { border-color: #ffe75c; box-shadow: 0 0 ${u(16)} #ffe75c; }
    .sw-car.rt-car--current .sw-time { color: #fff6c8; }
    .sw-car.rt-car--spotlit { border-color: #6ff7ff; box-shadow: 0 0 ${u(30)} #6ff7ff77; }

    /* Outrun-grid Track: stationary neon rail + receding
       grid, sized in fractions of --rt-th (it lives outside .sw, so no --u here). */
    .rt-rails-synthwave { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.46); }
    .rt-rails-synthwave::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: calc(var(--rt-th) * 0.022);
      background: linear-gradient(90deg, #ff2bd6, #9b5cff, #00e5ff); background-size: 200% 100%;
      box-shadow: 0 0 calc(var(--rt-th) * 0.05) #ff2bd6cc, 0 0 calc(var(--rt-th) * 0.09) #00e5ff66;
      animation: sw-neon-flow 3s linear infinite;
    }
    .sw-grid { position: absolute; top: calc(var(--rt-th) * 0.022); left: 0; width: 100%; height: calc(var(--rt-th) * 0.42); opacity: 0.8; transform: perspective(calc(var(--rt-th) * 0.22)) rotateX(46deg); transform-origin: top; }
    .sw-grid svg { width: 100%; height: 100%; display: block; }
    @keyframes sw-neon-flow { to { background-position: 200% 0; } }
    @media (prefers-reduced-motion: reduce) { .rt-rails-synthwave::before { animation: none; } }
  `);
}

/** The outrun grid as raw SVG (lines recede toward a central vanishing point). */
function gridFloorSVG(color) {
  const w = 1600;
  const h = 58;
  const vanish = w / 2;
  let p = '';
  for (let i = -16; i <= 16; i++) {
    p += `<line x1="${vanish + i * 8}" y1="0" x2="${vanish + i * 50}" y2="${h}" stroke="${color}" stroke-width="1"/>`;
  }
  for (let r = 1; r <= 6; r++) {
    const gy = h - (h * (7 - r)) / 7;
    p += `<line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="${color}" stroke-width="1"/>`;
  }
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="filter: drop-shadow(0 0 3px ${color})">${p}</svg>`;
}

/** Stationary outrun-grid Track, placed behind the Train by the renderer. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-synthwave';
  // Rail line sits just below the wheels (the Car box is ~0.886 of --rt-th).
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.84)');
  el.innerHTML = `<div class="sw-grid">${gridFloorSVG('#ff5ad6')}</div>`;
  return el;
}

/** The time block markup for a vehicle (sign-up / tz lines). The engine carries
 *  the first streamer's time now (NOW during their slot), like the coaches. */
function timeBlock(v) {
  if (v.isOpen) {
    const t = v.timeLines[0] ? ` · ${esc(v.timeLines[0])}` : '';
    return `<span>${esc(L('overlay.signUp'))}${t}</span>`;
  }
  return timeLinesHTML(v.timeLines);
}

/** One vehicle → its .rt-car div. The engine now carries the first streamer with
 *  the NOW pointer during their Slot; a departed Slot is stamped PLAYED. */
function neonCar(v) {
  const isEngine = v.kind === 'engine';
  const structural = [
    isEngine ? 'sw-engine' : '',
    v.kind === 'caboose' ? 'sw-caboose' : '',
    v.isOpen ? 'sw-open' : '',
  ].filter(Boolean).join(' ');
  const cls = `rt-car sw-car ${structural} ${stateClasses(v)}`.replace(/\s+/g, ' ').trim();
  // The loco has no slotOrder key (it's the eternal leader, tracked separately);
  // its Now pointer rides .rt-car--current from stateClasses like the coaches.
  const dataSlot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
  const pointer = v.isOpen ? '' : `<div class="rt-pointer rt-now-bob sw-pointer">${esc(L('overlay.now'))} ▾</div>`;
  const ring = v.isOpen
    ? '<div class="sw-ring sw-ring-open">+</div>'
    : `<div class="sw-ring">${htmlAvatar(v)}</div>`;
  const name = v.isOpen ? esc(L('overlay.open')) : esc(v.name);
  // PLAYED stamp: always in the DOM, revealed by .rt-car--departed (CSS). The loco
  // never carries a per-slot departed (stateClasses only dims it on isDimmed), so
  // it won't stamp until the Event ends.
  const stamp = v.isOpen ? '' : `<div class="sw-stamp">${esc(L('overlay.played'))}</div>`;
  const wheels = `<div class="sw-wheels">${htmlWheel('sw-w')}${htmlWheel('sw-w')}</div>`;
  return `<div class="${cls}"${dataSlot}>${pointer}${ring}<div class="sw-name rt-fit">${name}</div><div class="sw-time">${timeBlock(v)}</div>${stamp}${wheels}</div>`;
}

/** The Organiser tender: a prominent credit car coupled behind the
 *  loco. "ORGANISED BY" + the organiser name on its OWN rt-fit line (so a long
 *  handle like "teknokat222" condenses to fit rather than clipping). */
function tenderCar(org) {
  const wheels = `<div class="sw-wheels">${htmlWheel('sw-w')}${htmlWheel('sw-w')}</div>`;
  return `<div class="rt-car sw-car sw-tender" data-tender="1">`
    + `<div class="sw-ring">${htmlAvatar(org)}</div>`
    + `<div class="sw-tender-label">${esc(L('overlay.organisedBy'))}</div>`
    + `<div class="sw-tender-name rt-fit">${esc(org.name)}</div>`
    + `${wheels}</div>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const node = document.createElement('div');
  node.className = 'sw rt-theme-synthwave';

  // Layout units: the loco (first streamer), then the Organiser tender right
  // behind it (omitted when the Organiser is already driving the loco
  // — engine.organiser is null), then the Cars. Couplers (.sw-link) between all.
  const engine = vehicles[0];
  // Only treat vehicles[0] as the loco when it really IS the Engine: post-event the
  // Engine is dropped, so vehicles[0] may be a Car (or absent) — neonCar(undefined) throws.
  const hasEngine = engine?.kind === 'engine';
  const units = hasEngine ? [neonCar(engine)] : [];
  if (hasEngine && engine.organiser) units.push(tenderCar(engine.organiser));
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) units.push(neonCar(car));
  node.innerHTML = units.join('<div class="sw-link"></div>');

  // Refs: Cars keyed by slotOrder; the Engine + tender tracked for the post-event
  // dim (the loco is the eternal leader, never keyed by a per-slot departed).
  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  node.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) {
      engineRef = { group, timeEl: group.querySelector('.sw-time') };
      return;
    }
    if (group.dataset.tender) {
      tenderEls.push(group);
      return;
    }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeEl: group.querySelector('.sw-time'), isOpen: group.classList.contains('sw-open') });
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
        // The loco shows the first streamer's live state — NOW + Spotlight during
        // their Slot — but dims only post-event (isDimmed), never on their per-slot
        // departed, so it stays bright as the eternal leader.
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

export default { key: 'synthwave', ensureStyles, build, buildTrack };
