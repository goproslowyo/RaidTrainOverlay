/**
 * wood — Wooden Toy Train Theme, one of the HTML/CSS roster.
 * Ported from the original art mockup, wired to the live Train view-model and
 * adapted for the Overlay:
 *
 *  - Sizes to the Train height via the unit token --u: every length
 *    inside the root is calc(N * var(--u)) where --u = --rt-th / design-height, so
 *    the whole Theme scales with --rt-th (and the scale param) and the marquee
 *    width measurement stays correct in the same tick.
 *  - Car state rides the shared .rt-car--current / --departed / --spotlit classes
 *    (toggled by the renderer on a time tick), not build-time classes, so Now +
 *    Spotlight coexist and updates never rebuild. Structural classes
 *    (engine / caboose / open) are build-time.
 *  - The Now flag is always present and revealed by .rt-car--current (base CSS);
 *    the ★ star shows via .rt-car--spotlit.
 *  - A decorative kid walks ahead at the FRONT of the Train, pulling a string. It
 *    is NOT a .rt-car (it must not undulate); it scales in --u and keeps its own
 *    wd-walk body bob + wd-step leg swing (disabled under reduced-motion).
 *  - The Track is a wooden-sleepers band (ported from .trk--wood): a lighter rail
 *    over an alternating sleeper gradient, sized in fractions of --rt-th. Static.
 *
 * Transparent only — no full-bleed background. Rounded tinted blocks,
 * magnet couplers between Cars, an engine chimney puffing smoke.
 */
import { fitAll, undulate, toVehicles, esc, themeT } from './shared-svg.js';
import { ensureHtmlShared, injectStyle, htmlAvatar, htmlWheel, stateClasses, timeLinesHTML } from './shared-html.js';

// Translator the builders paint with — rebound to the active locale in build();
// it persists for the in-place update() ticks (same locale until a re-render).
let L = themeT();

const STYLE_ID = 'rt-theme-wood-style';
// Design height in px = the Car block (padding 18+74 badge + ~8 badge gap + name
// + time + 8 pad ≈ 152) plus the wheels that hang below it (~28, overlapping by
// 8 → ~20). The kid is taller but walks alongside, and the chimney / smoke / Now
// flag overhang above the box is free to sit in the canvas (HTML Themes have no
// viewBox), so neither counts toward --u. --u = --rt-th / this.
const DESIGN_H = 180;
const u = (n) => `calc(${n} * var(--u))`;

// Per-vehicle block tints (by lineup index); the engine is its own warm red.
const WOOD_TINTS = ['#c0703a', '#d99a3c', '#4f8a6b', '#c75d4a', '#6b7fae'];
const ENGINE_TINT = '#c0532f';

