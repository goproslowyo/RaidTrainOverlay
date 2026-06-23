/**
 * ticket — Vintage Ticket Theme, one of the HTML/CSS roster.
 * Ported from the original art mockup, wired to the live Train view-model and
 * adapted for the Overlay the same way synthwave was:
 *
 *  - Sizes to the Train height via the unit token --u: every length
 *    inside the Theme root is calc(N * var(--u)) where --u = --rt-th / design-height,
 *    so the whole Theme scales with --rt-th (and the scale param) and the marquee
 *    width measurement stays correct in the same tick.
 *  - Car state rides the shared .rt-car--current / --departed / --spotlit classes
 *    (toggled by the renderer on a time tick), not build-time classes, so Now +
 *    Spotlight coexist and updates never rebuild. Structural classes
 *    (engine / caboose / open) are build-time. The mockup's tk-now / tk-spot /
 *    tk-punched build-time classes become CSS rules keyed off the shared state.
 *  - The loco shows the FIRST streamer, carrying their live state (the
 *    BOARDING stamp during their Slot, Spotlight, and the post-event dim) — it
 *    stays bright after their slot (eternal leader). The Organiser rides a
 *    prominent .tk-tender "season pass" credit card right behind it; a departed
 *    Slot is lightly dimmed and stamped PLAYED (legibility — viewer feedback).
 *  - The stamps (BOARDING / ★ VIP / PLAYED) and the Now ring are always present
 *    in the DOM and revealed by the state class, so a live tick re-styles in place.
 *    The Now-only BOARDING stamp uses the base .rt-pointer hook (hidden by base
 *    CSS, shown by .rt-car--current) — on the loco too, during the first slot.
 *  - The Track is the classic steel band (mockup track type "steel"): a thin grey
 *    rail head over brown ties, the same paint as flat's .rt-rails-flat, sized in
 *    fractions of --rt-th (it lives outside the root, so no --u there). Static, so
 *    no reduced-motion rule is needed.
 *
 * Transparent only — no full-bleed background. A cream ticket card with
 * a perforated stub, punch-holes, № + barcode, and a wax-stamp per state. The card
 * has no wheels in the mockup (it sits on the rail), so htmlWheel is omitted.
 */
import { fitAll, undulate, toVehicles, esc, themeT } from './shared-svg.js';
import { ensureHtmlShared, injectStyle, htmlAvatar, stateClasses, timeLinesHTML } from './shared-html.js';

// Translator the builders paint with — rebound to the active locale in build();
// it persists for the in-place update() ticks (same locale until a re-render).
let L = themeT();

const STYLE_ID = 'rt-theme-ticket-style';
// The ticket card is 104 design px tall. Mapping the full card to --rt-th made
// the tickets read oversized next to the other Themes (Steve's review), so the
// design height carries headroom: the card renders at ~0.63 of --rt-th and is
// bottom-anchored in the full --rt-th slot (.tk height below), so the stamps /
// punch overhang sit in the headroom above and the rail still meets the foot.
const DESIGN_H = 165;
const u = (n) => `calc(${n} * var(--u))`;

