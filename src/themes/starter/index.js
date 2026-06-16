/**
 * starter — the copy-paste starter Theme for the authoring guide
 * (docs/authoring-a-theme.md). It is the GOLDEN PATH: a viewBox SVG that the
 * renderer sizes to the Train height for free — no `--u` unit token needed
 * (the `--u` unit token is only for non-SVG Themes). Copy this whole folder to
 * src/themes/<yourkey>/, rename the key, reshape the art.
 *
 * It also demonstrates a Theme bundling its own asset: the locomotive wears
 * badge.svg, resolved against THIS module's URL so it loads under the
 * GitHub-Pages project subpath with no build step and no per-page config.
 *
 * A Theme is one module exporting { key, ensureStyles, build, buildTrack }. The
 * four contract pieces are numbered inline below.
 */
import { esc, wheel, avatarSVG, pointerSVG, fitAll, undulate, toVehicles } from '../shared-svg.js';

// Bundled asset: new URL('./assets/x', import.meta.url) resolves against
// the module's deployed location — correct under any base path, no build, no config.
// (For a single-file Theme with no assets, you don't need this at all.)
const BADGE = new URL('./assets/badge.svg', import.meta.url).href;

const ENG = 210;          // the locomotive is a little wider than a coach
const CAR = 180;          // one coach's width, in viewBox units
const GAP = 8;            // gap between Cars
const VIEW_H = 220;       // viewBox height — all the art lives inside this box
const railY = 168;        // the wheel line (art is positioned relative to it)
const STYLE_ID = 'rt-theme-starter-style';

/* 1) ensureStyles() — inject the Theme's CSS once (keyed by an id so re-renders
 *    don't duplicate it). State is driven by the shared .rt-car--current /
 *    --departed / --spotlit classes the renderer toggles on a tick; the Now/Spotlight
 *    GLOW is a CSS drop-shadow over the STATIC .st-art group (the wheels ride a
 *    sibling .st-front layer), so a lit Car's filter bitmap caches across frames
 *    instead of re-rasterising the spinning wheels (memory theme-rendering-constraints). */
