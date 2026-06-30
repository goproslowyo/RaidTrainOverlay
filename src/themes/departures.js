/**
 * departures — split-flap Departures Board Theme of the roster. Each
 * vehicle is a station sign (split-flap board) mounted on two posts atop a
 * wheeled flat wagon. Ported from the original art mockup, wired to the live
 * Train view-model and adapted for the Overlay:
 *
 *  - Sizes to the Train height via the unit token --u: every length
 *    is calc(N * var(--u)) where --u = --rt-th / design-height, so the whole
 *    assembly (board + posts + wagon + wheels) scales with --rt-th and the
 *    marquee width measurement stays correct in the same tick.
 *  - Car state rides the shared .rt-car--current / --departed / --spotlit classes
 *    (toggled by the renderer on a time tick), NOT build-time dp-now/dp-dep, so
 *    Now + Spotlight coexist and a live tick re-styles the status lamp
 *    and flap colour in place without a rebuild. Structural classes
 *    (engine / caboose / open) are build-time.
 *  - The loco board shows the FIRST streamer, given a distinct lead
 *    treatment (a "● DEPARTURES" header strip + a gold-lit frame + a little funnel
 *    silhouette on its base) so it reads as the head of the train — Steve noted
 *    departures had no engine. It carries the streamer's live state (BOARDING /
 *    Spotlight) and dims only post-event (isDimmed), staying bright as the eternal
 *    leader. The Organiser rides a prominent amber .dp-tender "STAFF" board coupled
 *    right behind it; a departed Slot is lightly dimmed and stamped PLAYED.
 *  - The status lamp + status text read ON TIME / BOARDING / DEPARTED / OPEN; the
 *    lamp colour is driven entirely by the shared state classes.
 *  - The split-flap letters flip on a staggered, compositor-friendly transform
 *    keyframe (scaleY), disabled under reduced-motion. They render once
 *    from the name; a time tick rewrites only the time + status (names don't change).
 *  - The Track is a thin dark rail band (mockup .trk--dep): stationary, full-width,
 *    sized in fractions of --rt-th, painted behind the Train.
 *
 * Transparent only — no full-bleed background.
 */
import { fitAll, undulate, toVehicles, esc, themeT } from './shared-svg.js';
import { ensureHtmlShared, injectStyle, htmlAvatar, htmlWheel, stateClasses } from './shared-html.js';

// Translator the builders paint with — rebound to the active locale in build();
// it persists for the in-place update() ticks (same locale until a re-render).
let L = themeT();

const STYLE_ID = 'rt-theme-departures-style';
// The full assembly is ≈110 design px (board 70 + posts 14 + wagon 14 + wheel
// overhang 11). Mapping that to --rt-th made the wide boards read oversized and
// crowd their neighbours (Steve's review), so the design height carries headroom:
// the assembly renders at ~0.71 of --rt-th, bottom-anchored in the full slot.
const DESIGN_H = 155;
const u = (n) => `calc(${n} * var(--u))`;

