/**
 * pride — the Pride Parade Theme. A celebratory rainbow train: every car body is
 * the classic 6-stripe Pride flag, a sleek "steam-bullet" locomotive leads (a
 * duckbill nose wearing a rainbow flank stripe, a smokestack puffing RAINBOW
 * smoke, a permanent shiny sheen-glow so it reads bright, not dark), and a
 * cupola caboose with a rooftop mini-rainbow lookout + a glowing tail-lamp brings
 * up the rear. Strung bunting, twinkling sparkles, and a full-width band of
 * rushing rainbow speed-lines complete the parade. Ported from the locked
 * prototype (test/manual/prototype-pride.html), wired to the live Train view-model.
 *
 *  - viewBox only (no width/height) so CSS --rt-th sizes it, exactly like the
 *    other SVG Themes.
 *  - ONE car = ONE vehicle. The body of every coach IS the flag (full-bleed 6
 *    horizontal stripes), with a translucent window band over it. The lead car
 *    (the locomotive — the ORGANISER, who conducts the train) is the sleek
 *    steam-bullet; the last coach is the cupola caboose.
 *  - State is the shared toggleable classes (rt-car--current / --spotlit /
 *    --departed) so Now + Spotlight coexist and a time tick updates in place. A
 *    departed Slot is lightly dimmed + stamped PLAYED (legibility — viewer
 *    feedback). The loco carries no per-slot state — it dims only post-event
 *    (isDimmed) and never stamps.
 *  - Per-car art/sparkle/bunting placement is DETERMINISTIC (indexed, no
 *    Math.random) — the renderer calls build() once per marquee copy, so every
 *    copy must match for a seamless loop.
 *  - PERF (non-negotiable — a slow overlay can crash OBS): NO per-frame filters.
 *    The Now/Spotlight glow is a CSS drop-shadow over the STATIC .pride-art group
 *    (wheels / RAINBOW smoke / sparkles / bunting / the NOW pointer / the caboose
 *    railing + tail-lamp all ride SIBLING layers, so a lit Car's filter bitmap
 *    caches across frames instead of re-rasterising the motion). The loco's
 *    permanent sheen-glow is likewise a drop-shadow on its STATIC art (the loco
 *    never gets current/spotlit, so its raster caches once). Sparkles twinkle via
 *    opacity/scale only; rainbow smoke reuses the renderer's shared .rt-smoke puff
 *    keyframe; the scene-band speed-lines translateX only. All motion is disabled
 *    under prefers-reduced-motion.
 *
 * Transparent only — no full-bleed background.
 */
import { SVG_NS, esc, pointerSVG, avatarSVG, wheel, fitAll, undulate, toVehicles, themeT } from './shared-svg.js';

// The translator the builders paint with: rebound to the active locale at the top
// of build() (themeT reads config.t), English until then. Module-level is safe —
// build() runs synchronously start to finish before any other render.
let L = themeT();

// The classic 6-stripe Pride flag, top→bottom.
const RAINBOW = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#004dff', '#750787'];

const ENG = 280;          // the steam-bullet loco rides wider
const CAR = 196;          // one coach's width, in viewBox units
const GAP = 16;
const cTop = 78;          // car-body top, in viewBox units
const cBot = 172;         // car-body bottom
const railY = 198;        // the wheel/rail line
const wheelCy = 182;      // wheel centres
const nameY = 222;        // broadcaster name baseline (below the body)
const timeY = 240;        // time line baseline
const TIME_LH = 14;       // line-height for stacked tz time lines
// Headroom above the body for the NOW pointer, smoke, bunting, and the cupola.
const VIEW_TOP = -58;
const VIEW_H = 254 - VIEW_TOP;
const STYLE_ID = 'rt-theme-pride-style';

const mid = (x, w) => x + w / 2;

/* ── string builders (stateless) ──────────────────────────────────────── */

/** 6 stacked rainbow bands filling x..x+w, y..y+h — the full-flag body / livery line. */
function liveryBands(x, w, y, h, pal = RAINBOW) {
  const bh = h / pal.length;
  return pal.map((c, k) => `<rect x="${x}" y="${(y + k * bh).toFixed(2)}" width="${w}" height="${(bh + 0.6).toFixed(2)}" fill="${c}"/>`).join('');
}

/** A translucent dark window band (with a light frame + mullions) over the stripes. */
function windowBand(x, wy, ww, wh) {
  let s = `<rect x="${x}" y="${wy}" width="${ww}" height="${wh}" rx="9" fill="#0a1c28" opacity=".62"/>`;
  s += `<rect x="${x}" y="${wy}" width="${ww}" height="${wh}" rx="9" fill="none" stroke="#ffffff" stroke-width="1.2" opacity=".4"/>`;
  for (let gx = x + 22; gx < x + ww - 6; gx += 26) s += `<line x1="${gx}" y1="${wy}" x2="${gx}" y2="${wy + wh}" stroke="#0a1a26" stroke-width="2" opacity=".5"/>`;
  return s;
}