export function ensureStyles() {
  ensureHtmlShared();
  injectStyle(STYLE_ID, `
    .tk {
      --u: calc(var(--rt-th) / ${DESIGN_H});
      flex: none;
      display: flex;
      /* Full --rt-th slot, cards bottom-anchored — so the sub-full-height card
         sits on the rail (not floated up) and the overhang gets the headroom. */
      height: var(--rt-th);
      align-items: flex-end;
      gap: ${u(12)};
      font-family: 'Courier New', monospace;
    }
    .tk-card {
      position: relative; display: flex; width: ${u(218)}; height: ${u(104)};
      background: #f6ecd2; color: #3a2a14; border: 1px solid #c3a868;
      border-radius: ${u(7)}; overflow: hidden; box-shadow: 0 ${u(4)} ${u(10)} #0004;
    }
    .tk-card::after { content: ''; position: absolute; left: ${u(78)}; top: 0; bottom: 0; border-left: ${u(2)} dashed #c3a868; }

    .tk-stub { position: relative; width: ${u(80)}; flex: none; background: #ecdcb0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
    .tk-av { position: relative; width: ${u(58)}; height: ${u(58)}; flex: none; overflow: hidden; border: ${u(2)} solid #3a2a14; border-radius: ${u(3)}; background: #cdb784; color: #3a2a14; font-size: ${u(22)}; }
    .tk-no { position: absolute; bottom: ${u(5)}; left: 0; right: 0; text-align: center; font-size: ${u(8)}; letter-spacing: ${u(1)}; color: #6b4f24; }

    /* Punch-holes biting the stub edge. The hole reads "punched through" to the
       canvas behind — transparent so the backdrop (or nothing) shows. */
    .tk-punch { position: absolute; right: ${u(-7)}; width: ${u(14)}; height: ${u(14)}; border-radius: 50%; background: transparent; box-shadow: inset 0 0 0 ${u(2)} #c3a868; }
    .tk-punch.t { top: ${u(18)}; } .tk-punch.b { bottom: ${u(18)}; }

    .tk-main { position: relative; padding: ${u(11)} ${u(12)} ${u(8)}; display: flex; flex-direction: column; justify-content: center; gap: ${u(3)}; flex: 1; min-width: 0; }
    .tk-line { font-size: ${u(9)}; letter-spacing: ${u(1.5)}; color: #8a6d3b; }
    .tk-name { font-size: ${u(16)}; font-weight: 700; letter-spacing: ${u(0.5)}; }
    .tk-meta { font-size: ${u(11)}; color: #6b4f24; letter-spacing: ${u(1)}; }
    .tk-meta span { display: block; }
    .tk-barcode { height: ${u(14)}; margin-top: ${u(4)}; background: repeating-linear-gradient(90deg, #3a2a14 0 ${u(2)}, transparent ${u(2)} ${u(3)}, #3a2a14 ${u(3)} ${u(4)}, transparent ${u(4)} ${u(7)}); }

    /* Wax-stamp slots, always rendered, revealed by state. Distinct anchors so two
       stamps never collide (current+spotlit used to stack at top-right):
       the primary state stamp (BOARDING via the Now-only .rt-pointer hook, or PLAYED
       when departed — mutually exclusive) sits bottom-right over the barcode, on a
       light wax backing so the name still reads (viewer feedback); the ★ VIP
       spotlight accent tucks into the top-right corner, clear of the role label's
       short first line and of the state stamp. */
    .tk-stamp { position: absolute; z-index: 2; font-size: ${u(11)}; font-weight: 700; padding: ${u(2)} ${u(6)}; border: ${u(2)} solid; border-radius: ${u(3)}; transform: rotate(-8deg); letter-spacing: ${u(1)}; white-space: nowrap; }
    .tk-board, .tk-dep { right: ${u(10)}; bottom: ${u(9)}; }
    .tk-board { color: #b45309; border-color: #b45309; background: #fff7edcc; }
    /* PLAYED stamp: red ink on a light wax backing so it reads over the dimmed
       cream card without darkening the name beneath it (viewer feedback). */
    .tk-dep { color: #9b1c1c; border-color: #9b1c1c; background: #fff6f0cc; visibility: hidden; }
    .tk-vip { top: ${u(7)}; right: ${u(7)}; color: #0e7490; border-color: #0e7490; background: #ecfeffcc; visibility: hidden; }
    .tk-card.rt-car--spotlit .tk-vip { visibility: visible; }
    .tk-card.rt-car--departed .tk-dep { visibility: visible; }

    /* State treatments ride the shared .rt-car--* classes (live time tick). */
    .tk-card.rt-car--current { box-shadow: 0 0 0 ${u(3)} #fbbf24, 0 ${u(4)} ${u(10)} #0004; }
    .tk-card.rt-car--spotlit { box-shadow: 0 0 0 ${u(3)} #22d3ee, 0 ${u(4)} ${u(10)} #0004; }
    .tk-card.rt-car--current.rt-car--spotlit { box-shadow: 0 0 0 ${u(3)} #fbbf24, 0 0 0 ${u(6)} #22d3ee, 0 ${u(4)} ${u(10)} #0004; }
    /* A handed-off Slot stays readable — a light dim + a PLAYED stamp, not heavy
       shade (viewer feedback): the name + avatar must still read. */
    .tk-card.rt-car--departed { opacity: 0.82; filter: grayscale(0.2); }
    /* Departed: the two extra punch-bites on the stub appear with the state. */
    .tk-card.rt-car--departed .tk-stub::before, .tk-card.rt-car--departed .tk-stub::after { content: ''; position: absolute; width: ${u(13)}; height: ${u(13)}; border-radius: 50%; background: #00000022; box-shadow: inset 0 0 0 ${u(2)} #00000044; }
    .tk-card.rt-car--departed .tk-stub::before { top: ${u(24)}; left: ${u(12)}; }
    .tk-card.rt-car--departed .tk-stub::after { bottom: ${u(24)}; left: ${u(34)}; }

    /* Organiser tender: a prominent "season pass" credit coupled right
       behind the loco. A darker sepia card with a gold stub, so it reads as a
       distinct pass that credits the organiser rather than another streamer ticket.
       The avatar sits in the stub; "ORGANISED BY" + the name fill the main panel,
       the name on its OWN full-width rt-fit line (so a long handle condenses). */
    .tk-tender { background: #3a2a14; color: #f1dcad; border-color: #8a6d3b; }
    .tk-tender::after { border-left-color: #8a6d3b; }
    .tk-tender .tk-stub { background: #4a3618; }
    .tk-tender .tk-av { border-color: #d6b66a; background: #5a4322; color: #f1dcad; }
    .tk-tender .tk-no { color: #cba762; }
    .tk-tender-label { font-size: ${u(10)}; font-weight: 700; letter-spacing: ${u(2)}; color: #d6b66a; }
    .tk-tender-name { font-size: ${u(17)}; font-weight: 700; letter-spacing: ${u(0.5)}; color: #fbeccb; }
    .tk-tender .tk-barcode { background: repeating-linear-gradient(90deg, #d6b66a 0 ${u(2)}, transparent ${u(2)} ${u(3)}, #d6b66a ${u(3)} ${u(4)}, transparent ${u(4)} ${u(7)}); }
    /* The tender dims with the loco post-event (toggled by update()). */
    .tk-tender.rt-car--departed { opacity: 0.82; filter: grayscale(0.2); }

    /* Open Slot: dashed green frame, "+" stub. */
    .tk-open { background: #eef5ec; border-style: dashed; border-color: #37b24d; color: #246b33; }
    .tk-open::after { border-left-color: #37b24d; }
    .tk-stub-open { background: #dff0e1; font-size: ${u(38)}; color: #37b24d; }
    .tk-open .tk-line, .tk-open .tk-meta { color: #2f7d3f; }
    .tk-open .tk-barcode { background: repeating-linear-gradient(90deg, #37b24d 0 ${u(2)}, transparent ${u(2)} ${u(4)}); }

    /* Steel Track: a thin grey rail head with a light top
       highlight over brown ties, the same paint as flat's steel band, in our own
       fractions of --rt-th (it lives outside .tk, so no --u here). Static. */
    .rt-rails-ticket { top: var(--rt-rail-top); height: var(--rt-rail-h); }
    .rt-rails-ticket::before, .rt-rails-ticket::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-ticket::before { top: 0; height: calc(var(--rt-th) * 0.025); background: #9aa3ad; box-shadow: 0 -1px 0 #cfd6dd; }
    .rt-rails-ticket::after {
      top: calc(var(--rt-th) * 0.025); bottom: 0;
      background: repeating-linear-gradient(90deg, #6b4423 0 calc(var(--rt-th) * 0.05), transparent calc(var(--rt-th) * 0.05) calc(var(--rt-th) * 0.11));
    }
  `);
}