export function ensureStyles() {
  ensureHtmlShared();
  injectStyle(STYLE_ID, `
    .dp {
      --u: calc(var(--rt-th) / ${DESIGN_H});
      --rt-ride: 0.72;  /* Ride character: tight — mounted boards barely sway. */
      flex: none;
      display: flex;
      /* Full --rt-th slot, assemblies bottom-anchored so the shrunk boards sit on
         the rail. A wider gap keeps the wide boards (+ their shadows) from
         crowding into each other (Steve's review: they looked overlapped). */
      height: var(--rt-th);
      align-items: flex-end;
      gap: ${u(20)};
      font-family: 'Courier New', monospace;
    }
    .dp-car { display: flex; flex-direction: column; align-items: center; width: ${u(234)}; }
    .dp-board {
      position: relative;
      /* border-box so the padding + frame stay INSIDE the 234u car slot. */
      box-sizing: border-box;
      display: flex; align-items: center; gap: ${u(10)}; width: 100%;
      padding: ${u(10)} ${u(12)};
      /* A premium brushed-metal board: a vertical metal gradient in a bevelled frame
         (light top edge + inset bottom shadow) with a drop shadow. */
      background: linear-gradient(#2c2f38, #1b1d24);
      border: ${u(1)} solid #4a5062; border-radius: ${u(7)};
      box-shadow: inset 0 ${u(1.5)} 0 #ffffff2e, inset 0 ${u(-3)} ${u(5)} #00000088, 0 ${u(3)} ${u(7)} #0009;
    }
    .dp-photo {
      position: relative; width: ${u(50)}; height: ${u(50)}; flex: none;
      border: ${u(2)} solid #4a5060; border-radius: ${u(3)}; overflow: hidden;
      background: #333844; color: #ffd56b; font-weight: 700; font-size: ${u(20)};
    }
    .dp-rows { flex: 1; min-width: 0; }
    .dp-name {
      background: #0c0e12; border-radius: ${u(4)}; padding: ${u(3)} ${u(4)};
      display: flex; gap: ${u(1)}; white-space: nowrap; overflow: hidden; font-size: ${u(16)};
      box-shadow: inset 0 0 ${u(6)} #000c, inset 0 0 0 ${u(1)} #00000099;
    }
    /* Each character is a split-flap TILE: a 2-tone box (lighter top flap, darker
       bottom) split by the centre seam, with a subtle bevel — so the name reads as a
       real flap display, not glowing text. Sizes in em so rt-fit can shrink it. */
    .dp-flap {
      position: relative; display: inline-block; min-width: 0.66em; text-align: center;
      color: #ffd86b; font-weight: 700; font-size: 1em;
      background: linear-gradient(#3a3d46 0 49%, #1a1c22 51% 100%); border-radius: ${u(2)};
      box-shadow: inset 0 0 0 ${u(0.5)} #000000aa, inset 0 ${u(1)} 0 #ffffff1f;
      text-shadow: 0 0 ${u(4)} #ffce5c66; margin: 0 0.04em;
      animation: dp-flip 6s linear infinite; transform-origin: center;
    }
    .dp-flap::after { content: ''; position: absolute; left: ${u(1)}; right: ${u(1)}; top: 50%; height: ${u(1)}; background: #000c; transform: translateY(-50%); }
    .dp-meta { display: flex; justify-content: space-between; margin-top: ${u(5)}; font-size: ${u(10)}; letter-spacing: ${u(1)}; }
    .dp-time { color: #bcd0e4; }
    .dp-status { color: #8a93a3; }
    .dp-lamp { width: ${u(12)}; height: ${u(12)}; border-radius: 50%; flex: none; align-self: flex-start; margin-top: ${u(2)}; }
    .dp-posts { display: flex; justify-content: space-between; width: ${u(120)}; height: ${u(14)}; }
    .dp-posts i { width: ${u(5)}; background: #3c4150; box-shadow: inset ${u(1)} 0 0 #5a6072; }
    .dp-wagon {
      width: ${u(200)}; height: ${u(14)}; background: linear-gradient(#3c4150, #23262e);
      border: ${u(1)} solid #4a5060; border-radius: ${u(3)};
      display: flex; align-items: flex-end; justify-content: center;
    }
    .dp-wheels { display: flex; gap: ${u(54)}; margin-bottom: ${u(-11)}; }
    .dp-w { width: ${u(18)}; height: ${u(18)}; background: #0e1014; box-shadow: inset 0 0 0 ${u(3)} #5a6072; --spk: #8a93a3; }

    /* Header strip (loco "● DEPARTURES" / tender "STAFF" caption) above a board. */
    .dp-cap {
      width: 100%; box-sizing: border-box; margin-bottom: ${u(4)};
      padding: ${u(2)} ${u(8)}; border-radius: ${u(4)} ${u(4)} 0 0;
      font-weight: 800; font-size: ${u(10)}; letter-spacing: ${u(2)};
      text-align: center; white-space: nowrap;
    }

    /* "up" (ON TIME) is the default lamp — amber. */
    .dp-lamp { background: #ffae3b; box-shadow: 0 0 ${u(8)} #ffae3b88; }

    /* Engine = first streamer, the lead board. Distinct from the coaches:
       a gold-lit frame, a "● DEPARTURES" header strip, and a small loco/funnel
       silhouette on its wheeled base, so it reads as the head of the train. */
    .dp-engine .dp-cap { background: linear-gradient(#ffce5c, #f1a93b); color: #2a1c08; box-shadow: 0 0 ${u(8)} #ffae3b66; }
    .dp-engine .dp-board { border-color: #f1b40a; box-shadow: inset 0 ${u(1)} 0 #ffffff2a, 0 0 ${u(12)} #ffae3b55, 0 ${u(2)} ${u(6)} #0006; }
    .dp-engine .dp-photo { border-color: #f1b40a; }
    .dp-loco { position: relative; width: ${u(40)}; height: ${u(14)}; margin-right: ${u(8)}; }
    .dp-loco::before { content: ''; position: absolute; left: 0; bottom: 0; width: ${u(40)}; height: ${u(11)}; background: #1c1c1c; border-radius: ${u(2)} ${u(5)} ${u(2)} ${u(2)}; }
    .dp-loco::after { content: ''; position: absolute; left: ${u(6)}; top: 0; width: ${u(7)}; height: ${u(8)}; background: #1c1c1c; border-radius: ${u(2)} ${u(2)} 0 0; }

    /* Open Slot: dashed green frame, green letters + lamp. */
    .dp-open .dp-board { border-style: dashed; border-color: #3ec46a; }
    .dp-open .dp-flap { color: #8ef0a8; text-shadow: none; }
    .dp-open .dp-lamp { background: #3ec46a; box-shadow: 0 0 ${u(9)} #3ec46a; }
    .dp-open .dp-status { color: #8ef0a8; }

    /* Organiser tender: a prominent amber "STAFF" credit board coupled
       right behind the loco. Distinct from the streamer coaches — warm amber frame
       + "ORGANISED BY" caption — so it reads as crediting the organiser, not as
       another Slot. The name gets its OWN full-width rt-fit line so a long handle
       (e.g. "teknokat222") condenses to fit rather than clipping. */
    .dp-tender .dp-cap { background: linear-gradient(#ffd98a, #e8a23a); color: #2a1c08; }
    .dp-tender .dp-board { background: #2a2114; border-color: #c8923a; box-shadow: inset 0 ${u(1)} 0 #ffffff1a, 0 0 ${u(10)} #c8923a44, 0 ${u(2)} ${u(6)} #0006; }
    .dp-tender .dp-photo { border-color: #c8923a; color: #ffd98a; }
    .dp-tender-label { font-weight: 800; font-size: ${u(9)}; letter-spacing: ${u(1.5)}; color: #ffd98a; }
    .dp-tender-name { display: block; width: 100%; font-weight: 800; font-size: ${u(16)}; color: #fff3da; letter-spacing: ${u(0.5)}; white-space: nowrap; overflow: hidden; }
    .dp-tender.rt-car--departed .dp-board { opacity: 0.82; }

    /* State treatments ride the shared .rt-car--* classes (live time tick):
       BOARDING = green pulsing lamp; DEPARTED = a LIGHT dim (0.82, viewer feedback:
       names/avatars must still read) + red status + a PLAYED stamp; Spotlight =
       cyan ring + lamp glow. */
    .dp-car.rt-car--current .dp-lamp { background: #3ee06a; box-shadow: 0 0 ${u(10)} #3ee06a; animation: rt-pulse 1.3s ease-in-out infinite; }
    .dp-car.rt-car--current .dp-status { color: #3ee06a; }
    .dp-car.rt-car--departed .dp-board { opacity: 0.82; }
    .dp-car.rt-car--departed .dp-status { color: #d6675e; }
    .dp-car.rt-car--departed .dp-flap { color: #b9bdc7; text-shadow: none; }
    .dp-car.rt-car--spotlit .dp-board { border-color: #22d3ee; box-shadow: inset 0 ${u(1)} 0 #ffffff1a, 0 0 ${u(12)} #22d3ee88; }
    .dp-car.rt-car--spotlit .dp-photo { border-color: #22d3ee; }
    .dp-car.rt-car--spotlit .dp-lamp { background: #22d3ee; box-shadow: 0 0 ${u(10)} #22d3ee; }

    /* PLAYED stamp: always in the DOM, revealed by .rt-car--departed (CSS). A
       split-flap-style tag angled over the board — readable, doesn't bury the name
       (sits on the photo's top-left corner). The loco never stamps until the Event
       ends (its departed rides isDimmed, not a per-slot departed). */
    .dp-stamp {
      visibility: hidden; position: absolute; top: ${u(-6)}; left: ${u(-6)};
      transform: rotate(-9deg); white-space: nowrap;
      font-weight: 800; font-size: ${u(11)}; letter-spacing: ${u(1.5)}; color: #ffd0d0;
      padding: ${u(1)} ${u(6)}; border-radius: ${u(3)};
      background: #2a0a0acc; border: ${u(1.5)} solid #ff9a9a; box-shadow: 0 0 ${u(8)} #d6675e88;
    }
    .dp-car.rt-car--departed .dp-stamp { visibility: visible; }

    /* The flap flip is a pure compositor scaleY — no per-frame filter. (Dropped a
       brightness(1.6) pop at the flip apex: it re-rasterized the filtered text every
       frame of the flip, on every letter of every car, against the no-per-frame-filter
       OBS mandate, for a highlight barely visible at speed.) */
    @keyframes dp-flip { 0%,92%,100% { transform: none; } 94% { transform: scaleY(.1); } 96% { transform: scaleY(1); } }

    /* Thin dark rail band Track (mockup .trk--dep): stationary, full-width,
       sized in fractions of --rt-th (it lives outside .dp, so no --u here). */
    .rt-rails-departures { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.04); }
    .rt-rails-departures::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0;
      height: calc(var(--rt-th) * 0.036); background: #2a2d35;
    }

    @media (prefers-reduced-motion: reduce) { .dp-flap { animation: none; } }
  `);
}