/** A STATIC diagonal specular shine sweep — placed INSIDE a car's clip group. */
function sweep(x, w) {
  return `<rect x="${x + w * 0.2}" y="${cTop - 12}" width="30" height="${cBot - cTop + 24}" fill="url(#pride-sweepG)" transform="skewX(-20)" opacity=".5"/>`;
}

/** Twinkling 4-point star glints (SIBLING layer — opacity/scale only). Deterministic.
 *  `pts` is a list of { x, y, r?, c? }; some glints are rainbow-tinted for extra shimmer. */
function sparkles(pts) {
  return pts.map((p, k) => {
    const r = (p.r ?? 5) * 1.3, o = p.x, c = p.y, col = p.c || '#ffffff';
    const d = `M ${o} ${c - r} L ${o + r * 0.26} ${c - r * 0.26} L ${o + r} ${c} L ${o + r * 0.26} ${c + r * 0.26} L ${o} ${c + r} L ${o - r * 0.26} ${c + r * 0.26} L ${o - r} ${c} L ${o - r * 0.26} ${c - r * 0.26} Z`;
    return `<path class="pride-spark" style="--td:${(1.7 + (k % 4) * 0.45).toFixed(2)}s;--tdelay:${(-(k % 5) * 0.5).toFixed(2)}s" d="${d}" fill="${col}"/>`;
  }).join('');
}

/** One strung bunting flag (SIBLING — sways via .pride-flag, pivoting from its strung
 *  top edge). A deterministic per-flag delay (from its x+y) keeps neighbours out of
 *  lock-step while staying identical across marquee copies for a seamless loop. */
const bunting = (fx, fy, col) => `<g class="pride-flag" style="animation-delay:${(-((fx + fy) % 13) * 0.16).toFixed(2)}s"><path d="M ${fx} ${fy} l 14 0 l -7 14 Z" fill="${col}"/></g>`;

/** RAINBOW smoke: a .rt-smoke group of five puffs (the renderer's base CSS staggers
 *  them upward) — same hook as classic's grey smoke, recoloured to the flag. */
function rainbowSmoke(cx, baseY) {
  const puffs = [[0, 0, 11], [11, -13, 9], [-9, -12, 8], [5, -25, 7], [-5, -34, 6]];
  return `<g class="rt-smoke">${puffs.map(([dx, dy, r], k) => `<circle cx="${cx + dx}" cy="${baseY + dy}" r="${r}" fill="${RAINBOW[k % 6]}"/>`).join('')}</g>`;
}

/** The Now Marker pointer (SIBLING — base CSS reveals it on .rt-car--current + bobs it). */
const nowPointer = (cx) => `<g class="rt-pointer rt-now-bob">${pointerSVG(cx, VIEW_TOP + 26, '#fbbf24', esc(L('overlay.now')))}</g>`;

/** The PLAYED stamp (in .pride-art; base CSS reveals it on .rt-car--departed, and
 *  suppresses it on the engine). */
const prideStamp = (ccx) => `<g class="pride-stamp" transform="rotate(-8 ${ccx} ${cTop + 40})"><rect x="${ccx - 44}" y="${cTop + 24}" width="88" height="30" rx="5" fill="#2a0a0acc" stroke="#ff9a9a" stroke-width="2.5"/><text x="${ccx}" y="${cTop + 45}" text-anchor="middle" font-weight="800" font-size="15" fill="#ffd0d0" letter-spacing="1">${esc(L('overlay.played'))}</text></g>`;

/** Bottom-anchored stacked time lines (1 line for relative, up to 3 for tz). */
function timeTspans(lines, x, baseY) {
  return (lines.length ? lines : ['']).map((line, i) => `<tspan x="${x}" y="${baseY - (lines.length - 1 - i) * TIME_LH}">${esc(line)}</tspan>`).join('');
}

/** Rewrite a .pride-time block in place on a time tick — text only, no structure. */
function setTimeLines(textEl, lines) {
  const x = textEl.getAttribute('x');
  const baseY = Number(textEl.getAttribute('y'));
  textEl.replaceChildren();
  (lines.length ? lines : ['']).forEach((line, i) => {
    const tspan = document.createElementNS(SVG_NS, 'tspan');
    tspan.setAttribute('x', x);
    tspan.setAttribute('y', String(baseY - (lines.length - 1 - i) * TIME_LH));
    tspan.textContent = line;
    textEl.appendChild(tspan);
  });
}

