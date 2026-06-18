/**
 * pixel — 16-bit pixel-art Theme, the canvas Theme of the
 * roster. Ported from the original art mockup, wired to the live Train
 * view-model and adapted for the Overlay.
 *
 * Unlike the SVG/HTML Themes, pixel's ambient animation is a CANVAS REDRAW LOOP,
 * not CSS transforms (the pixel Theme is explicitly allowed to use a canvas loop): each
 * Car bobs on a sine wave, wheels turn, smoke puffs — all drawn per frame into a
 * single low-res canvas scaled up with image-rendering:pixelated. The names ride
 * a crisp HTML row beneath the canvas (legibility), aligned under
 * their Cars.
 *
 * Sizing: a <canvas> has an intrinsic ratio (its backing-store
 * width/height), so it scales like an SVG — `height` from the unit token --u,
 * `width: auto`. The name row uses --u too, so the whole holder scales with --rt-th
 * and the marquee width measurement is correct in the same tick.
 *
 * Teardown: the redraw loop self-terminates when its canvas leaves the document
 * (`canvas.isConnected`), so a re-render or a removed marquee copy never leaks a
 * timer — no change to the Theme contract needed. Under reduced-motion the loop
 * never starts; a single static frame is drawn (and redrawn as avatars load).
 *
 * Transparent only — no full-bleed background. The Track is the pixel
 * steel rail + ties band.
 */
import { esc, toVehicles, fitAll, themeT } from './shared-svg.js';
import { injectStyle } from './shared-html.js';

// Translator the builders paint with — rebound to the active locale in build();
// it persists for the in-place update() ticks (same locale until a re-render).
let L = themeT();

const STYLE_ID = 'rt-theme-pixel-style';
const CW = 52; // car width, backing px
const CH = 60; // car height, backing px
const FRAME_MS = 110;
// --u = --rt-th / DESIGN_H. The canvas art is ~46u tall and the name row ~17u,
// so DESIGN_H ≈ 64 maps the whole holder to roughly --rt-th.
const DESIGN_H = 64;
const u = (n) => `calc(${n} * var(--u))`;

const PAL = {
  red: '#d23b3b', dred: '#7a1f1f', blk: '#241a30', dblk: '#140d1d',
  blue: '#3b6ad2', green: '#3bb24d', gold: '#f1b40a', steel: '#8a93a0',
  tie: '#6b4423', now: '#fbbf24', cyan: '#22d3ee', smoke: '#7a828d',
  // Organiser tender — a darker coal-car palette: the coal-car that fuels the train.
  coal: '#3a2c1a', dcoal: '#241a14', coalLump: '#4a4a4a', org: '#caa24a',
  // PLAYED stamp ink (viewer feedback: light ink reads over the body).
  played: '#ffd0d0',
};

const reduceMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function ensureStyles() {
  injectStyle(STYLE_ID, `
    .pix {
      --u: calc(var(--rt-th) / ${DESIGN_H});
      flex: none;
      display: inline-flex; flex-direction: column; align-items: stretch;
      font-family: 'Courier New', monospace;
    }
    .pix-canvas { display: block; height: ${u(46)}; width: auto; image-rendering: pixelated; }
    .pix-row { display: flex; width: 100%; margin-top: ${u(4)}; }
    .pix-cell { flex: 1; min-width: 0; padding: 0 ${u(2)}; text-align: center; line-height: 1.25; }
    /* Width-constrain the name so fitAll can shrink it (pixel doesn't load the
       shared-html .rt-fit rule). */
    .pix .rt-fit { display: block; max-width: 100%; overflow-wrap: anywhere; }
    /* Name row sits BELOW the rail as a tidy label strip — sized in line with the
       other Themes (it read ~2x too large before) and the rail is dropped under the
       wheels (buildTrack) so the names no longer collide with the ties. */
    .pix-name { font-weight: 700; font-size: ${u(4.5)}; letter-spacing: ${u(0.5)}; color: #fff;
      text-shadow: ${u(-0.7)} 0 #000, ${u(0.7)} 0 #000, 0 ${u(-0.7)} #000, 0 ${u(0.7)} #000; }
    .pix-sub { font-size: ${u(3.8)}; font-weight: 700; color: #e8def7;
      text-shadow: ${u(-0.7)} 0 #000, ${u(0.7)} 0 #000, 0 ${u(-0.7)} #000, 0 ${u(0.7)} #000; }
    .pix-cell.is-now .pix-sub { color: ${PAL.now}; }
    .pix-cell.is-spot .pix-sub { color: ${PAL.cyan}; }
    .pix-cell.is-open .pix-sub { color: ${PAL.green}; }
    /* A handed-off Slot stays readable — a light dim, not heavy shade (viewer
       feedback): the name/avatar must still read. The PLAYED mark carries the state. */
    .pix-cell.is-departed { opacity: 0.82; }
    .pix-cell.is-departed .pix-sub { color: ${PAL.played}; letter-spacing: ${u(1)}; }
    /* The Organiser tender's label ("ORGANISED BY") rides above the handle. */
    .pix-cell.is-tender .pix-name { color: ${PAL.org}; }
    .pix-cell.is-tender .pix-sub { color: #d8c79a; font-size: ${u(3.5)}; letter-spacing: ${u(0.5)}; }

    /* Pixel steel Track: a thin rail head over chunky ties, fractions of --rt-th. */
    .rt-rails-pixel { top: var(--rt-rail-top); height: calc(var(--rt-th) * 0.05); }
    .rt-rails-pixel::before, .rt-rails-pixel::after { content: ''; position: absolute; left: 0; right: 0; }
    .rt-rails-pixel::before { top: 0; height: calc(var(--rt-th) * 0.018); background: #8a93a0; }
    .rt-rails-pixel::after { top: calc(var(--rt-th) * 0.018); bottom: 0;
      background: repeating-linear-gradient(90deg, #6b4423 0 calc(var(--rt-th) * 0.05), transparent calc(var(--rt-th) * 0.05) calc(var(--rt-th) * 0.1)); }
  `);
}