/** Stationary thin dark rail band, placed behind the Train by the renderer. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-departures';
  // Rail sits just below the wheels (the wheels hang ~0.1 of --rt-th below the wagon).
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.95)');
  return el;
}

/** The status word for a vehicle's role/state (driven visually by the shared classes).
 *  The engine is the first streamer now, so it reads the same words as a
 *  coach — DEPARTED only post-event (isDimmed), BOARDING during their Slot. */
function statusText(v) {
  if (v.kind === 'engine') {
    if (v.isDimmed) return L('status.departed');   // the Event is over
    if (v.isCurrent) return L('status.boarding');  // the first streamer's Slot is live
    if (v.isDeparted) return L('status.lead');     // played their Slot, still heads the
                                                   // train — "ON TIME" read wrong here
    return L('status.onTime');                     // upcoming — before their Slot
  }
  if (v.isOpen) return L('overlay.open');     // unbooked — stays OPEN even once its time passes
  if (v.isDeparted) return L('status.departed');
  if (v.isCurrent) return L('status.boarding');
  return L('status.onTime');
}

/** The time-cell text: the first streamer's time line on the loco too (NOW during
 *  their Slot), like the coaches; uppercased. */
function timeText(v) {
  return esc((v.timeLines[0] || '').toUpperCase());
}

