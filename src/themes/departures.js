/**
 * departures2 — split-flap departure boards as roadside signs on wheels,
 * rebuilt from the user's reference boards: compact near-square dark boards,
 * a black header strip (CONDUCTOR / NEXT SLOT / COACH NN, all from i18n), real
 * flap letter cells with a centre seam for the name, yellow monospace time,
 * coloured status (boarding / on-time / played, all from i18n), on short legs
 * with caster wheels like a billboard sign. HTML/CSS medium via the --u token.
 */
import { fitAll, undulate, toVehicles, esc, themeT } from './shared-svg.js';
import { ensureHtmlShared, injectStyle, htmlAvatar, htmlWheel, stateClasses } from './shared-html.js';

let L = themeT();

const STYLE_ID = 'rt-theme-departures2-style';
const DESIGN_H = 182;
const u = (n) => `calc(${n} * var(--u))`;
const YELLOW = '#f5c518', GREEN = '#3ddc97', RED = '#e05656';

export function ensureStyles() {
  ensureHtmlShared();
  injectStyle(STYLE_ID, `
    .dp2 { --u: calc(var(--rt-th) / ${DESIGN_H}); --rt-ride: 1.2; flex: none; height: var(--rt-th); display: flex; align-items: flex-end; gap: ${u(20)};
      font-family: 'DM Mono', 'Courier New', monospace; }
    .dp2-unit { display: flex; flex-direction: column; align-items: center; }

    .dp2-board { position: relative; width: ${u(164)}; border-radius: ${u(7)}; padding: ${u(6)} ${u(8)} ${u(8)};
      background: linear-gradient(#2b2e35, #1d2026); border: ${u(2.5)} solid #0c0d10;
      box-shadow: inset 0 ${u(1.5)} 0 #ffffff1f, 0 ${u(3)} ${u(6)} #0007; display: flex; flex-direction: column; gap: ${u(5.5)}; }

    .dp2-head { display: flex; align-items: center; justify-content: space-between; background: #0c0d10; border-radius: ${u(4)};
      padding: ${u(3)} ${u(8)}; }
    .dp2-head b { color: #e8e9ec; font-weight: 700; font-size: ${u(8.5)}; letter-spacing: ${u(2.5)}; }
    .dp2-lamp { width: ${u(8)}; height: ${u(8)}; border-radius: 50%; background: ${YELLOW}; box-shadow: 0 0 ${u(5)} ${YELLOW}; }
    .dp2-unit.rt-car--current .dp2-lamp { background: ${GREEN}; box-shadow: 0 0 ${u(6)} ${GREEN}; animation: dp2-blink 1.1s steps(2) infinite; }
    .dp2-unit.rt-car--departed .dp2-lamp { background: ${RED}; box-shadow: none; animation: none; }
    @keyframes dp2-blink { 0% { opacity: 1; } 100% { opacity: 0.35; } }
    /* clean sweep: every ~9s a flip wave travels left-to-right across the row */
    .dp2-cell.dp2-on { animation: dp2-cellflip 9s linear infinite; }
    @keyframes dp2-cellflip { 0%, 3.4%, 100% { transform: scaleY(1); } 1.1% { transform: scaleY(0.06); } 2.2% { transform: scaleY(1); } }
    @keyframes dp2-flipin { 0% { transform: rotateX(88deg); } 55% { transform: rotateX(-16deg); } 100% { transform: rotateX(0); } }
    /* status changes flip in via this class (update() re-toggles it) — a class,
       not an inline style, so the reduced-motion rule below can actually win */
    .dp2-status.dp2-flip { animation: dp2-flipin .5s ease-out; }
    @media (prefers-reduced-motion: reduce) {
      .dp2-cell.dp2-on, .dp2-status.dp2-flip, .dp2-unit.rt-car--current .dp2-lamp { animation: none; }
    }

    /* flap letter cells with the centre seam */
    .dp2-flaps { display: flex; gap: ${u(2)}; justify-content: center; }
    .dp2-cell { position: relative; width: ${u(10.5)}; flex: none; height: ${u(17)}; background: linear-gradient(#15171b, #0b0c0f 48%, #101216 52%, #15171b);
      border-radius: ${u(2)}; color: #f2f4f7; font-weight: 700; font-size: ${u(10)};
      display: flex; align-items: center; justify-content: center; box-shadow: inset 0 ${u(1)} 0 #ffffff14; }
    .dp2-cell::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: ${u(1)}; background: #000000cc; }

    .dp2-info { display: flex; align-items: center; gap: ${u(8)}; background: #0c0d10; border-radius: ${u(4)}; padding: ${u(4)} ${u(8)}; }
    .dp2-ava { position: relative; width: ${u(25)}; height: ${u(25)}; border-radius: ${u(3)}; overflow: hidden; background: #23262c; flex: none;
      display: flex; align-items: center; justify-content: center; color: #9aa3b0; font-weight: 700; font-size: ${u(13)}; box-shadow: 0 0 0 ${u(1.5)} #33363e; }
    .dp2-time { color: ${YELLOW}; font-size: ${u(9.5)}; font-weight: 700; letter-spacing: ${u(1)}; flex: 1; text-align: left; }
    .dp2-status { transform-origin: center; font-size: ${u(9)}; font-weight: 700; letter-spacing: ${u(1.5)}; color: ${YELLOW}; }
    .dp2-unit.rt-car--current .dp2-status { color: ${GREEN}; }
    .dp2-unit.rt-car--departed .dp2-status { color: ${RED}; }

    /* trolley base: legs into one chassis bar the wheels hang off */
    .dp2-base { display: flex; gap: ${u(84)}; }
    .dp2-leg { width: ${u(6)}; height: ${u(9)}; background: linear-gradient(#3a3e46, #23262c); }
    .dp2-chassis { width: ${u(140)}; height: ${u(5)}; border-radius: ${u(2.5)}; background: linear-gradient(#43474f, #1d2026); box-shadow: 0 ${u(1)} ${u(2)} #0007; }
    .dp2-wheels { display: flex; gap: ${u(100)}; margin-top: ${u(-2)}; }
    .dp2-w { width: ${u(13)}; height: ${u(13)}; background: #33363e; box-shadow: inset 0 0 0 ${u(3.5)} #14161a, 0 ${u(1)} ${u(2)} #0006; --spk: #55596200; }

    .dp2-flag { position: absolute; top: ${u(-17)}; left: 50%; transform: translateX(-50%); background: ${YELLOW}; color: #14161a;
      font-weight: 700; font-size: ${u(10)}; letter-spacing: ${u(1.5)}; padding: ${u(2)} ${u(8)}; border-radius: ${u(3)};
      white-space: nowrap; box-shadow: 0 ${u(2)} ${u(4)} #0006; }

    .dp2-unit.rt-car--current .dp2-board { border-color: ${GREEN}; box-shadow: inset 0 ${u(1.5)} 0 #ffffff1f, 0 0 ${u(8)} ${GREEN}66, 0 ${u(3)} ${u(6)} #0007; }
    .dp2-unit.rt-car--spotlit .dp2-board { border-color: #22d3ee; box-shadow: inset 0 ${u(1.5)} 0 #ffffff1f, 0 0 ${u(10)} #22d3ee88, 0 ${u(3)} ${u(6)} #0007; }
    .dp2-unit.rt-car--departed { opacity: 0.82; }
    .dp2-unit.rt-car--departed .dp2-board { filter: saturate(0.5); }

    .dp2-open .dp2-cell { color: ${GREEN}; }
    .dp2-open .dp2-board { border-style: dashed; border-color: #3ddc9788; }
    .dp2-open .dp2-time { color: ${GREEN}; }

    .rt-rails-departures2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.05); background: #26282e;
      box-shadow: inset 0 calc(var(--rt-th) * 0.006) 0 #ffffff14; }
    .rt-rails-departures2::after { content: ''; position: absolute; left: 0; right: 0; top: 45%; height: 12%;
      background: repeating-linear-gradient(90deg, #f5c51866 0 calc(var(--rt-th) * 0.05), transparent calc(var(--rt-th) * 0.05) calc(var(--rt-th) * 0.11)); }
  `);
}