export function ensureStyles() {
  ensureHtmlShared();
  injectStyle(STYLE_ID, `
    .wd {
      --u: calc(var(--rt-th) / ${DESIGN_H});
      --rt-ride: 1.35;  /* Ride character: loose — a wooden pull-toy bounces. */
      flex: none;
      display: flex;
      align-items: flex-end;
      gap: 0;
      font-family: 'Baloo 2', 'Comic Sans MS', system-ui, sans-serif;
    }

    /* The kid: walks ahead at the front pulling the string. Decorative — not a
       .rt-car, so it never undulates; it scales in --u with the Train. */
    .wd-kid { align-self: flex-end; margin-bottom: ${u(4)}; margin-right: ${u(-8)}; animation: wd-walk 0.5s ease-in-out infinite; transform-origin: bottom center; }
    .wd-kid svg { width: ${u(74)}; height: ${u(150)}; display: block; }
    .wd-leg { transform-box: fill-box; transform-origin: top center; animation: wd-step 0.5s ease-in-out infinite alternate; }
    .wd-leg2 { animation-delay: -0.25s; }
    @keyframes wd-walk { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(${u(-3)}) rotate(1.2deg); } }
    @keyframes wd-step { from { transform: rotate(20deg); } to { transform: rotate(-20deg); } }

    /* Magnet couplers between Cars. */
    .wd-mag { width: ${u(16)}; height: ${u(10)}; background: radial-gradient(circle at 30% 40%, #7d7d85, #3a3a40); border-radius: ${u(3)}; align-self: center; margin-bottom: ${u(42)}; box-shadow: inset 0 ${u(1)} 0 #fff6; }

    .wd-car {
      position: relative; width: ${u(128)}; margin: 0 ${u(5)}; padding: ${u(18)} ${u(10)} ${u(8)};
      text-align: center; color: #fff; background: var(--tint); border-radius: ${u(20)}; overflow: hidden;
      box-shadow: inset 0 ${u(-9)} 0 #0002, inset 0 ${u(7)} 0 #fff5, inset 0 0 0 ${u(3)} #ffffff22, 0 ${u(4)} 0 #00000026;
      background-image: repeating-linear-gradient(91deg, #ffffff14 0 ${u(7)}, #00000012 ${u(7)} ${u(13)});
    }
    .wd-car::after { content: ''; position: absolute; inset: 0; border-radius: ${u(20)}; box-shadow: inset 0 0 ${u(14)} #5a360f55; pointer-events: none; }
    .wd-engine { border-radius: ${u(20)} ${u(26)} ${u(20)} ${u(20)}; }

    /* Engine chimney + puffing smoke (rt-puff via base CSS). */
    .wd-stack { position: absolute; top: ${u(-15)}; left: ${u(18)}; width: ${u(20)}; height: ${u(18)}; background: #5c3a1e; border-radius: ${u(6)} ${u(6)} 0 0; box-shadow: inset 0 ${u(4)} 0 #fff3; }
    .wd-stack span { position: absolute; top: ${u(-8)}; left: ${u(5)}; width: ${u(11)}; height: ${u(11)}; border-radius: 50%; background: #e8e2d6; opacity: 0; animation: rt-puff 2.1s ease-out infinite; }
    .wd-stack span:nth-child(2) { animation-delay: 0.7s; }
    .wd-stack span:nth-child(3) { animation-delay: 1.4s; }

    /* Grain knots. */
    .wd-knot { position: absolute; width: ${u(9)}; height: ${u(9)}; border-radius: 50%; background: radial-gradient(circle, #0003, transparent 70%); }
    .wd-knot.k1 { top: ${u(60)}; left: ${u(14)}; }
    .wd-knot.k2 { bottom: ${u(38)}; right: ${u(18)}; }

    .wd-badge { position: relative; width: ${u(74)}; height: ${u(74)}; margin: 0 auto ${u(8)}; border-radius: 50%; overflow: hidden; background: #fff; border: ${u(5)} solid #fff; box-shadow: 0 ${u(2)} ${u(4)} #0003; color: #8a5a2b; font-weight: 800; font-size: ${u(26)}; }
    .wd-name { font-weight: 800; font-size: ${u(14)}; text-shadow: 0 ${u(2)} 0 #0003; }
    .wd-time { font-size: ${u(12)}; opacity: 0.95; }

    .wd-wheels { display: flex; justify-content: space-between; padding: 0 ${u(14)}; margin: ${u(6)} ${u(-10)} ${u(-8)}; }
    .wd-w { width: ${u(28)}; height: ${u(28)}; background: #3a2a18; box-shadow: inset 0 0 0 ${u(7)} #caa06a, inset 0 0 0 ${u(10)} #3a2a18, 0 ${u(2)} ${u(2)} #0004; --spk: #caa06a; }

    /* Now flag (always present; base CSS reveals .rt-pointer on .rt-car--current)
       and the Spotlight star (revealed on .rt-car--spotlit). */
    .wd-flag { position: absolute; top: ${u(-22)}; left: 50%; transform: translateX(-50%); background: #fbbf24; color: #3a2a14; font-weight: 800; font-size: ${u(11)}; padding: ${u(2)} ${u(8)}; border-radius: ${u(5)}; white-space: nowrap; }
    .wd-star { position: absolute; top: ${u(-8)}; right: ${u(-2)}; color: #22d3ee; font-size: ${u(24)}; text-shadow: 0 0 ${u(6)} #22d3ee; visibility: hidden; }
    .wd-car.rt-car--spotlit .wd-star { visibility: visible; }

    /* Open Slot: dashed green block, "+" badge. */
    .wd-open { background: #eef6ee; color: #2f7d3f; border: ${u(4)} dashed #37b24d; box-shadow: none; background-image: none; }
    .wd-open::after { box-shadow: none; }
    .wd-badge-open { background: #dff0e1; color: #37b24d; border-color: #cdeed1; font-size: ${u(40)}; display: flex; align-items: center; justify-content: center; }
    .wd-open .wd-w { box-shadow: inset 0 0 0 ${u(7)} #37b24d, inset 0 0 0 ${u(10)} #3a2a18, 0 ${u(2)} ${u(2)} #0004; --spk: #37b24d; }

    /* Organiser tender: a prominent walnut credit car coupled right
       behind the loco. A darker, cooler walnut body (distinct from the warm Car
       tints) with a gold-ish rim so it reads as the car that fuels the train
       rather than another streamer Slot. Dims with the loco (set in update()). */
    .wd-tender {
      position: relative; width: ${u(120)}; margin: 0 ${u(5)}; padding: ${u(16)} ${u(10)} ${u(8)};
      text-align: center; color: #fff; border-radius: ${u(20)}; overflow: hidden;
      background: #5a3a22;
      background-image: repeating-linear-gradient(91deg, #ffffff10 0 ${u(7)}, #00000018 ${u(7)} ${u(13)});
      box-shadow: inset 0 ${u(-9)} 0 #0003, inset 0 ${u(7)} 0 #fff3, inset 0 0 0 ${u(3)} #e8b86a55, 0 ${u(4)} 0 #00000033;
    }
    .wd-tender::after { content: ''; position: absolute; inset: 0; border-radius: ${u(20)}; box-shadow: inset 0 0 ${u(14)} #2a160855; pointer-events: none; }
    .wd-tender .wd-badge { border-color: #e8b86a; color: #5a3a22; }
    .wd-tender-label { font-weight: 800; font-size: ${u(10)}; letter-spacing: ${u(1.2)}; color: #f0d29a; text-shadow: 0 ${u(1)} 0 #0004; margin-top: ${u(2)}; }
    .wd-tender-name { font-weight: 800; font-size: ${u(15)}; color: #fff; text-shadow: 0 ${u(2)} 0 #0003; margin-top: ${u(1)}; }
    .wd-tender.rt-car--departed { filter: grayscale(0.45) brightness(0.95); opacity: 0.82; }

    /* State treatments ride the shared .rt-car--* classes (live time tick). The
       Now / Spotlight rings re-use the inset stack so the wood texture survives.
       A handed-off Slot stays readable — a LIGHT dim + a PLAYED stamp, not heavy
       shade (viewer feedback): names/avatars must still read. */
    .wd-car.rt-car--departed { filter: grayscale(0.4) brightness(0.97); opacity: 0.82; }
    .wd-stamp {
      visibility: hidden; position: absolute; top: ${u(70)}; left: 50%;
      transform: translateX(-50%) rotate(-8deg); white-space: nowrap;
      font-weight: 800; font-size: ${u(13)}; letter-spacing: ${u(1.5)}; color: #5a360f;
      padding: ${u(2)} ${u(10)}; border-radius: ${u(4)};
      background: #f0d8a8e6; border: ${u(2)} solid #8a5a2b; box-shadow: 0 ${u(2)} ${u(4)} #0004, inset 0 ${u(1)} 0 #fff8;
      text-shadow: 0 ${u(1)} 0 #fff6;
    }
    .wd-car.rt-car--departed .wd-stamp { visibility: visible; }
    .wd-car.rt-car--current { box-shadow: inset 0 ${u(-9)} 0 #0002, inset 0 ${u(7)} 0 #fff5, 0 0 0 ${u(4)} #fbbf24, 0 ${u(4)} 0 #00000026; }
    .wd-car.rt-car--spotlit { box-shadow: inset 0 ${u(-9)} 0 #0002, inset 0 ${u(7)} 0 #fff5, 0 0 0 ${u(4)} #22d3ee, 0 ${u(4)} 0 #00000026; }
    .wd-car.rt-car--current.rt-car--spotlit { box-shadow: inset 0 ${u(-9)} 0 #0002, inset 0 ${u(7)} 0 #fff5, 0 0 0 ${u(4)} #fbbf24, 0 0 0 ${u(8)} #22d3ee, 0 ${u(4)} 0 #00000026; }

    /* Wooden-sleepers Track: a lighter rail head over an
       alternating sleeper gradient, sized in fractions of --rt-th (it lives
       outside .wd, so no --u here). Static. */
    .rt-rails-wood { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.16); }
    .rt-rails-wood::before, .rt-rails-wood::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-wood::before { top: 0; height: calc(var(--rt-th) * 0.025); background: #a87a45; }
    .rt-rails-wood::after {
      top: calc(var(--rt-th) * 0.025); bottom: 0;
      background: repeating-linear-gradient(90deg, #caa06a 0 calc(var(--rt-th) * 0.09), #8a5a2b calc(var(--rt-th) * 0.09) calc(var(--rt-th) * 0.12));
      box-shadow: inset 0 calc(var(--rt-th) * 0.01) 0 #fff3, inset 0 calc(var(--rt-th) * -0.01) 0 #0002;
    }

    @media (prefers-reduced-motion: reduce) {
      .wd-kid, .wd-leg { animation: none; }
    }
  `);
}