/* ── the vehicles ─────────────────────────────────────────────────────── */

/** The steam-bullet LOCOMOTIVE (the ORGANISER — no per-slot state). A duckbill nose
 *  + raised cab, a luminous violet body, a rainbow flank stripe, a rainbow nose
 *  chevron, a smokestack with RAINBOW smoke, a cowcatcher, and a permanent
 *  sheen-glow (the .pride-art drop-shadow in ensureStyles). */
function prideLoco(v, x, w, i) {
  const body = `M ${x} ${railY - 26} C ${x + 6} ${railY - 56} ${x + 22} ${cTop + 32} ${x + 80} ${cTop + 16} C ${x + 124} ${cTop + 4} ${x + 158} ${cTop} ${x + 200} ${cTop} L ${x + w - 12} ${cTop - 6} Q ${x + w} ${cTop - 6} ${x + w} ${cTop + 10} L ${x + w} ${cBot} Q ${x + w} ${cBot + 4} ${x + w - 6} ${cBot + 4} L ${x + 12} ${cBot + 4} Q ${x} ${cBot + 2} ${x} ${railY - 26} Z`;
  const stackX = x + 58, acx = x + w - 42, acy = cBot - 26, R = 22;
  let art = `<g class="pride-art">`;
  art += `<clipPath id="pride-eclip-${i}"><path d="${body}"/></clipPath>`;
  art += `<path d="${body}" fill="url(#pride-engG)"/>`;
  art += `<rect x="${x + w - 72}" y="${cTop - 6}" width="58" height="${cBot - cTop + 6}" rx="10" fill="#20131c"/>`;
  // flank rainbow pinstripe + shine, gloss, sweep, driver window — clipped to the body
  art += `<g clip-path="url(#pride-eclip-${i})">${liveryBands(x, w, 113, 22)}`;
  art += `<rect x="${x}" y="111" width="${w}" height="2" fill="#0006"/><rect x="${x}" y="135" width="${w}" height="2" fill="#0006"/>`;
  art += `<rect x="${x}" y="113.5" width="${w}" height="2.4" fill="#ffffff" opacity=".5"/>`;
  art += `<rect x="${x + 8}" y="${cTop + 2}" width="${w - 72}" height="9" rx="4" fill="#ffffff" opacity=".55"/>`;
  art += sweep(x, w);
  art += `<rect x="${x + w - 58}" y="${cTop + 6}" width="40" height="26" rx="6" fill="#0a1c28" opacity=".55"/><rect x="${x + w - 58}" y="${cTop + 6}" width="40" height="6" rx="3" fill="#fff" opacity=".22"/></g>`;
  // nose chevron — 6 raked rainbow slashes along the duckbill
  for (let k = 0; k < 6; k++) {
    const px = x + 10 + k * 4.2, py = cTop + 40 + k * 4;
    art += `<line x1="${px}" y1="${py}" x2="${px + 16}" y2="${py - 8}" stroke="${RAINBOW[k]}" stroke-width="5" stroke-linecap="round"/>`;
  }
  // smokestack (static body) + cowcatcher + headlamp + bright outline
  art += `<rect x="${stackX - 16}" y="${cTop - 22}" width="32" height="8" rx="3" fill="#4a3550"/><rect x="${stackX - 11}" y="${cTop - 18}" width="22" height="30" rx="3" fill="#33232e"/>`;
  art += `<path d="M ${x + 4} ${cBot} L ${x - 18} ${railY + 2} L ${x + 30} ${railY + 2} L ${x + 30} ${cBot} Z" fill="#2b2230"/>`;
  for (let k = 0; k < 3; k++) art += `<line x1="${x - 10 + k * 12}" y1="${cBot}" x2="${x - 14 + k * 12}" y2="${railY + 2}" stroke="#6a4f8f" stroke-width="2"/>`;
  art += `<circle cx="${x + 20}" cy="${cTop + 44}" r="9" fill="#ffe9a8"/><circle cx="${x + 20}" cy="${cTop + 44}" r="9" fill="none" stroke="#caa24a" stroke-width="2"/>`;
  art += `<path d="${body}" fill="none" stroke="#7a5ea8" stroke-width="2"/>`;
  // organiser avatar + spotlight halo (the loco never spotlights, but keep parity) + name + time
  art += avatarSVG(`pride-av-${i}`, acx, acy, R, v.image, v.name, '#f6cf5a');
  art += `<circle class="pride-halo" cx="${acx}" cy="${acy}" r="${R + 8}" fill="none" stroke="#22d3ee" stroke-width="2"/>`;
  art += `<text class="rt-fit pride-name" data-maxw="${w - 40}" x="${mid(x, w)}" y="${nameY}" text-anchor="middle" font-weight="800" font-size="16" fill="#ffffff">${esc(v.name)}</text>`;
  art += `<text class="pride-time" x="${mid(x, w)}" y="${timeY}" text-anchor="middle" font-weight="700" font-size="12" fill="#cbd5e1">${timeTspans(v.timeLines, mid(x, w), timeY)}</text>`;
  art += `</g>`;
  // siblings: rainbow smoke, driver + leading wheels, sparkles
  let sib = rainbowSmoke(stackX, cTop - 24);
  sib += wheel(x + 150, 178, 28, '#241a30', 12);
  sib += wheel(x + 58, 182, 13, '#241a30') + wheel(x + 96, 182, 13, '#241a30');
  sib += sparkles([{ x: x + 92, y: cTop + 20, r: 5, c: '#fff' }, { x: x + 150, y: cTop + 6, r: 4, c: RAINBOW[3] }, { x: x + w - 50, y: cTop - 2, r: 4.5 }, { x: x + 44, y: cTop + 32, r: 3.4, c: RAINBOW[0] }]);
  return art + sib;
}