function flapCells(text, max = 12) {
  // real boards have a fixed cell count — pad short names, centred
  let t = String(text).toUpperCase().slice(0, max);
  const padL = Math.floor((max - t.length) / 2);
  t = ' '.repeat(padL) + t + ' '.repeat(max - t.length - padL);
  let out = '';
  let idx = 0;
  for (const ch of t) out += ch === ' ' ? '<span class="dp2-cell"></span>' : `<span class="dp2-cell dp2-on" style="animation-delay:${(idx++ * 0.07).toFixed(2)}s">${esc(ch)}</span>`;
  return out;
}
/** Plain text (escaped where it meets HTML): the status cell is rewritten via
 *  textContent on a time tick, so pre-escaping here would double-escape there.
 *  status.* values live uppercase in every catalog; signUp/played are sentence-
 *  case shared badges, uppercased for the board. (Plain toUpperCase is safe for
 *  the shipped locales — none has Turkish-style dotted-i casing.) */
function statusText(v) {
  if (v.isOpen) return L('overlay.signUp').toUpperCase();
  if (v.isCurrent) return L('status.boarding');
  if (v.isDeparted || v.isDimmed) return L('overlay.played').toUpperCase();
  return L('status.onTime');
}

function boardUnit(v, isEngine) {
  const cls = `rt-car dp2-unit ${v.isOpen ? 'dp2-open' : ''} ${stateClasses(v)}`.replace(/\s+/g, ' ').trim();
  const dataAttr = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
  const head = isEngine
    ? L('overlay.conductor')
    : v.isOpen
      ? L('departures.nextSlot')
      : L('departures.coach', { n: String(v.slotOrder ?? '').padStart(2, '0') });
  const name = v.isOpen ? L('overlay.open') : v.name;
  const time = v.timeLines?.[0] ?? '';
  const ava = v.isOpen ? '<div class="dp2-ava">+</div>' : `<div class="dp2-ava">${htmlAvatar(v)}</div>`;
  return `<div class="${cls}"${dataAttr}>
    <div class="dp2-board">
      <div class="rt-pointer rt-now-bob dp2-flag">▼ ${esc(L('overlay.now'))}</div>
      <div class="dp2-head"><b>${esc(head)}</b><span class="dp2-lamp"></span></div>
      <div class="dp2-flaps">${flapCells(name)}</div>
      <div class="dp2-info">${ava}<span class="dp2-time">${esc(time)}</span><span class="dp2-status">${esc(statusText(v))}</span></div>
    </div>
    <div class="dp2-base"><span class="dp2-leg"></span><span class="dp2-leg"></span></div>
    <div class="dp2-chassis"></div>
    <div class="dp2-wheels">${htmlWheel('dp2-w')}${htmlWheel('dp2-w')}</div>
  </div>`;
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const node = document.createElement('div');
  node.className = 'dp2 rt-theme-departures2';
  const hasEngine = vehicles[0]?.kind === 'engine';
  node.innerHTML = vehicles.map((v, i) => boardUnit(v, hasEngine && i === 0)).join('');

  const carRefs = new Map();
  let engineRef = null;
  node.querySelectorAll('.rt-car').forEach((group) => {
    const ref = { group, timeEl: group.querySelector('.dp2-time'), statusEl: group.querySelector('.dp2-status'), isOpen: group.classList.contains('dp2-open') };
    if (group.dataset.engine) { engineRef = ref; return; }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push(ref);
  });

  const apply = (ref, st) => {
    ref.group.classList.toggle('rt-car--current', Boolean(st.isCurrent));
    ref.group.classList.toggle('rt-car--departed', Boolean(st.isDeparted));
    ref.group.classList.toggle('rt-car--spotlit', Boolean(st.isSpotlit));
    if (ref.timeEl && st.time !== undefined) ref.timeEl.textContent = st.time;
    if (ref.statusEl) {
      const next = statusText({ isOpen: ref.isOpen, isCurrent: st.isCurrent, isDeparted: st.isDeparted });
      if (ref.statusEl.textContent !== next) {
        ref.statusEl.textContent = next;
        ref.statusEl.classList.remove('dp2-flip');
        void ref.statusEl.offsetWidth;
        ref.statusEl.classList.add('dp2-flip');
      }
    }
  };

  return {
    node,
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        for (const ref of carRefs.get(car.slotOrder) ?? []) {
          apply(ref, { isCurrent: car.isCurrent, isDeparted: car.isDeparted, isSpotlit: car.isSpotlit, time: (car.timeLines ?? [car.relativeTime])[0] ?? '' });
        }
      }
      const eng = nextTrain.engine;
      if (engineRef) apply(engineRef, { isCurrent: eng.isCurrent, isDeparted: eng.isDimmed, isSpotlit: eng.isSpotlit, time: (eng.timeLines ?? [eng.relativeTime ?? ''])[0] ?? '' });
    },
    afterAttach() { fitAll(node); undulate(node); },
  };
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-departures2';
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.955)');
  return el;
}

/** Caster wheels flush with the holder floor. */
export const foot = 1;

export default { key: 'departures', ensureStyles, build, buildTrack, foot };
