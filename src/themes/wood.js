/**
 * wood2 — polish pass on the Wooden Toy Train. Keeps the good parts (the kid
 * pulling the train, magnet couplers, chunky peg wheels) and rebuilds the craft:
 * smaller beech-wood blocks at real toy scale next to the kid, painted tops in a
 * muted palette, a routed reveal line where paint meets wood, and a proper little
 * engine. HTML/CSS medium via the --u token, same contract as the roster themes.
 */
import { fitAll, undulate, toVehicles, esc, themeT } from './shared-svg.js';
import { ensureHtmlShared, injectStyle, htmlAvatar, htmlWheel, stateClasses, timeLinesHTML } from './shared-html.js';

let L = themeT();

const STYLE_ID = 'rt-theme-wood2-style';
// Design height = the KID (the tallest element, 235). The toy blocks are ~60%
// of the holder — so at a given overlay strip height the train hugs the bottom
// instead of the kid blowing the composition up past the configured height.
const DESIGN_H = 235;
const u = (n) => `calc(${n} * var(--u))`;

const PAINTS = ['#a94f3d', '#6f8a67', '#c99a3f', '#5c748e', '#8a6f9e'];
const ENGINE_PAINT = '#a94f3d';
const BEECH = '#dcbf92';
const BEECH_DARK = '#b8945f';
const WALNUT = '#6f4e2f';