/** A full-flag striped COACH: body IS the rainbow, a window band over it, bunting
 *  above, sparkles, and the avatar/name/time. */
function prideCoach(v, x, w, i) {
  const ccx = mid(x, w), clip = `pride-cclip-${i}`;
  const ring = v.isSpotlit ? '#22d3ee' : '#eef4fb';
  let art = `<g class="pride-art">`;
  art += `<clipPath id="${clip}"><rect x="${x}" y="${cTop}" width="${w}" height="${cBot - cTop}" rx="16"/></clipPath>`;
  art += `<g clip-path="url(#${clip})">${liveryBands(x, w, cTop, cBot - cTop)}<rect x="${x}" y="${cTop}" width="${w}" height="22" fill="#fff" opacity=".24"/>${sweep(x, w)}</g>`;
  art += windowBand(x + 18, cTop + 12, w - 36, 22);
  art += `<rect x="${x}" y="${cTop}" width="${w}" height="${cBot - cTop}" rx="16" fill="none" stroke="#1a2230" stroke-width="2"/>`;
  art += `<rect x="${x + 3}" y="${cTop + 3}" width="${w - 6}" height="6" rx="3" fill="#ffffff" opacity=".35"/>`;
  art += avatarSVG(`pride-av-${i}`, ccx, cBot - 26, 24, v.image, v.name, ring);
  art += `<circle class="pride-halo" cx="${ccx}" cy="${cBot - 26}" r="32" fill="none" stroke="#22d3ee" stroke-width="2"/>`;
  art += `<text class="rt-fit pride-name" data-maxw="${w - 16}" x="${ccx}" y="${nameY}" text-anchor="middle" font-weight="800" font-size="16" fill="#eef4fb">${esc(v.name)}</text>`;
  art += `<text class="pride-time" x="${ccx}" y="${timeY}" text-anchor="middle" font-weight="700" font-size="12" fill="${v.isCurrent ? '#fbbf24' : '#90a4b8'}">${timeTspans(v.timeLines, ccx, timeY)}</text>`;
  art += prideStamp(ccx);
  art += `</g>`;
  let sib = wheel(x + 46, wheelCy, 16, '#2a2f3a') + wheel(x + w - 46, wheelCy, 16, '#2a2f3a');
  for (let f = 0; f < 3; f++) { const fx = x + 30 + f * ((w - 60) / 2); sib += bunting(fx, cTop - 22, RAINBOW[(i + f) % 6]); }
  sib += sparkles([{ x: x + 34, y: cTop + 12, r: 4.5, c: RAINBOW[i % 6] }, { x: x + w - 38, y: cTop + 9, r: 4 }, { x: ccx + 28, y: cBot - 42, r: 3.4, c: RAINBOW[(i + 3) % 6] }, { x: ccx - 30, y: cTop + 30, r: 3.2 }]);
  sib += nowPointer(ccx);
  return art + sib;
}