/** The stationary steel Track, placed behind the Train by the renderer.
 *  The card sits with its base on the rail line; the rail head sits just below it. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-ticket';
  // The card body fills the Train height (DESIGN_H), so the rail head sits right
  // at the card's foot; a small band of ties below it.
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.97)');
  el.style.setProperty('--rt-rail-h', 'calc(var(--rt-th) * 0.16)');
  return el;
}

/** The kind label for a vehicle's ticket line (LOCOMOTIVE / CABOOSE / COACH n). */
function kindLabel(v) {
  if (v.kind === 'engine') return 'LOCOMOTIVE';
  if (v.kind === 'caboose') return 'CABOOSE';
  return `COACH ${v.slotOrder}`;
}

/** The meta block (DEP <time> stacked). The engine now carries the first
 *  streamer's time (DEP {time} / NOW during their Slot), like the coaches. */
function metaBlock(v) {
  if (v.isOpen) {
    const t = v.timeLines[0] ? ` · ${esc(v.timeLines[0])}` : '';
    return `<span>${esc(L('overlay.signUp').toUpperCase())}${t.toUpperCase()}</span>`;
  }
  return timeLinesHTML((v.timeLines ?? []).map((l) => `DEP ${l.toUpperCase()}`));
}

/** One vehicle → its .rt-car ticket card. */
function ticketCar(v) {
  const structural = [
    v.kind === 'engine' ? 'tk-engine' : '',
    v.kind === 'caboose' ? 'tk-caboose' : '',
    v.isOpen ? 'tk-open' : '',
  ].filter(Boolean).join(' ');
  const cls = `rt-car tk-card ${structural} ${stateClasses(v)}`.replace(/\s+/g, ' ').trim();
  // The loco has no slotOrder key (it's the eternal leader, tracked separately);
  // its BOARDING stamp rides .rt-pointer + .rt-car--current from stateClasses.
  const dataSlot = v.kind === 'engine' ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;

  if (v.isOpen) {
    const stub = `<div class="tk-stub tk-stub-open"><div class="tk-punch t"></div><div class="tk-punch b"></div>+</div>`;
    const main = `<div class="tk-main"><div class="tk-line">RAID TRAIN · COACH</div><div class="tk-name rt-fit">${esc(L('overlay.open'))}</div><div class="tk-meta">${metaBlock(v)}</div><div class="tk-barcode"></div></div>`;
    return `<div class="${cls}"${dataSlot}>${stub}${main}</div>`;
  }

  // Stamps: always present, revealed by state. BOARDING rides the base .rt-pointer
  // hook (Now only). VIP / PUNCHED are revealed by --spotlit / --departed in CSS.
  const stamps =
    `<div class="rt-pointer tk-stamp tk-board">${esc(L('status.boarding'))}</div>` +
    `<div class="tk-stamp tk-vip">★ VIP</div>` +
    `<div class="tk-stamp tk-dep">${esc(L('overlay.played'))}</div>`;
  // ticket № from the vehicle index along the lineup.
  const no = String(1013 + v.no * 7);
  const stub = `<div class="tk-stub"><div class="tk-punch t"></div><div class="tk-punch b"></div><div class="tk-av">${htmlAvatar(v)}</div><div class="tk-no">№ ${no}</div></div>`;
  const main = `<div class="tk-main"><div class="tk-line">RAID TRAIN · ${kindLabel(v)}</div><div class="tk-name rt-fit">${esc(v.name)}</div><div class="tk-meta">${metaBlock(v)}</div><div class="tk-barcode"></div></div>`;
  return `<div class="${cls}"${dataSlot}>${stamps}${stub}${main}</div>`;
}