export function ensureStyles(doc) {
  ensureHtmlShared(doc);
  injectStyle(doc, STYLE_ID, `
    .wd2 {
      --u: calc(var(--rt-th) / ${DESIGN_H});
      --rt-ride: 1.25;
      flex: none; display: flex; align-items: flex-end; gap: 0;
      height: calc(${DESIGN_H} * var(--u));
      font-family: 'Baloo 2', 'Trebuchet MS', system-ui, sans-serif;
    }

    /* The kid — BIGGER than the toy train (a child pulling a toy). Decorative:
       not a .rt-car, never undulates; walk bob + leg swing, off under
       reduced-motion. */
    .wd2-kid { align-self: flex-end; position: relative; width: ${u(96)}; height: ${u(10)}; margin-right: ${u(-2)}; }
    .wd2-kid svg { position: absolute; bottom: 0; left: 0; width: ${u(98)}; height: ${u(233)}; display: block; animation: wd2-walk 0.55s ease-in-out infinite; transform-origin: bottom center; }
    .wd2-leg { transform-box: fill-box; transform-origin: top center; animation: wd2-step 0.55s ease-in-out infinite alternate; }
    .wd2-leg2 { animation-delay: -0.275s; }
    @keyframes wd2-walk { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(${u(-2.5)}) rotate(1deg); } }
    @keyframes wd2-step { from { transform: rotate(16deg); } to { transform: rotate(-16deg); } }

    /* Magnet couplers (kept — they read as the real toy). */
    .wd2-mag { width: ${u(13)}; height: ${u(8)}; background: linear-gradient(#8b8b93, #4a4a52); border-radius: ${u(2.5)}; align-self: flex-end; margin-bottom: ${u(24)}; box-shadow: inset 0 ${u(1)} 0 #ffffff66, 0 ${u(1)} ${u(1)} #0004; }

    /* One car = a beech block with a painted top. Paint stops at a routed
       reveal line; the wood shows at the base like a real painted toy. */
    .wd2-car {
      position: relative; width: ${u(106)}; margin: 0 ${u(4)}; padding: ${u(12)} ${u(9)} ${u(5)};
      text-align: center; border-radius: ${u(14)} ${u(14)} ${u(8)} ${u(8)};
      color: #fff;
      background:
        linear-gradient(var(--paint), var(--paint)) top / 100% ${u(88)} no-repeat,
        linear-gradient(${BEECH}, ${BEECH_DARK});
      background-clip: padding-box;
      box-shadow:
        inset 0 ${u(2)} 0 #ffffff55,
        inset 0 ${u(-3)} 0 #00000022,
        inset ${u(2)} 0 0 #ffffff2e, inset ${u(-2)} 0 0 #00000018,
        0 ${u(3)} 0 #00000030;
    }
    .wd2-car::after { content: ''; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: repeating-linear-gradient(93deg, #ffffff0d 0 ${u(8)}, #00000009 ${u(8)} ${u(15)});
      box-shadow: inset 0 0 ${u(10)} #3a230b33; }
    .wd2-car::before { content: ''; position: absolute; left: 0; right: 0; top: ${u(86)}; height: ${u(3)}; background: #00000026; box-shadow: 0 ${u(1)} 0 #ffffff40; z-index: 1; }

    /* Engine: arched roof cap, funnel, dome, and a wedge cowcatcher. */
    .wd2-engine { border-radius: ${u(18)} ${u(14)} ${u(8)} ${u(8)}; }
    .wd2-roof { position: absolute; top: ${u(-8)}; left: ${u(28)}; right: ${u(7)}; height: ${u(10)}; background: linear-gradient(#8a3d2e, #7a3527); border-radius: ${u(7)} ${u(7)} 0 0; box-shadow: inset 0 ${u(2)} 0 #fff4; }
    .wd2-plow { position: absolute; bottom: ${u(13)}; left: ${u(-8)}; width: ${u(14)}; height: ${u(19)}; background: linear-gradient(135deg, ${BEECH} 55%, ${BEECH_DARK}); border-radius: ${u(3)} 0 0 ${u(7)}; transform: skewY(-14deg); box-shadow: inset ${u(1)} ${u(1)} 0 #ffffff55, 0 ${u(2)} ${u(2)} #0003; }
    .wd2-stack { position: absolute; top: ${u(-13)}; left: ${u(12)}; width: ${u(16)}; height: ${u(16)}; background: linear-gradient(${WALNUT}, #57381c); border-radius: ${u(4)} ${u(4)} ${u(2)} ${u(2)}; box-shadow: inset 0 ${u(3)} 0 #fff3, 0 ${u(1)} 0 #0003; }
    .wd2-stack::after { content: ''; position: absolute; top: 0; left: ${u(-2.5)}; right: ${u(-2.5)}; height: ${u(4)}; background: #57381c; border-radius: ${u(2.5)}; }
    .wd2-stack span { position: absolute; top: ${u(-8)}; left: ${u(3.5)}; width: ${u(10)}; height: ${u(10)}; border-radius: 50%; background: #efe9dc; opacity: 0; animation: rt-puff 2.3s ease-out infinite; }
    .wd2-stack span:nth-child(2) { animation-delay: 0.75s; }
    .wd2-stack span:nth-child(3) { animation-delay: 1.5s; }
    .wd2-dome { position: absolute; top: ${u(-7)}; right: ${u(18)}; width: ${u(13)}; height: ${u(8)}; background: #c99a3f; border-radius: ${u(7)} ${u(7)} 0 0; box-shadow: inset 0 ${u(2)} 0 #fff5; }

    .wd2-badge { position: relative; width: ${u(56)}; height: ${u(56)}; margin: 0 auto ${u(6)}; border-radius: 50%; overflow: hidden; background: #f7f0e2; border: ${u(5)} solid ${BEECH}; box-shadow: 0 ${u(2)} ${u(3)} #0003, inset 0 0 0 ${u(1)} #00000022; color: #7a5426; font-weight: 800; font-size: ${u(20)}; }

    .wd2-name { position: relative; z-index: 1; font-weight: 800; font-size: ${u(12.5)}; line-height: 1.25; color: #5a3a17; text-shadow: 0 ${u(1)} 0 #ffffff8c; }
    .wd2-time { position: relative; z-index: 1; font-size: ${u(10.5)}; line-height: 1.25; font-weight: 700; color: #7a5426; text-shadow: 0 ${u(1)} 0 #ffffff70; }

    .wd2-wheels { display: flex; justify-content: space-between; padding: 0 ${u(10)}; margin: ${u(4)} ${u(-9)} ${u(-4)}; position: relative; z-index: 1; }
    .wd2-w { width: ${u(23)}; height: ${u(23)}; background: ${WALNUT}; box-shadow: inset 0 0 0 ${u(5)} ${BEECH}, inset 0 0 0 ${u(8)} ${WALNUT}, 0 ${u(2)} ${u(2)} #0004; --spk: ${BEECH}; }

    .wd2-flag { position: absolute; top: ${u(-17)}; left: 50%; transform: translateX(-50%); background: #e9b93c; color: #4a3110; font-weight: 800; font-size: ${u(10)}; padding: ${u(2)} ${u(8)}; border-radius: ${u(4)}; white-space: nowrap; box-shadow: 0 ${u(2)} 0 #0003, inset 0 ${u(1)} 0 #fff6; }
    .wd2-star { position: absolute; top: ${u(-5)}; right: ${u(2)}; color: #22d3ee; font-size: ${u(18)}; text-shadow: 0 0 ${u(6)} #22d3ee; visibility: hidden; z-index: 2; }
    .wd2-car.rt-car--spotlit .wd2-star { visibility: visible; }

    .wd2-open { color: #7a5426; background: linear-gradient(#e9d6b4, ${BEECH_DARK}); }
    .wd2-open::before { display: none; }
    .wd2-open .wd2-badge { background: #f2e7cf; border-style: dashed; border-color: #b8945f; color: #37b24d; font-size: ${u(30)}; display: flex; align-items: center; justify-content: center; }
    .wd2-open .wd2-name { color: #3f8a52; }
    .wd2-open .wd2-time { color: #6f8a67; }
    .wd2-open .wd2-w { box-shadow: inset 0 0 0 ${u(5)} #cdb389, inset 0 0 0 ${u(8)} ${WALNUT}, 0 ${u(2)} ${u(2)} #0004; }

    .wd2-car.rt-car--departed { filter: grayscale(0.35) brightness(0.97); opacity: 0.85; }
    .wd2-stamp { visibility: hidden; position: absolute; top: ${u(50)}; left: 50%; z-index: 2;
      transform: translateX(-50%) rotate(-7deg); white-space: nowrap;
      font-weight: 800; font-size: ${u(11)}; letter-spacing: ${u(1.2)}; color: #5a3413;
      padding: ${u(2)} ${u(8)}; border-radius: ${u(4)};
      background: #f0e2c2f0; border: ${u(2)} solid #8a5a2b; box-shadow: 0 ${u(2)} ${u(3)} #0004; }
    .wd2-car.rt-car--departed .wd2-stamp { visibility: visible; }
    .wd2-car.rt-car--current { box-shadow: inset 0 ${u(2)} 0 #ffffff55, inset 0 ${u(-3)} 0 #00000022, 0 0 0 ${u(4)} #fbbf24, 0 ${u(3)} 0 #00000030; }
    .wd2-car.rt-car--spotlit { box-shadow: inset 0 ${u(2)} 0 #ffffff55, inset 0 ${u(-3)} 0 #00000022, 0 0 0 ${u(4)} #22d3ee, 0 ${u(3)} 0 #00000030; }
    .wd2-car.rt-car--current.rt-car--spotlit { box-shadow: inset 0 ${u(2)} 0 #ffffff55, inset 0 ${u(-3)} 0 #00000022, 0 0 0 ${u(4)} #fbbf24, 0 0 0 ${u(8)} #22d3ee, 0 ${u(3)} 0 #00000030; }

    @media (prefers-reduced-motion: reduce) {
      .wd2-kid svg, .wd2-leg { animation: none; }
      /* rt-puff rides this theme's own selector, so the base .rt-smoke reset can't reach it */
      .wd2-stack span { animation: none; opacity: 0; }
    }

    /* Track: a beech rail on walnut sleepers, right under the wheels. */
    .rt-rails-wood2 { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.14); }
    .rt-rails-wood2::before, .rt-rails-wood2::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-wood2::before { top: 0; height: calc(var(--rt-th) * 0.028); background: ${BEECH_DARK}; box-shadow: 0 calc(var(--rt-th) * -0.007) 0 #f0dcae; }
    .rt-rails-wood2::after {
      top: calc(var(--rt-th) * 0.028); bottom: 0;
      background: repeating-linear-gradient(90deg, transparent 0 calc(var(--rt-th) * 0.03), ${WALNUT} calc(var(--rt-th) * 0.03) calc(var(--rt-th) * 0.085), transparent calc(var(--rt-th) * 0.085) calc(var(--rt-th) * 0.115));
    }
  `);
}