/** The decorative kid: an inline SVG figure (fixed viewBox coords; the wrapper
 *  scales in --u). Walks ahead of the Train pulling a dashed string. Rendered
 *  ONCE at the front; not a .rt-car, so it never undulates. */
function woodKid() {
  // The string starts at the kid's hand (the arm's far end, ~52,85 in viewBox
  // coords) and trails back-right toward the Engine behind, so it reads as the
  // kid pulling the Train (the mockup drew it detached from the hand).
  return `<div class="wd-kid"><svg width="80" height="150" viewBox="0 0 80 150">
    <path d="M 51 85 C 61 95, 71 106, 80 118" fill="none" stroke="#d8b06a" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 6"/>
    <g transform="translate(8,38)"><ellipse cx="16" cy="124" rx="14" ry="4" fill="#0002"/>
      <rect class="wd-leg wd-leg1" x="9" y="58" width="9" height="28" rx="4" fill="#3a5a8a"/>
      <rect class="wd-leg wd-leg2" x="18" y="58" width="9" height="28" rx="4" fill="#34507a"/>
      <circle cx="18" cy="16" r="13" fill="#f1c9a5"/><path d="M 6 12 a 12 12 0 0 1 24 0 l -2 -2 -4 3 -4 -3 -4 3 -4 -3 z" fill="#7a4a22"/>
      <rect x="8" y="30" width="20" height="30" rx="8" fill="#3f8fd0"/>
      <rect x="24" y="36" width="22" height="7" rx="3.5" fill="#f1c9a5" transform="rotate(20 24 39)"/></g></svg></div>`;
}