/** Split-flap letters from a name (staggered flip via per-letter animation-delay). */
function flapsHTML(name, idx) {
  return [...esc(name || L('overlay.open')).toUpperCase()]
    .map((ch, k) => `<span class="dp-flap" style="animation-delay:${(-(idx * 0.3 + k * 0.12)).toFixed(2)}s">${ch === ' ' ? '&nbsp;' : ch}</span>`)
    .join('');
}

/** One vehicle → its .rt-car div (board + posts + wheeled wagon). The engine (first
 *  streamer) gets the distinct lead treatment: a "● DEPARTURES" header
 *  strip and a little loco/funnel silhouette on its base. */
function depCar(v, idx) {
  const isEngine = v.kind === 'engine';
  const structural = [
    isEngine ? 'dp-engine' : '',
    v.kind === 'caboose' ? 'dp-caboose' : '',
    v.isOpen ? 'dp-open' : '',
  ].filter(Boolean).join(' ');
  const cls = `rt-car dp-car ${structural} ${stateClasses(v)}`.replace(/\s+/g, ' ').trim();
  // The loco is the eternal leader (tracked separately, no slotOrder key); coaches
  // key by slotOrder. Its NOW + dim ride .rt-car--* from stateClasses.
  const dataSlot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
  const cap = isEngine ? `<div class="dp-cap">● ${esc(L('departures.header'))}</div>` : '';
  // PLAYED stamp: always in the DOM, revealed by .rt-car--departed (CSS). Sits on
  // the board itself (the .dp-photo is overflow:hidden), angled over its top-left.
  const stamp = v.isOpen ? '' : `<div class="dp-stamp">${esc(L('overlay.played'))}</div>`;
  const board =
    `<div class="dp-board">` +
      stamp +
      `<div class="dp-photo">${htmlAvatar(v)}</div>` +
      `<div class="dp-rows">` +
        `<div class="dp-name rt-fit">${flapsHTML(v.name, idx)}</div>` +
        `<div class="dp-meta"><span class="dp-time">${timeText(v)}</span><span class="dp-status">${statusText(v)}</span></div>` +
      `</div>` +
      `<div class="dp-lamp"></div>` +
    `</div>`;
  const posts = `<div class="dp-posts"><i></i><i></i></div>`;
  // The loco base carries a small funnel silhouette so it reads as the lead engine.
  const loco = isEngine ? `<div class="dp-loco"></div>` : '';
  const wagon = `<div class="dp-wagon">${loco}<div class="dp-wheels">${htmlWheel('dp-w')}${htmlWheel('dp-w')}${htmlWheel('dp-w')}</div></div>`;
  return `<div class="${cls}"${dataSlot}>${cap}${board}${posts}${wagon}</div>`;
}