/** The kid, redrawn: taller than the train (real toy proportions), a mop of
 *  hair, shorts, chunky shoes, one arm trailing a dashed pull-string back to
 *  the engine's cowcatcher. Fixed viewBox coords; the wrapper scales in --u. */
function woodKid() {
  return `<div class="wd2-kid"><svg viewBox="0 0 100 238">
    <ellipse cx="46" cy="235" rx="28" ry="4.5" fill="#0003"/>
    <path d="M 78 130 C 88 152, 94 176, 99 206" fill="none" stroke="#b8945f" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="1 8"/>
    <g class="wd2-leg wd2-leg1"><rect x="32" y="162" width="13" height="62" rx="6" fill="#4a6076"/><rect x="28" y="222" width="22" height="14" rx="6" fill="#7a4a2c"/></g>
    <g class="wd2-leg wd2-leg2"><rect x="47" y="162" width="13" height="62" rx="6" fill="#3f5368"/><rect x="44" y="222" width="22" height="14" rx="6" fill="#6b3f24"/></g>
    <rect x="28" y="142" width="36" height="28" rx="9" fill="#5c748e"/>
    <rect x="26" y="96" width="40" height="56" rx="13" fill="#cfa543"/>
    <rect x="26" y="96" width="40" height="10" rx="5" fill="#dcb45e"/>
    <rect x="56" y="104" width="30" height="11" rx="5.5" fill="#cfa543" transform="rotate(32 56 109)"/>
    <circle cx="78" cy="126" r="6.5" fill="#f1c9a5"/>
    <circle cx="45" cy="58" r="27" fill="#f1c9a5"/>
    <path d="M 18 52 a 27 27 0 0 1 54 0 l -4 -3 -7 5 -7 -5 -7 5 -7 -5 -7 5 -7 -5 z" fill="#6b4226"/>
    <circle cx="37" cy="60" r="2.6" fill="#3a2a18"/><circle cx="53" cy="60" r="2.6" fill="#3a2a18"/>
    <path d="M 40 70 q 5 4 10 0" fill="none" stroke="#b87a52" stroke-width="2.5" stroke-linecap="round"/>
  </svg></div>`;
}