/** The time line for a vehicle. The engine now carries the first streamer's time
 *  (NOW during their Slot) like the Cars; "hop on! · <time>" for opens. */
function timeBlock(v) {
  if (v.isOpen) {
    const t = v.timeLines[0] ? ` · ${esc(v.timeLines[0])}` : '';
    return `${L('overlay.signUp')}${t}`;
  }
  return timeLinesHTML(v.timeLines);
}

/** One vehicle → its .rt-car wooden block. The engine now carries the first
 *  streamer with the NOW flag during their Slot; a departed Slot is
 *  lightly dimmed and stamped PLAYED for legibility (viewer feedback). */
function woodCar(v, i) {
  const isEngine = v.kind === 'engine';
  const structural = [
    isEngine ? 'wd-engine' : '',
    v.kind === 'caboose' ? 'wd-caboose' : '',
    v.isOpen ? 'wd-open' : '',
  ].filter(Boolean).join(' ');
  const cls = `rt-car wd-car ${structural} ${stateClasses(v)}`.replace(/\s+/g, ' ').trim();
  // The loco has no slotOrder key (it's the eternal leader, tracked separately);
  // its Now flag rides .rt-car--current from stateClasses like the Cars.
  const dataSlot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
  const wheels = `<div class="wd-wheels">${htmlWheel('wd-w')}${htmlWheel('wd-w')}</div>`;

  if (v.isOpen) {
    return `<div class="${cls}"${dataSlot}><div class="wd-badge wd-badge-open">+</div><div class="wd-name rt-fit">${esc(L('overlay.open'))}</div><div class="wd-time">${timeBlock(v)}</div>${wheels}</div>`;
  }

  const tint = isEngine ? ENGINE_TINT : WOOD_TINTS[i % WOOD_TINTS.length];
  const stack = isEngine ? '<div class="wd-stack"><span></span><span></span><span></span></div>' : '';
  // Now flag always present (engine included now); base CSS reveals .rt-pointer
  // only on the current Car, so the loco carries NOW during its streamer's Slot.
  const flag = `<div class="rt-pointer rt-now-bob wd-flag">${esc(L('overlay.now'))}</div>`;
  // ★ star always present; revealed by .rt-car--spotlit.
  const star = '<div class="wd-star">★</div>';
  const knots = '<div class="wd-knot k1"></div><div class="wd-knot k2"></div>';
  const badge = `<div class="wd-badge">${htmlAvatar(v)}</div>`;
  // PLAYED stamp: always in the DOM, revealed by .rt-car--departed (CSS). The loco
  // never carries a per-slot departed (stateClasses only dims it on isDimmed), so
  // it won't stamp until the Event ends.
  const stamp = `<div class="wd-stamp">${esc(L('overlay.played'))}</div>`;
  return `<div class="${cls}"${dataSlot} style="--tint:${tint}">${stack}${flag}${star}${knots}${badge}<div class="wd-name rt-fit">${esc(v.name)}</div><div class="wd-time">${timeBlock(v)}</div>${stamp}${wheels}</div>`;
}

