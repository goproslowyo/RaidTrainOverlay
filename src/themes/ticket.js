/**
 * ticket2 — ticket, polished in place. Same composition as the shipped theme
 * (wide cream tickets riding a plank track: left avatar stub, perforated
 * divider, RAID TRAIN header, big name, DEP time, barcode, serial) with craft
 * upgrades: real scalloped stub notches, aged-paper shading, a punched hole
 * per stub, an over-inked PLAYED stamp, and a lifted live ticket. HTML/CSS.
 */
import { fitAll, undulate, toVehicles, esc, themeT } from './shared-svg.js';
import { ensureHtmlShared, injectStyle, htmlAvatar, stateClasses, timeLinesHTML } from './shared-html.js';

let L = themeT();

const STYLE_ID = 'rt-theme-ticket2-style';
const DESIGN_H = 122;
const u = (n) => `calc(${n} * var(--u))`;
const STOCK = '#f4ecd9';

export function ensureStyles(doc) {
  ensureHtmlShared(doc);
  injectStyle(doc, STYLE_ID, `
    .tk2 {
      --u: calc(var(--rt-th) / ${DESIGN_H});
      --rt-ride: 0.5;
      flex: none; display: flex; align-items: flex-end; gap: ${u(12)};
      height: calc(${DESIGN_H} * var(--u));
      font-family: 'DM Mono', ui-monospace, monospace;
    }
    /* Ticket: wide, notched at the perforation line (radial masks each side). */
    .tk2-car {
      position: relative; display: flex; align-items: stretch;
      width: ${u(172)}; height: ${u(74)}; box-sizing: border-box;
      color: #3a3226;
      background:
        radial-gradient(circle at var(--notch) 0, transparent ${u(7)}, var(--stock, ${STOCK}) ${u(7.5)}) top / 100% 51% no-repeat,
        radial-gradient(circle at var(--notch) 100%, transparent ${u(7)}, var(--stock, ${STOCK}) ${u(7.5)}) bottom / 100% 51% no-repeat;
      --notch: ${u(52)};
      filter: drop-shadow(0 ${u(2)} ${u(3)} #00000052);
    }
    /* aged paper: edge tint + fibre lines */
    .tk2-car::after { content: ''; position: absolute; inset: 0; pointer-events: none; opacity: .6;
      background:
        repeating-linear-gradient(0deg, #00000005 0 ${u(2)}, transparent ${u(2)} ${u(5)}),
        linear-gradient(90deg, #c9b98e55 0, transparent ${u(10)}, transparent calc(100% - ${u(10)}), #c9b98e55 100%),
        linear-gradient(#fff9 0, transparent ${u(10)}, transparent calc(100% - ${u(8)}), #c9b98e66 100%); }

    /* left stub: avatar + punch hole, ends at the perforation */
    .tk2-stub { position: relative; width: ${u(52)}; flex: none; display: flex; align-items: center; justify-content: center;
      border-right: ${u(1.5)} dashed #a89a78; }
    .tk2-badge { width: ${u(36)}; height: ${u(36)}; border-radius: 50%; overflow: hidden; background: #fff;
      border: ${u(2)} solid #7a6a48; box-shadow: 0 0 0 ${u(3)} #f4ecd9, 0 0 0 ${u(4.5)} #a89a78;
      color: #6d5433; font-weight: 700; font-size: ${u(18)}; }
    .tk2-punch { position: absolute; bottom: ${u(6)}; left: ${u(8)}; width: ${u(7)}; height: ${u(7)}; border-radius: 50%;
      background: #23201a; box-shadow: inset 0 ${u(1)} ${u(1)} #000c, 0 ${u(1)} 0 #fff8; }

    .tk2-main { position: relative; flex: 1; padding: ${u(6)} ${u(9)} ${u(5)}; display: flex; flex-direction: column; min-width: 0; }
    .tk2-head { font-size: ${u(7)}; letter-spacing: ${u(1.4)}; text-transform: uppercase; color: #8a7a58; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tk2-name { font-family: 'Public Sans', system-ui, sans-serif; font-weight: 800; font-size: ${u(12.5)}; line-height: 1.12; margin-top: ${u(2)}; color: #2e2818; }
    .tk2-time { font-size: ${u(8.5)}; letter-spacing: ${u(1.4)}; text-transform: uppercase; color: #6d5f42; margin-top: ${u(2)}; }
    .tk2-foot { margin-top: auto; display: flex; align-items: flex-end; gap: ${u(10)}; }
    /* barcode: irregular bars via layered repeating gradients */
    .tk2-barcode { height: ${u(10)}; flex: 1; max-width: ${u(62)};
      background:
        repeating-linear-gradient(90deg, #2e2818 0 ${u(1.5)}, transparent ${u(1.5)} ${u(4)}),
        repeating-linear-gradient(90deg, #2e2818 0 ${u(1)}, transparent ${u(1)} ${u(6.5)});
      opacity: .85; }
    .tk2-serial { font-size: ${u(7.5)}; letter-spacing: ${u(1.4)}; color: #8a7a58; white-space: nowrap; }

    .tk2-flag { position: absolute; top: ${u(-15)}; left: 50%; transform: translateX(-50%); z-index: 2; background: #e9b93c; color: #4a3110; font-weight: 700; font-size: ${u(9.5)}; letter-spacing: ${u(1)}; padding: ${u(2)} ${u(8)}; border-radius: ${u(3)}; white-space: nowrap; box-shadow: 0 ${u(2)} 0 #0005; font-family: 'Public Sans', sans-serif; }

    .tk2-stamp { visibility: hidden; position: absolute; right: ${u(12)}; bottom: ${u(10)}; z-index: 2;
      transform: rotate(-10deg);
      font-family: 'Public Sans', sans-serif; font-weight: 800; font-size: ${u(11.5)}; letter-spacing: ${u(2.5)}; color: #b03a34;
      padding: ${u(1.5)} ${u(7)}; border: ${u(2)} solid #b03a34; border-radius: ${u(3)};
      background: #f4ecd9cc; opacity: .9; box-shadow: inset 0 0 0 ${u(1)} #b03a3444; }
    .tk2-car.rt-car--departed .tk2-stamp { visibility: visible; }
    .tk2-car.rt-car--departed { filter: drop-shadow(0 ${u(2)} ${u(3)} #00000052) grayscale(.45) brightness(.94); }
    /* live ticket lifts and glows */
    .tk2-car.rt-car--current { --stock: #fdf6df; filter: drop-shadow(0 ${u(3)} ${u(4)} #00000052) drop-shadow(0 0 ${u(5)} #fbbf24) drop-shadow(0 0 ${u(11)} #fbbf2488); transform: translateY(${u(-4)}); }
    .tk2-car.rt-car--spotlit { filter: drop-shadow(0 ${u(2)} ${u(3)} #00000052) drop-shadow(0 0 ${u(5)} #22d3ee) drop-shadow(0 0 ${u(11)} #22d3ee88); }
    .tk2-car.rt-car--current.rt-car--spotlit { filter: drop-shadow(0 ${u(2)} ${u(3)} #00000052) drop-shadow(0 0 ${u(5)} #fbbf24) drop-shadow(0 0 ${u(11)} #22d3ee); transform: translateY(${u(-4)}); }

    .tk2-open { --stock: #e8f0e2; color: #3f6d50; }
    .tk2-open .tk2-badge { display: flex; align-items: center; justify-content: center; border-color: #3f7d54; border-style: dashed; color: #37b24d; font-size: ${u(21)}; }
    .tk2-open .tk2-name { color: #2e5c3e; }
    .tk2-open .tk2-head, .tk2-open .tk2-time, .tk2-open .tk2-serial { color: #56805f; }
    .tk2-open .tk2-stub { border-right-color: #86a88a; }
    .tk2-open .tk2-barcode { opacity: .35; }
    .tk2-open .tk2-stamp { display: none; }

    /* Track: the wooden plank the tickets ride (the shipped look, warmer). */
    .rt-rails-ticket2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.055);
      background:
        repeating-linear-gradient(90deg, #00000026 0 calc(var(--rt-th) * 0.004), transparent calc(var(--rt-th) * 0.004) calc(var(--rt-th) * 0.12)),
        linear-gradient(#8a5a2b, #6b4220); border-radius: ${u(2)};
      box-shadow: inset 0 calc(var(--rt-th) * 0.006) 0 #b8804a; }
  `);
}