export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-pixel';
  // Sit the rail UNDER the wheels (the canvas wheels land ~0.58 of --rt-th; the
  // empty lower canvas is transparent so the rail shows through there), leaving the
  // name strip a clear band below it — the names used to render on/through the ties.
  el.style.setProperty('--rt-rail-top', 'calc(var(--rt-th) * 0.6)');
  return el;
}

const imgCache = new Map();
/** Load an avatar for the canvas; null on failure (drawn as a dark window). No
 *  crossOrigin — we never read the canvas back, so a tainted canvas is fine and
 *  more images succeed (the RaidPal CDN sends no CORS headers). */
function loadImg(url) {
  if (!url) return Promise.resolve(null);
  if (imgCache.has(url)) return Promise.resolve(imgCache.get(url));
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => { imgCache.set(url, im); res(im); };
    im.onerror = () => res(null);
    im.src = url;
  });
}

const px = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

function drawWheels(ctx, ox, wy, f) {
  const phase = Math.floor(f / 2) % 4;
  const dx = [0, -1, 0, 1][phase];
  const dy = [-1, 0, 1, 0][phase];
  for (const cxw of [ox + 12, ox + CW - 16]) {
    px(ctx, cxw, wy, 10, 10, PAL.dblk);
    px(ctx, cxw + 3, wy + 3, 4, 4, PAL.steel);
    px(ctx, cxw + 3 + dx, wy + 3 + dy, 4, 4, PAL.gold);
  }
}

/** A tiny pixel "PLAYED" tag stamped on a handed-off Car (viewer feedback). Light
 *  ink on a translucent dark backing so it reads over the body or any scene. */
function drawPlayed(ctx, ox, y) {
  // 3x5 pixel glyphs for P L A Y E D, 1px gap; scale 1 backing px per cell.
  const G = {
    P: ['111', '101', '111', '100', '100'],
    L: ['100', '100', '100', '100', '111'],
    A: ['111', '101', '111', '101', '101'],
    Y: ['101', '101', '111', '010', '010'],
    E: ['111', '100', '111', '100', '111'],
    D: ['110', '101', '101', '101', '110'],
  };
  // The hand-drawn pixel font only has glyphs for the English PLAYED letters. A
  // localized word with other letters can't be drawn here, so fall back to the
  // English glyphs (the departed dim + the HTML PLAYED sub-line still localize).
  const localized = L('overlay.played').toUpperCase();
  const word = [...localized].every((ch) => G[ch]) ? localized : 'PLAYED';
  const gw = 3, gap = 1;
  const textW = word.length * gw + (word.length - 1) * gap;
  const bx = ox + Math.floor((CW - textW) / 2);
  // translucent backing plate
  ctx.globalAlpha = 0.6;
  px(ctx, bx - 2, y - 2, textW + 4, 5 + 4, PAL.dblk);
  ctx.globalAlpha = 1;
  for (let i = 0; i < word.length; i++) {
    const rows = G[word[i]];
    const gx = bx + i * (gw + gap);
    for (let r = 0; r < rows.length; r++)
      for (let c = 0; c < gw; c++)
        if (rows[r][c] === '1') px(ctx, gx + c, y + r, 1, 1, PAL.played);
  }
}