function timeBlock(v) {
  if (v.isOpen) {
    const t = v.timeLines[0] ? ` · ${esc(v.timeLines[0])}` : '';
    return `${esc(L('overlay.signUp'))}${t}`;
  }
  return timeLinesHTML(v.timeLines);
}

function woodCar(v, i) {
  const isEngine = v.kind === 'engine';
  const structural = [isEngine ? 'wd2-engine' : '', v.isOpen ? 'wd2-open' : ''].filter(Boolean).join(' ');
  const cls = `rt-car wd2-car ${structural} ${stateClasses(v)}`.replace(/\s+/g, ' ').trim();
  const dataSlot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
  const wheels = `<div class="wd2-wheels">${htmlWheel('wd2-w')}${htmlWheel('wd2-w')}</div>`;

  if (v.isOpen) {
    return `<div class="${cls}"${dataSlot}><div class="wd2-badge">+</div><div class="wd2-name rt-fit">${esc(L('overlay.open'))}</div><div class="wd2-time">${timeBlock(v)}</div>${wheels}</div>`;
  }

  const paint = isEngine ? ENGINE_PAINT : PAINTS[i % PAINTS.length];
  const stack = isEngine ? '<div class="wd2-roof"></div><div class="wd2-plow"></div><div class="wd2-stack"><span></span><span></span><span></span></div><div class="wd2-dome"></div>' : '';
  const flag = `<div class="rt-pointer rt-now-bob wd2-flag">${esc(L('overlay.now'))}</div>`;
  const star = '<div class="wd2-star">★</div>';
  const badge = `<div class="wd2-badge">${htmlAvatar(v)}</div>`;
  const stamp = `<div class="wd2-stamp">${esc(L('overlay.played'))}</div>`;
  return `<div class="${cls}"${dataSlot} style="--paint:${paint}">${stack}${flag}${star}${badge}<div class="wd2-name rt-fit">${esc(v.name)}</div><div class="wd2-time">${timeBlock(v)}</div>${stamp}${wheels}</div>`;
}

export function build(train, opts = {}) {
  const { doc } = opts;
  L = themeT(opts);
  const vehicles = toVehicles(train);
  const node = doc.createElement('div');
  node.className = 'wd2 rt-theme-wood2';

  const engine = vehicles[0];
  const hasEngine = engine?.kind === 'engine';
  const units = hasEngine ? [woodCar(engine, 0)] : [];
  vehicles.slice(hasEngine ? 1 : 0).forEach((car, i) => units.push(woodCar(car, i + (hasEngine ? 1 : 0))));
  node.innerHTML = woodKid() + units.join('<div class="wd2-mag"></div>');

  const carRefs = new Map();
  let engineRef = null;
  node.querySelectorAll('.rt-car').forEach((group) => {
    if (group.dataset.engine) {
      engineRef = { group, timeEl: group.querySelector('.wd2-time') };
      return;
    }
    const key = Number(group.getAttribute('data-slot'));
    if (!carRefs.has(key)) carRefs.set(key, []);
    carRefs.get(key).push({ group, timeEl: group.querySelector('.wd2-time'), isOpen: group.classList.contains('wd2-open') });
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
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        if (engineRef.timeEl) engineRef.timeEl.innerHTML = timeBlock({ isOpen: false, timeLines: eng.timeLines ?? [eng.relativeTime ?? ''] });
      }
    },
    afterAttach() {
      fitAll(node);
      undulate(node);
    },
  };
}

export function buildTrack({ doc }) {
  const el = doc.createElement('div');
  el.className = 'rt-rails rt-rails-wood2';
  // Rail head right under the wheel line (the block fills the whole holder).
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.965)');
  return el;
}

/** The block (wheels included) fills the whole holder — flush floor. */
export const foot = 1;

export default { key: 'wood', ensureStyles, build, buildTrack, foot };