/** The Organiser tender: a prominent "season pass" credit card coupled
 *  behind the loco. "ORGANISED BY" + the organiser name on its OWN rt-fit line, so
 *  a long handle like "teknokat222" condenses to fit rather than clipping. */
function tenderCar(org) {
  const stub = `<div class="tk-stub"><div class="tk-punch t"></div><div class="tk-punch b"></div><div class="tk-av">${htmlAvatar(org)}</div><div class="tk-no">SEASON PASS</div></div>`;
  const main = `<div class="tk-main"><div class="tk-tender-label">${esc(L('overlay.organisedBy'))}</div><div class="tk-tender-name rt-fit">${esc(org.name)}</div><div class="tk-barcode"></div></div>`;
  return `<div class="rt-car tk-card tk-tender" data-tender="1">${stub}${main}</div>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  vehicles.forEach((v, i) => { v.no = i; });
  const node = document.createElement('div');
  node.className = 'tk rt-theme-ticket';

  // Layout units: the loco (first streamer), then the Organiser tender right
  // behind it (omitted when the Organiser is already driving the loco
  // — engine.organiser is null), then the Cars.
  const engine = vehicles[0];
  // Only treat vehicles[0] as the loco when it really IS the Engine: post-event the
  // Engine is dropped, so vehicles[0] may be a Car (or absent) — ticketCar(undefined) throws.
  const hasEngine = engine?.kind === 'engine';
  const units = hasEngine ? [ticketCar(engine)] : [];
  if (hasEngine && engine.organiser) units.push(tenderCar(engine.organiser));
  for (const car of vehicles.slice(hasEngine ? 1 : 0)) units.push(ticketCar(car));
  node.innerHTML = units.join('');

  // Refs: Cars keyed by slotOrder; the Engine + tender tracked for the post-event
  // dim (the loco is the eternal leader, never keyed by a per-slot departed).
  const carRefs = new Map();
  let engineRef = null;
  const tenderEls = [];
  node.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) {
      engineRef = { group, timeEl: group.querySelector('.tk-meta') };
      return;
    }
    if (group.dataset.tender) {
      tenderEls.push(group);
      return;
    }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeEl: group.querySelector('.tk-meta'), isOpen: group.classList.contains('tk-open') });
  });

  return {
    node,
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          ref.group.classList.toggle('rt-car--current', car.isCurrent);
          ref.group.classList.toggle('rt-car--departed', car.isDeparted);
          ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
          if (ref.timeEl) ref.timeEl.innerHTML = metaBlock({ isOpen: ref.isOpen, timeLines: car.timeLines ?? [car.relativeTime] });
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
        if (engineRef.timeEl) engineRef.timeEl.innerHTML = metaBlock({ isOpen: false, timeLines: eng.timeLines ?? [eng.relativeTime ?? ''] });
      }
      for (const el of tenderEls) el.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
    },
    afterAttach() {
      fitAll(node);
      undulate(node);
    },
  };
}

export default { key: 'ticket', ensureStyles, build, buildTrack };