/** The Organiser's tender — a pixel coal-car credit coupled behind the loco.
 *  Darker palette, no NOW/spotlight; dims only with the loco. */
function drawTender(ctx, ox, bob, v, img, f) {
  const bodyTop = 22 + bob;       // sits lower than a coach — a stubby coal-car
  const bodyH = 24;
  const winS = 18;
  const wy = CH - 13 + bob;
  if (ox > 0) px(ctx, ox - 2, bodyTop + bodyH - 9, 4, 5, PAL.steel); // coupler to loco
  // Coal-car body (dark) with a heaped-coal top edge.
  px(ctx, ox + 4, bodyTop, CW - 10, bodyH, PAL.coal);
  px(ctx, ox + 4, bodyTop, CW - 10, 4, PAL.dcoal);
  px(ctx, ox + 4, bodyTop + bodyH - 3, CW - 10, 3, PAL.org); // gold sill
  for (let cx = ox + 8; cx < ox + CW - 8; cx += 5) px(ctx, cx, bodyTop - 2, 3, 3, PAL.coalLump); // coal lumps
  // Organiser avatar in the window.
  const wx = ox + Math.floor((CW - winS) / 2);
  const wyy = bodyTop + 4;
  px(ctx, wx - 2, wyy - 2, winS + 4, winS + 4, PAL.dcoal);
  if (img) { try { ctx.drawImage(img, wx, wyy, winS, winS); } catch { /* tainted/decoding */ } }
  else px(ctx, wx, wyy, winS, winS, PAL.dcoal);
  px(ctx, wx - 2, wyy - 2, winS + 4, 2, PAL.org); // gold window lintel
  drawWheels(ctx, ox, wy, f);
  if (v.isDimmed) { ctx.globalAlpha = 0.22; px(ctx, ox + 4, bodyTop, CW - 10, bodyH, '#555'); ctx.globalAlpha = 1; }
}

/** Draw one Car at canvas-x `ox`, bobbing by `bob`, at frame `f`. */
function drawCar(ctx, ox, bob, v, img, f) {
  if (v.kind === 'tender') { drawTender(ctx, ox, bob, v, img, f); return; }
  const bodyTop = 16 + bob;
  const bodyH = 30;
  const winS = 20;
  const wy = CH - 13 + bob;
  if (ox > 0) px(ctx, ox - 2, bodyTop + bodyH - 9, 4, 5, PAL.steel); // coupler

  if (v.isOpen) {
    const bx = ox + 4;
    const bw = CW - 10;
    for (let x = bx; x < bx + bw; x += 4) { px(ctx, x, bodyTop, 2, 2, PAL.green); px(ctx, x, bodyTop + bodyH - 2, 2, 2, PAL.green); }
    for (let y = bodyTop; y < bodyTop + bodyH; y += 4) { px(ctx, bx, y, 2, 2, PAL.green); px(ctx, bx + bw - 2, y, 2, 2, PAL.green); }
    px(ctx, ox + Math.floor((CW - 22) / 2), bodyTop + Math.floor((bodyH - 12) / 2), 22, 12, PAL.green);
    drawWheels(ctx, ox, wy, f);
    return;
  }

  if (v.kind === 'engine') {
    px(ctx, ox + 6, 8 + bob, 8, 10, PAL.dblk);
    px(ctx, ox + 4, 6 + bob, 12, 3, PAL.dblk);
    for (let k = 0; k < 4; k++) {
      const ph = (f + k * 6) % 24;
      if (ph < 14) px(ctx, ox + 7 - (ph >> 2), 6 + bob - ph, 5 + (ph >> 2), 4, PAL.smoke);
    }
  }
  const bodyCol = v.kind === 'engine' ? PAL.red : v.kind === 'caboose' ? PAL.dred : PAL.blue;
  px(ctx, ox + 4, bodyTop, CW - 10, bodyH, bodyCol);
  px(ctx, ox + 4, bodyTop, CW - 10, 4, v.kind === 'engine' ? PAL.dblk : PAL.dred);
  px(ctx, ox + 4, bodyTop + bodyH - 3, CW - 10, 3, PAL.gold);
  const wx = ox + Math.floor((CW - winS) / 2);
  const wyy = bodyTop + 5;
  px(ctx, wx - 2, wyy - 2, winS + 4, winS + 4, PAL.dblk);
  if (img) { try { ctx.drawImage(img, wx, wyy, winS, winS); } catch { /* tainted/decoding */ } }
  else px(ctx, wx, wyy, winS, winS, PAL.dblk);
  px(ctx, wx - 2, wyy - 2, winS + 4, 2, PAL.gold);
  drawWheels(ctx, ox, wy, f);

  if (v.isCurrent || v.isSpotlit) {
    ctx.strokeStyle = v.isCurrent ? PAL.now : PAL.cyan;
    ctx.lineWidth = 2;
    ctx.strokeRect(ox + 3, bodyTop - 1, CW - 8, bodyH + 2);
    if (v.isCurrent) {
      const bb = (f % 16) < 8 ? 0 : -2;
      px(ctx, ox + Math.floor(CW / 2) - 6, bodyTop - 10 + bb, 12, 4, PAL.now);
      px(ctx, ox + Math.floor(CW / 2) - 2, bodyTop - 6 + bb, 4, 3, PAL.now);
    }
  }
  // Departed treatment (viewer feedback): a LIGHT wash + a PLAYED stamp, not heavy
  // shade — the avatar/name must still read. The loco is the train's eternal leader:
  // it dims only post-event (isDimmed), never on its per-slot isDeparted.
  const handed = v.kind === 'engine' ? v.isDimmed : v.isDeparted;
  if (handed) {
    ctx.globalAlpha = 0.22; px(ctx, ox + 4, bodyTop, CW - 10, bodyH, '#555'); ctx.globalAlpha = 1;
    drawPlayed(ctx, ox, bodyTop + bodyH - 11);
  }
}