/** An OPEN sit-in slot — a dashed ghost car (no avatar), still carries the marker. */
function prideOpen(v, x, w, i) {
  const ccx = mid(x, w);
  let art = `<g class="pride-art">`;
  art += `<rect x="${x}" y="${cTop}" width="${w}" height="${cBot - cTop}" rx="16" fill="#0c141d" opacity=".4"/>`;
  art += `<rect x="${x}" y="${cTop}" width="${w}" height="${cBot - cTop}" rx="16" fill="none" stroke="#5b7f9a" stroke-width="2.5" stroke-dasharray="9 8"/>`;
  art += `<text x="${ccx}" y="${cTop + 50}" text-anchor="middle" font-weight="900" font-size="24" fill="#7aa0bd">${esc(L('overlay.open'))}</text>`;
  art += `<text x="${ccx}" y="${cTop + 74}" text-anchor="middle" font-weight="700" font-size="12" fill="#7aa0bd">${esc(L('overlay.signUp'))}</text>`;
  art += `<text class="pride-time" x="${ccx}" y="${timeY}" text-anchor="middle" font-weight="700" font-size="12" fill="${v.isCurrent ? '#fbbf24' : '#90a4b8'}">${timeTspans(v.timeLines, ccx, timeY)}</text>`;
  art += `</g>`;
  let sib = wheel(x + 46, wheelCy, 16, '#2a2f3a') + wheel(x + w - 46, wheelCy, 16, '#2a2f3a');
  sib += nowPointer(ccx);
  return art + sib;
}

/** The cupola CABOOSE (the rear) — full-flag body + a rooftop mini-rainbow cupola,
 *  a rear platform railing + tail-lamp (static siblings), and the avatar/name keyed
 *  to the LIVERY-body centre so they never drift under the dark rear porch. */
function prideCaboose(v, x, w, i) {
  const bodyW = w - 26, ccx = mid(x, bodyW), clip = `pride-cabclip-${i}`, cupClip = `pride-cupclip-${i}`;
  const cupX = x + 64, cupY = 58, cupW = 68, cupH = cTop - 58 + 4;
  const ring = v.isSpotlit ? '#22d3ee' : '#eef4fb';
  let art = `<g class="pride-art">`;
  art += `<clipPath id="${clip}"><rect x="${x}" y="${cTop}" width="${bodyW}" height="${cBot - cTop}" rx="16"/></clipPath>`;
  art += `<g clip-path="url(#${clip})">${liveryBands(x, bodyW, cTop, cBot - cTop)}<rect x="${x + 3}" y="${cTop + 3}" width="${bodyW - 6}" height="8" rx="3" fill="#fff" opacity=".42"/>${sweep(x, bodyW)}</g>`;
  art += windowBand(x + 18, cTop + 12, bodyW - 42, 22);
  art += `<rect x="${x}" y="${cTop}" width="${bodyW}" height="${cBot - cTop}" rx="16" fill="none" stroke="#1a2230" stroke-width="2"/>`;
  // cupola lookout (mini rainbow)
  art += `<rect x="${cupX - 5}" y="50" width="78" height="10" rx="4" fill="#222a36"/><rect x="${cupX - 5}" y="51" width="78" height="2" rx="1" fill="#fff" opacity=".3"/>`;
  art += `<clipPath id="${cupClip}"><rect x="${cupX}" y="${cupY}" width="${cupW}" height="${cupH}" rx="6"/></clipPath>`;
  art += `<g clip-path="url(#${cupClip})">${liveryBands(cupX, cupW, cupY, cupH)}</g>`;
  art += `<rect x="${cupX}" y="${cupY}" width="${cupW}" height="${cupH}" rx="6" fill="none" stroke="#1a2230" stroke-width="2"/>`;
  art += `<rect x="${cupX + 8}" y="${cupY + 5}" width="18" height="12" rx="2" fill="#0a1c28" opacity=".6"/><rect x="${cupX + 42}" y="${cupY + 5}" width="18" height="12" rx="2" fill="#0a1c28" opacity=".6"/>`;
  // rear deck + end wall (so the tail "opens up")
  art += `<rect x="${x + w - 30}" y="${cBot - 30}" width="30" height="30" fill="#222a36"/>`;
  art += `<rect x="${x + w - 30}" y="${cTop}" width="4" height="${cBot - cTop}" fill="#1a2230"/>`;
  art += avatarSVG(`pride-av-${i}`, ccx, cBot - 26, 24, v.image, v.name, ring);
  art += `<circle class="pride-halo" cx="${ccx}" cy="${cBot - 26}" r="32" fill="none" stroke="#22d3ee" stroke-width="2"/>`;
  art += `<text class="rt-fit pride-name" data-maxw="${bodyW - 16}" x="${ccx}" y="${nameY}" text-anchor="middle" font-weight="800" font-size="16" fill="#eef4fb">${esc(v.name)}</text>`;
  art += `<text class="pride-time" x="${ccx}" y="${timeY}" text-anchor="middle" font-weight="700" font-size="12" fill="${v.isCurrent ? '#fbbf24' : '#90a4b8'}">${timeTspans(v.timeLines, ccx, timeY)}</text>`;
  art += prideStamp(ccx);
  art += `</g>`;
  // siblings: wheels (rear pulled in under the body), railing + tail-lamp (static,
  // kept OUT of .art so the glow bitmap is just the body), bunting, sparkles, marker
  let sib = wheel(x + 46, wheelCy, 16, '#2a2f3a') + wheel(x + w - 66, wheelCy, 16, '#2a2f3a');
  sib += `<g stroke="#c3ccd6" fill="none"><line x1="${x + w - 26}" y1="${cBot - 32}" x2="${x + w - 26}" y2="${cBot - 2}" stroke-width="3"/><line x1="${x + w - 4}" y1="${cBot - 32}" x2="${x + w - 4}" y2="${cBot - 2}" stroke-width="3"/><line x1="${x + w - 26}" y1="${cBot - 32}" x2="${x + w - 4}" y2="${cBot - 32}" stroke-width="3"/><line x1="${x + w - 26}" y1="${cBot - 18}" x2="${x + w - 4}" y2="${cBot - 18}" stroke-width="2"/></g>`;
  sib += `<line x1="${x + w - 15}" y1="${cBot - 22}" x2="${x + w - 15}" y2="${cBot - 4}" stroke="#c3ccd6" stroke-width="2"/><circle cx="${x + w - 15}" cy="${cBot - 22}" r="8" fill="none" stroke="#e40303" opacity=".35"/><circle cx="${x + w - 15}" cy="${cBot - 22}" r="5" fill="#e40303"/>`;
  sib += bunting(cupX + 14, 46, RAINBOW[i % 6]) + bunting(cupX + 44, 46, RAINBOW[(i + 2) % 6]);
  sib += sparkles([{ x: cupX + 34, y: cupY + 3, r: 4, c: RAINBOW[(i + 1) % 6] }, { x: x + 28, y: cTop + 12, r: 4.5 }, { x: ccx + 22, y: cBot - 44, r: 3.4, c: RAINBOW[(i + 4) % 6] }]);
  sib += nowPointer(ccx);
  return art + sib;
}