const pad = (n) => String(n).padStart(4, '0');

function headFor(v, i) {
  // short labels — they must never truncate on the small stub
  if (v.kind === 'engine') return 'Loco Nº 1';
  if (v.kind === 'caboose') return 'Caboose';
  return `Coach ${i}`;
}

function ticketCar(v, i) {
  const isEngine = v.kind === 'engine';
  const cls = `rt-car tk2-car ${v.isOpen ? 'tk2-open' : ''} ${stateClasses(v)}`.replace(/\s+/g, ' ').trim();
  const dataSlot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
  const flag = `<div class="rt-pointer rt-now-bob tk2-flag">${esc(L('overlay.now'))}</div>`;
  const badge = v.isOpen ? '<div class="tk2-badge">+</div>' : `<div class="tk2-badge">${htmlAvatar(v)}</div>`;
  const head = v.isOpen ? `${esc(L('overlay.open'))} · ${esc(L('overlay.signUp'))}` : headFor(v, i);
  const name = v.isOpen ? '— — —' : esc(v.name);
  const time = v.isOpen
    ? (v.timeLines?.[0] ? `${esc(v.timeLines[0])}` : '&nbsp;')
    : `DEP ${timeLinesHTML(v.timeLines)}`;
  return `<div class="${cls}"${dataSlot}>${flag}<div class="tk2-stub"><div class="tk2-punch"></div>${badge}</div><div class="tk2-main"><div class="tk2-head">${head}</div><div class="tk2-name rt-fit">${name}</div><div class="tk2-time">${time}</div><div class="tk2-foot"><div class="tk2-barcode"></div><div class="tk2-serial">№ ${pad(1013 + i * 7)}</div></div><div class="tk2-stamp">${esc(L('overlay.played'))}</div></div></div>`;
}