/** The HTML sub-line under a Car (time / SIGN UP / ORGANISED BY / PLAYED), and its
 *  state class. The Engine shows its live time (NOW during its slot) with a small
 *  ENGINE tag, not a static label — it's a real streamer and the eternal leader. */
function subText(v) {
  // The tender's handle rides the rt-fit name line; the sub-line is the credit label.
  if (v.kind === 'tender') return L('overlay.organisedBy');
  if (v.isOpen) return L('overlay.signUp');
  // A handed-off Slot reads PLAYED + keeps its time (the loco dims only on isDimmed).
  const handed = v.kind === 'engine' ? v.isDimmed : v.isDeparted;
  const time = (v.timeLines?.[0] || '').toUpperCase();
  if (v.kind === 'engine') {
    const tag = handed ? `▪ ${L('status.departed')}` : L('overlay.conductor');
    return time ? `${tag} · ${time}` : tag;
  }
  if (handed) return time ? `▪ ${L('overlay.played')} · ${time}` : `▪ ${L('overlay.played')}`;
  return time;
}
function cellStateClass(v) {
  const handed = v.kind === 'engine' ? v.isDimmed : v.isDeparted;
  return [
    v.kind === 'tender' ? 'is-tender' : '',
    v.isCurrent ? 'is-now' : '',
    v.isSpotlit ? 'is-spot' : '',
    v.isOpen ? 'is-open' : '',
    handed ? 'is-departed' : '',
  ].filter(Boolean).join(' ');
}