/** The Organiser tender: a prominent amber "STAFF" credit board coupled
 *  behind the loco. "ORGANISED BY" + the organiser name on its OWN full-width rt-fit
 *  line, so a long handle (e.g. "teknokat222") condenses to fit rather than clipping. */
function tenderCar(org) {
  const board =
    `<div class="dp-board">` +
      `<div class="dp-photo">${htmlAvatar(org)}</div>` +
      `<div class="dp-rows">` +
        `<div class="dp-tender-label">${esc(L('overlay.organisedBy'))}</div>` +
        `<div class="dp-tender-name rt-fit">${esc(org.name)}</div>` +
      `</div>` +
    `</div>`;
  const posts = `<div class="dp-posts"><i></i><i></i></div>`;
  const wagon = `<div class="dp-wagon"><div class="dp-wheels">${htmlWheel('dp-w')}${htmlWheel('dp-w')}${htmlWheel('dp-w')}</div></div>`;
  return `<div class="rt-car dp-car dp-tender" data-tender="1"><div class="dp-cap">${esc(L('overlay.staff'))}</div>${board}${posts}${wagon}</div>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const node = document.createElement('div');
  node.className = 'dp rt-theme-departures';

  // Layout units: the loco (first streamer), then the Organiser tender right behind
  // it (omitted when the Organiser is already driving the loco —
  // engine.organiser is null), then the Cars.
  const engine = vehicles[0];
  // Only treat vehicles[0] as the loco when it really IS the Engine: post-event the
  // Engine is dropped, so vehicles[0] may be a Car (or absent) — depCar(undefined) throws.
  const hasEngine = engine?.kind === 'engine';
  const units = hasEngine ? [depCar(engine, 0)] : [];
  if (hasEngine && engine.organiser) units.push(tenderCar(engine.organiser));
  vehicles.slice(hasEngine ? 1 : 0).forEach((car, i) => units.push(depCar(car, i + (hasEngine ? 1 : 0))));
  node.innerHTML = units.join('');

  // Refs: Cars keyed by slotOrder; the Engine + tender tracked for the post-event
  // dim (the loco is the eternal leader, never keyed by a per-slot departed).
  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  node.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) {
      engineRef = {
        group,
        timeEl: group.querySelector('.dp-time'),
        statusEl: group.querySelector('.dp-status'),
      };
      return;
    }
    if (group.dataset.tender) {
      tenderEls.push(group);
      return;
    }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({
      group,
      timeEl: group.querySelector('.dp-time'),
      statusEl: group.querySelector('.dp-status'),
      isOpen: group.classList.contains('dp-open'),
    });
  });

  return {
    node,
    update(nextTrain) {
      // Toggle state classes + rewrite the time/status cells per slot. Names don't
      // change on a time tick, so the flap letters are left intact (never rebuilt).
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          ref.group.classList.toggle('rt-car--current', car.isCurrent);
          ref.group.classList.toggle('rt-car--departed', car.isDeparted);
          ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
          const vm = {
            kind: 'car',
            isOpen: ref.isOpen,
            isCurrent: car.isCurrent,
            isDeparted: car.isDeparted,
            timeLines: car.timeLines ?? [car.relativeTime],
          };
          if (ref.timeEl) ref.timeEl.innerHTML = timeText(vm);
          if (ref.statusEl) ref.statusEl.textContent = statusText(vm);
        }
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        // The loco shows the first streamer's live state — BOARDING + Spotlight
        // during their Slot — but dims only post-event (isDimmed), never on their
        // per-slot departed, so it stays bright as the eternal leader.
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        const evm = {
          kind: 'engine',
          isCurrent: eng.isCurrent,
          isDeparted: eng.isDeparted,  // so the lead reads LEAD (not ON TIME) post-Slot
          isDimmed: eng.isDimmed,
          timeLines: eng.timeLines ?? [eng.relativeTime ?? ''],
        };
        if (engineRef.timeEl) engineRef.timeEl.innerHTML = timeText(evm);
        if (engineRef.statusEl) engineRef.statusEl.textContent = statusText(evm);
      }
      for (const el of tenderEls) el.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
    },
    afterAttach() {
      fitAll(node);
      undulate(node);
    },
  };
}

export default { key: 'departures', ensureStyles, build, buildTrack };