/** The Organiser tender: a prominent credit car coupled behind the
 *  loco, a darker walnut block so it reads as a distinct car fuelling the train
 *  rather than another streamer Slot. "ORGANISED BY" + the organiser name on its
 *  OWN rt-fit line (so a long handle like "teknokat222" condenses to fit). */
function tenderCar(org) {
  const wheels = `<div class="wd-wheels">${htmlWheel('wd-w')}${htmlWheel('wd-w')}</div>`;
  const knots = '<div class="wd-knot k1"></div><div class="wd-knot k2"></div>';
  return `<div class="rt-car wd-car wd-tender" data-tender="1">`
    + `${knots}<div class="wd-badge">${htmlAvatar(org)}</div>`
    + `<div class="wd-tender-label">${esc(L('overlay.organisedBy'))}</div>`
    + `<div class="wd-tender-name rt-fit">${esc(org.name)}</div>`
    + `${wheels}</div>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const node = document.createElement('div');
  node.className = 'wd rt-theme-wood';

  // Layout: the kid at the FRONT, then the loco (first streamer), then the
  // Organiser tender right behind it (omitted when the Organiser is
  // already driving the loco — engine.organiser is null), then the Cars. Magnet
  // couplers between every unit.
  const engine = vehicles[0];
  const units = [woodCar(engine, 0)];
  if (engine?.organiser) units.push(tenderCar(engine.organiser));
  vehicles.slice(1).forEach((car, i) => units.push(woodCar(car, i + 1)));
  node.innerHTML = woodKid() + units.join('<div class="wd-mag"></div>');

  // Refs: Cars keyed by slotOrder; the Engine + tender tracked for the post-event
  // dim (the loco is the eternal leader, never keyed by a per-slot departed).
  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  node.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) {
      engineRef = { group, timeEl: group.querySelector('.wd-time') };
      return;
    }
    if (group.dataset.tender) {
      tenderEls.push(group);
      return;
    }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeEl: group.querySelector('.wd-time'), isOpen: group.classList.contains('wd-open') });
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

/** Stationary wooden-sleepers Track, placed behind the Train by the renderer. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-wood';
  // Rail head sits just below the wheels (the Car block is ~0.84 of --rt-th).
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.84)');
  return el;
}

export default { key: 'wood', ensureStyles, build, buildTrack };