export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train); // mutated in place on a time tick
  // The loco is vehicles[0] (the first streamer). When it has a separate
  // Organiser credit, splice a synthetic tender car right behind it — a coal-car
  // that fuels the train. The tender carries no Slot of its own; it follows the
  // loco's post-event dim (isDimmed).
  const engine = vehicles[0];
  if (engine?.organiser) {
    vehicles.splice(1, 0, {
      kind: 'tender',
      name: engine.organiser.name,
      image: engine.organiser.image,
      isDimmed: Boolean(engine.isDimmed),
    });
  }
  // One backing CW per drawn vehicle (the tender included — the canvas grows by one CW).
  const totalW = Math.max(vehicles.length * CW, 1);

  const node = document.createElement('div');
  node.className = 'pix rt-theme-pixel';
  const canvas = document.createElement('canvas');
  canvas.className = 'pix-canvas';
  canvas.width = totalW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  node.appendChild(canvas);

  // Name row: one cell per Car, aligned under the canvas Cars (flex:1 each).
  const row = document.createElement('div');
  row.className = 'pix-row';
  const cellRefs = new Map();   // slotOrder -> [{ cell, vehicle }] for the Cars
  let engineRef = null;         // the loco's cell (state + time sub-line)
  const tenderCells = [];       // the tender follows engine.isDimmed
  vehicles.forEach((v) => {
    const cell = document.createElement('div');
    cell.className = `pix-cell ${cellStateClass(v)}`.trim();
    const nameHTML = `<div class="pix-name rt-fit">${esc((v.name || L('overlay.open')).toUpperCase())}</div>`;
    const subHTML = `<div class="pix-sub">${esc(subText(v))}</div>`;
    // The tender is a credit: its "ORGANISED BY" label reads ABOVE the handle, like
    // a caption. Every other Car leads with the name, role/time caption below.
    cell.innerHTML = v.kind === 'tender' ? `${subHTML}${nameHTML}` : `${nameHTML}${subHTML}`;
    row.appendChild(cell);
    if (v.kind === 'engine') {
      engineRef = { cell, vehicle: v };
    } else if (v.kind === 'tender') {
      tenderCells.push(cell);
    } else {
      if (!cellRefs.has(v.slotOrder)) cellRefs.set(v.slotOrder, []);
      cellRefs.get(v.slotOrder).push({ cell, vehicle: v });
    }
  });
  node.appendChild(row);
  const tenderVehicle = vehicles.find((v) => v.kind === 'tender') || null;

  // Kick off avatar loads; the running loop (or redraw) picks them up.
  const imgs = vehicles.map(() => null);
  vehicles.forEach((v, i) => { loadImg(v.image).then((im) => { imgs[i] = im; redraw(); }); });

  let f = 0;
  const animate = !reduceMotion();
  function redraw() {
    ctx.clearRect(0, 0, totalW, CH);
    vehicles.forEach((v, i) => {
      const bob = animate ? Math.round(Math.sin(f / 13 - i * 0.55) * 1.6) : 0;
      drawCar(ctx, i * CW, bob, v, imgs[i], f);
    });
  }
  redraw(); // an initial frame before attach / under reduced-motion

  let timer = null;
  return {
    node,
    update(nextTrain) {
      // Mutate the vehicle state the loop draws from, and the HTML sub-lines.
      for (const car of nextTrain.cars) {
        const refs = cellRefs.get(car.slotOrder);
        if (!refs) continue;
        for (const ref of refs) {
          Object.assign(ref.vehicle, {
            isCurrent: car.isCurrent, isDeparted: car.isDeparted,
            isSpotlit: car.isSpotlit, timeLines: car.timeLines ?? [car.relativeTime],
          });
          ref.cell.className = `pix-cell ${cellStateClass(ref.vehicle)}`.trim();
          ref.cell.querySelector('.pix-sub').textContent = subText(ref.vehicle);
        }
      }
      // Drive the loco's live state + time sub-line from nextTrain.engine.
      // It stays bright after its slot — only the
      // post-event isDimmed dims it (gated in drawCar / subText), never isDeparted.
      const eng = nextTrain.engine;
      if (engineRef) {
        Object.assign(engineRef.vehicle, {
          isCurrent: Boolean(eng.isCurrent),
          isSpotlit: Boolean(eng.isSpotlit),
          isDimmed: Boolean(eng.isDimmed),
          timeLines: eng.timeLines ?? [eng.relativeTime ?? ''],
        });
        engineRef.cell.className = `pix-cell ${cellStateClass(engineRef.vehicle)}`.trim();
        engineRef.cell.querySelector('.pix-sub').textContent = subText(engineRef.vehicle);
      }
      // The tender follows the loco's post-event dim.
      if (tenderVehicle) tenderVehicle.isDimmed = Boolean(eng.isDimmed);
      for (const cell of tenderCells) cell.classList.toggle('is-departed', Boolean(eng.isDimmed));
      if (!animate) redraw(); // reduced-motion: no loop, so repaint on the tick
    },
    afterAttach() {
      fitAll(node);
      if (!animate || timer !== null) return;
      timer = setInterval(() => {
        // Self-terminate when this copy leaves the document (re-render / marquee).
        if (!canvas.isConnected) { clearInterval(timer); timer = null; return; }
        f += 1;
        redraw();
      }, FRAME_MS);
    },
  };
}

export default { key: 'pixel', ensureStyles, build, buildTrack };