export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rt-theme-starter .rt-car--current .st-art { filter: drop-shadow(0 0 4px #fbbf24) drop-shadow(0 0 9px #fbbf24); }
    .rt-theme-starter .rt-car--spotlit .st-art { filter: drop-shadow(0 0 4px #22d3ee) drop-shadow(0 0 9px #22d3ee); }
    /* A handed-off Slot stays readable — a light dim, not heavy shade — and gets a
       PLAYED stamp (always in the DOM, revealed by the state class). */
    .rt-theme-starter .rt-car--departed { opacity: 0.82; }
    .rt-theme-starter .rt-car--departed image { filter: saturate(0.5); }
    .rt-theme-starter .st-stamp { visibility: hidden; }
    .rt-theme-starter .rt-car--departed .st-stamp { visibility: visible; }
  `;
  document.head.appendChild(style);
}

/* 2) buildTrack() — OPTIONAL. Return the stationary rail the Train rolls over, or
 *    delete this export and the renderer skips it. It sits behind the Train, full
 *    canvas width; size it in fractions of --rt-th so it scales with the Train. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails';
  el.style.cssText = 'top: calc(var(--rt-th) * 0.79); height: calc(var(--rt-th) * 0.03); background: #6b7280;';
  return el;
}

/** Render one vehicle's art. Returns { body, front }: `body` is the static art the
 *  glow filters (avatar, name, badge, stamp); `front` is the animating wheel layer,
 *  kept OUT of the filtered group so the cached glow bitmap isn't re-rasterised. */
function starterCar(v, x, w, i, isEngine) {
  const cx = x + w / 2;
  const top = railY - 96;
  const ring = isEngine ? '#f4c430' : v.isOpen ? '#37b24d' : '#93c5fd';
  const fill = isEngine ? '#8a4b12' : v.isOpen ? '#14361f' : '#1e3a5f';
  let body = `<rect x="${x + 6}" y="${top}" width="${w - 12}" height="104" rx="12" fill="${fill}" stroke="${ring}" stroke-width="3"/>`;
  if (v.isOpen) {
    body += `<text x="${cx}" y="${top + 50}" text-anchor="middle" font-weight="800" font-size="26" fill="#37b24d">OPEN</text>`;
    body += `<text x="${cx}" y="${top + 72}" text-anchor="middle" font-weight="700" font-size="12" fill="#6ee7a7">sign up!</text>`;
  } else {
    // avatarSVG paints initials, then the (clipped) avatar over them — so a 404 on
    // the flaky CDN still shows initials, never a blank hole.
    body += avatarSVG(`st-av-${i}`, cx, top + 38, 28, v.image, v.name, ring);
    body += `<text class="rt-fit" data-maxw="${w - 26}" x="${cx}" y="${top + 84}" text-anchor="middle" font-weight="800" font-size="15" fill="#fff">${esc(v.name)}</text>`;
  }
  // The bundled asset, per-element: a maker's mark on the loco only.
  if (isEngine) body += `<image href="${BADGE}" x="${x + 10}" y="${top + 6}" width="26" height="26"/>`;
  // PLAYED stamp — only a booked Slot can be "played", never an Open one.
  if (!v.isOpen) body += `<g class="st-stamp" transform="rotate(-8 ${cx} ${railY - 52})"><rect x="${cx - 34}" y="${railY - 65}" width="68" height="26" rx="4" fill="#2a0a0acc" stroke="#ff9a9a" stroke-width="2"/><text x="${cx}" y="${railY - 47}" text-anchor="middle" font-weight="800" font-size="13" fill="#ffd0d0" letter-spacing="1">PLAYED</text></g>`;
  const front = wheel(x + 34, railY + 12, 16, '#374151', 6, '#9ca3af') + wheel(x + w - 34, railY + 12, 16, '#374151', 6, '#9ca3af');
  return { body, front };
}

/* 3) build(train, opts) — build the Train art ONCE and return a handle. toVehicles()
 *    flattens the live view-model: vehicles[0] is the locomotive (the organiser, who
 *    conducts the train); the rest are the coaches. (engine.organiser is a vestigial,
 *    always-null fallback — the organiser drives the loco, so there is no tender.) */
export function build(train) {
  const vehicles = toVehicles(train);
  const widthOf = (i) => (i === 0 ? ENG : CAR);
  const xs = [];
  let acc = 0;
  vehicles.forEach((_, i) => { xs.push(acc); acc += widthOf(i) + GAP; });
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  vehicles.forEach((v, i) => {
    const w = widthOf(i);
    const isEngine = i === 0;
    const parts = starterCar(v, xs[i], w, i, isEngine);
    // The loco is the organiser — it has no Slot, so it dims only post-event (isDimmed),
    // never on a per-slot isDeparted. Coaches use isDeparted.
    const departed = isEngine ? v.isDimmed : v.isDeparted;
    const state = (v.isCurrent ? ' rt-car--current' : '') + (v.isSpotlit ? ' rt-car--spotlit' : '') + (departed ? ' rt-car--departed' : '');
    const slot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
    // The Now Marker is always in the DOM; base CSS reveals it on .rt-car--current.
    const pointer = v.isOpen ? '' : `<g class="rt-pointer rt-now-bob">${pointerSVG(xs[i] + w / 2, 30, '#fbbf24', 'NOW')}</g>`;
    body += `<g class="rt-car${state}"${slot}><g class="st-art">${parts.body}</g><g class="st-front">${parts.front}</g>${pointer}</g>`;
  });

  const holder = document.createElement('div');
  holder.innerHTML = `<svg class="rt-theme-starter" viewBox="0 0 ${totalW} ${VIEW_H}" role="img">${body}</svg>`;
  const svg = holder.firstElementChild;

  // Keep references so a time tick re-styles in place (never a rebuild).
  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((g) => {
    if (g.dataset.engine) { engineRef = g; return; }
    carRefs.set(Number(g.dataset.slot), g);
  });

  return {
    node: svg,
    /* update(nextTrain) — re-style state IN PLACE on the renderer's tick: toggle the
     *  shared classes (and rewrite any time text — the starter shows none). Never
     *  rebuild, so a running Mode/ambient animation isn't restarted. */
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        const g = carRefs.get(car.slotOrder);
        if (!g) continue;
        g.classList.toggle('rt-car--current', car.isCurrent);
        g.classList.toggle('rt-car--departed', car.isDeparted);
        g.classList.toggle('rt-car--spotlit', car.isSpotlit);
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
      }
    },
    /* afterAttach() — runs once the node is in the document: fit the names to their
     *  Cars (no truncation) and start the per-Car ambient undulation. */
    afterAttach() {
      fitAll(svg);
      undulate(svg);
    },
  };
}

// 4) The default export IS the Theme: register it in src/train-renderer.js.
export default { key: 'starter', ensureStyles, build, buildTrack };