export function build(train, opts = {}) {
  const { doc } = opts;
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const node = doc.createElement('div');
  node.className = 'tk2 rt-theme-ticket2';
  node.innerHTML = vehicles.map((v, i) => ticketCar(v, i)).join('');

  const carRefs = new Map();
  let engineRef = null;
  node.querySelectorAll('.rt-car').forEach((group) => {
    const ref = { group, timeEl: group.querySelector('.tk2-time'), isOpen: group.classList.contains('tk2-open') };
    if (group.dataset.engine) { engineRef = ref; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push(ref);
  });

  const setTime = (ref, s) => {
    if (!ref.timeEl || ref.isOpen) return;
    ref.timeEl.innerHTML = `DEP ${timeLinesHTML(s.timeLines ?? [s.relativeTime ?? ''])}`;
  };
  return {
    node,
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          ref.group.classList.toggle('rt-car--current', car.isCurrent);
          ref.group.classList.toggle('rt-car--departed', car.isDeparted);
          ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
          setTime(ref, car);
        }
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        setTime(engineRef, eng);
      }
    },
    afterAttach() { fitAll(node); undulate(node); },
  };
}

export function buildTrack({ doc }) {
  const el = doc.createElement('div');
  el.className = 'rt-rails rt-rails-ticket2';
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.995)');
  return el;
}

export const foot = 1;

export default { key: 'ticket', ensureStyles, build, buildTrack, foot };