/** The shared defs: STATIC gradients only (the loco body sheen + the specular sweep). */
function prideDefs() {
  return `<defs>
    <linearGradient id="pride-engG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b79bd6"/><stop offset=".42" stop-color="#6e54a0"/><stop offset="1" stop-color="#2e2140"/></linearGradient>
    <linearGradient id="pride-sweepG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>`;
}

/* 1) ensureStyles() — inject the Theme's CSS once (keyed by an id). State is the
 *    shared .rt-car--current/--spotlit/--departed classes; the Now/Spotlight GLOW is
 *    a drop-shadow over the STATIC .pride-art group, and the loco carries a permanent
 *    sheen-glow on the same static group. All motion (sparkles, the scene band) is
 *    compositor-only and disabled under prefers-reduced-motion. */
export function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Now/Spotlight glow — a drop-shadow over the STATIC .pride-art group only. */
    .rt-theme-pride .rt-car--current .pride-art { filter: drop-shadow(0 0 4px #fbbf24) drop-shadow(0 0 10px #fbbf24); }
    .rt-theme-pride .rt-car--spotlit .pride-art { filter: drop-shadow(0 0 4px #22d3ee) drop-shadow(0 0 9px #22d3ee); }
    .rt-theme-pride .rt-car--current.rt-car--spotlit .pride-art { filter: drop-shadow(0 0 4px #fbbf24) drop-shadow(0 0 8px #22d3ee); }
    /* The loco reads BRIGHT, not dark: a permanent soft white-pink sheen-glow on its
       STATIC art. The loco never gets current/spotlit, so this rasterises once + caches. */
    .rt-theme-pride [data-engine] .pride-art { filter: drop-shadow(0 0 3px #ffffff) drop-shadow(0 0 11px rgba(255,140,220,.55)); }

    /* A handed-off Slot stays readable — a light dim + a PLAYED stamp (viewer feedback). */
    .rt-theme-pride .rt-car--departed { opacity: 0.84; }
    .rt-theme-pride .rt-car--departed image { filter: saturate(0.5); }
    .rt-theme-pride .pride-stamp { visibility: hidden; }
    .rt-theme-pride .rt-car--departed .pride-stamp { visibility: visible; }

    /* A contrast floor for the name + time: a dark stroke drawn UNDER the fill
       (paint-order) so they stay legible over the busy rainbow scene-band on a bright
       stream. Static, no per-frame cost — and unlike a per-car plate it adds no DOM. */
    .rt-theme-pride .pride-name, .rt-theme-pride .pride-time { paint-order: stroke; stroke: #0a1420; stroke-width: 3px; stroke-opacity: .6; stroke-linejoin: round; }

    /* Spotlit avatar halo — a glowing cyan ring, revealed on .rt-car--spotlit. Static
       element inside .pride-art, so the drop-shadow is a cached one-time raster. */
    .rt-theme-pride .pride-halo { visibility: hidden; }
    .rt-theme-pride .rt-car--spotlit .pride-halo { visibility: visible; filter: drop-shadow(0 0 8px #22d3ee); }

    /* Twinkling sparkle glints (sibling layer) — opacity/scale only. */
    .rt-theme-pride .pride-spark { transform-box: fill-box; transform-origin: center; animation: pride-twinkle var(--td, 2.2s) ease-in-out infinite; animation-delay: var(--tdelay, 0s); will-change: transform, opacity; }
    @keyframes pride-twinkle { 0%, 100% { opacity: .25; transform: scale(.6); } 50% { opacity: 1; transform: scale(1.25); } }
    /* Bunting flutter (sibling layer). transform-origin is TOP-CENTRE (50% 0) so each
       pennant sways from where it's strung — fill-box resolves that against the flag's
       OWN bbox, so we must NOT set a px transform-origin (a viewBox-px origin under
       fill-box lands the pivot far off the 14px triangle and flings it diagonally). */
    .rt-theme-pride .pride-flag { transform-box: fill-box; transform-origin: 50% 0; animation: pride-flutter 2.6s ease-in-out infinite; will-change: transform; }
    @keyframes pride-flutter { 0%, 100% { transform: rotate(-3deg) skewX(2deg); } 50% { transform: rotate(4deg) skewX(-3deg); } }

    /* ── The stationary SCENE BAND (buildTrack): full-width rushing RAINBOW speed-lines
       behind the train. Never opaque, never full-frame — the top of the canvas stays
       see-through. preserveAspectRatio="none" stretches a normalized 0..100 box to the
       live canvas width; horizontal streaking is the goal. translateX only. ─────── */
    .rt-rails-pride { top: var(--rt-band-top); height: var(--rt-band-h); overflow: hidden; }
    .rt-rails-pride .pride-band { position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: .7;
      -webkit-mask: linear-gradient(90deg, #0000, #000 7%, #000 93%, #0000); mask: linear-gradient(90deg, #0000, #000 7%, #000 93%, #0000); }
    .pride-lane { transform-box: fill-box; transform-origin: center; animation: pride-stream var(--sd, 2.4s) linear infinite; will-change: transform; }
    @keyframes pride-stream { from { transform: translateX(-50%); } to { transform: translateX(0); } }

    @media (prefers-reduced-motion: reduce) {
      .rt-theme-pride .pride-spark, .rt-theme-pride .pride-flag, .pride-lane { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

/* 2) buildTrack() — the SCENE BAND. ONE stationary, full-canvas-width element built
 *    once (never per-car): full-width rushing RAINBOW speed-lines at a few depths/
 *    speeds (parallax). The renderer pins this full-width behind the train and fades
 *    it under track=periodic. Lower band (top near the train band, height ~--rt-th) so
 *    the top of the frame stays see-through. NO per-frame filters: motion is translateX. */
export function buildTrack() {
  const el = document.createElement('div');
  el.className = 'rt-rails rt-rails-pride';
  const bandTopU = (cTop - 26 - VIEW_TOP) / VIEW_H;
  const bandHU = (railY + 40 - (cTop - 26)) / VIEW_H;
  el.style.setProperty('--rt-band-top', `calc(var(--rt-th) * ${bandTopU.toFixed(4)})`);
  el.style.setProperty('--rt-band-h', `calc(var(--rt-th) * ${bandHU.toFixed(4)})`);
  // A handful of lanes; each its own y / thickness / speed for parallax. CAPPED.
  const lanes = [{ y: 4, t: 3, sd: 1.6 }, { y: 20, t: 2.4, sd: 2.4 }, { y: 46, t: 2.6, sd: 3.2 }, { y: 70, t: 3, sd: 1.9 }, { y: 86, t: 2.4, sd: 2.7 }];
  let band = `<svg class="pride-band" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">`;
  for (const ln of lanes) {
    // One tiled lane = a 200%-wide group of dashes; the -50% loop is seamless because
    // the second half repeats the first. Deterministic, no Math.random.
    band += `<g class="pride-lane" style="--sd:${ln.sd}s">`;
    for (let half = 0; half < 2; half++) {
      for (let d = 0; d < 8; d++) {
        const px = half * 100 + d * 12.5 + (d % 2) * 1.4;
        const len = 7 + (d % 3) * 2;
        band += `<rect x="${px.toFixed(2)}" y="${ln.y}" width="${len}" height="${ln.t}" rx="${(ln.t / 2).toFixed(1)}" fill="${RAINBOW[d % 6]}"/>`;
      }
    }
    band += `</g>`;
  }
  band += `</svg>`;
  el.innerHTML = band;
  return el;
}

/* 3) build(train, opts) — build the Train art ONCE and return a handle. toVehicles()
 *    flattens the live view-model: vehicles[0] is the locomotive (the ORGANISER) = the
 *    steam-bullet lead; the rest are the coaches; the last (isCaboose) is the cupola
 *    caboose. The loco carries no per-slot state — it dims only post-event (isDimmed). */
export function build(train, opts = {}) {
  L = themeT(opts);
  const vehicles = toVehicles(train);
  // Derive the role from the view-model, NOT the index: when the Engine is hidden
  // (post-event hidefinished + enginedim=finished) toVehicles drops it, so
  // vehicles[0] is a real coach — keying off `i === 0` would draw that streamer as
  // the locomotive and orphan it from the per-slot time ticks (carRefs). kind is the
  // source of truth (toVehicles sets kind:'engine' only on the real loco).
  const widthOf = (i) => (vehicles[i].kind === 'engine' ? ENG : CAR);
  const xs = [];
  let acc = 0;
  vehicles.forEach((_, i) => { xs.push(acc); acc += widthOf(i) + GAP; });
  const totalW = Math.max(acc - GAP, 1);

  let body = '';
  vehicles.forEach((v, i) => {
    const w = widthOf(i);
    const isEngine = v.kind === 'engine';
    const inner = isEngine ? prideLoco(v, xs[i], w, i)
      : v.isOpen ? prideOpen(v, xs[i], w, i)
        : (v.isCaboose || v.kind === 'caboose') ? prideCaboose(v, xs[i], w, i)
          : prideCoach(v, xs[i], w, i);
    // The loco is the Organiser — no Slot, so it dims only post-event (isDimmed),
    // never on a per-slot isDeparted. Coaches use isDeparted.
    const departed = isEngine ? v.isDimmed : v.isDeparted;
    const state =
      (v.isCurrent ? ' rt-car--current' : '') +
      (v.isSpotlit ? ' rt-car--spotlit' : '') +
      (departed ? ' rt-car--departed' : '');
    const slot = isEngine ? ' data-engine="1"' : ` data-slot="${v.slotOrder}"`;
    body += `<g class="rt-car${state}"${slot}>${inner}</g>`;
  });

  const holder = document.createElement('div');
  // --rt-ride 0.75 — a parade train with a little life, but sleeker than wood/comic.
  holder.innerHTML = `<svg class="rt-theme-pride" viewBox="0 ${VIEW_TOP} ${totalW} ${VIEW_H}" role="img" style="--rt-ride:0.75">${prideDefs()}${body}</svg>`;
  const svg = holder.firstElementChild;

  // Keep references so a time tick re-styles in place (never a rebuild).
  const carRefs = new Map();
  let engineRef = null;
  svg.querySelectorAll('.rt-car').forEach((g) => {
    if (g.dataset.engine) { engineRef = { group: g, timeText: g.querySelector('.pride-time') }; return; }
    carRefs.set(Number(g.dataset.slot), { group: g, timeText: g.querySelector('.pride-time') });
  });

  return {
    node: svg,
    /* update(nextTrain) — re-style state IN PLACE on the renderer's tick: toggle the
     *  shared classes (cars by slotOrder; engine by data-engine, departed = isDimmed)
     *  and rewrite the time text. Never rebuild, so running motion isn't restarted. */
    update(nextTrain) {
      for (const car of nextTrain.cars) {
        const ref = carRefs.get(car.slotOrder);
        if (!ref) continue;
        ref.group.classList.toggle('rt-car--current', car.isCurrent);
        ref.group.classList.toggle('rt-car--departed', car.isDeparted);
        ref.group.classList.toggle('rt-car--spotlit', car.isSpotlit);
        if (ref.timeText) setTimeLines(ref.timeText, car.timeLines ?? [car.relativeTime]);
      }
      const eng = nextTrain.engine;
      if (engineRef) {
        engineRef.group.classList.toggle('rt-car--current', Boolean(eng.isCurrent));
        engineRef.group.classList.toggle('rt-car--spotlit', Boolean(eng.isSpotlit));
        engineRef.group.classList.toggle('rt-car--departed', Boolean(eng.isDimmed));
        if (engineRef.timeText) setTimeLines(engineRef.timeText, eng.timeLines ?? [eng.relativeTime ?? '']);
      }
    },
    /* afterAttach() — runs once the node is in the document: fit the names to their
     *  cars (no truncation) and start the per-Car ambient undulation. */
    afterAttach() {
      fitAll(svg);
      undulate(svg);
    },
  };
}

// 4) The default export IS the Theme: register it in src/train-renderer.js.
export default { key: 'pride', ensureStyles, build, buildTrack };
