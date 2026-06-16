/**
 * Shared SVG primitives for the SVG-based Themes. classic uses them now; the
 * other SVG Themes (flat, …) reuse the same wheel/smoke/pointer/avatar builders
 * so the ambient motions and shrink-to-fit behave identically across the roster.
 *
 * These are string builders (stateless) plus two DOM post-processors that run
 * after a built Train is attached. Ported from the original mockup — the art
 * decisions are not re-derived here.
 *
 * The ambient-animation hooks (.rt-wheel, .rt-smoke, .rt-now-bob) and the
 * undulation on .rt-car are styled by the renderer's base CSS; these
 * builders only emit the markup that carries those classes.
 */
export const SVG_NS = 'http://www.w3.org/2000/svg';

export const esc = (s) =>
  (s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** First two alphanumerics of a name, upper-cased — the avatar fallback glyphs. */
export const initials = (name) => (name || 'OPEN').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();

/** A spoked wheel as raw SVG; wrap with `wheel()` so .rt-wheel spins it. */
export function spoke(cx, cy, r, fill, spokes = 6, spokeCol = '#00000055') {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#2b2b2b" stroke-width="2.5"/>`;
  for (let k = 0; k < spokes; k++) {
    const a = (k * Math.PI) / (spokes / 2);
    s += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(a) * (r - 3)).toFixed(1)}" y2="${(cy + Math.sin(a) * (r - 3)).toFixed(1)}" stroke="${spokeCol}" stroke-width="3"/>`;
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="3.4" fill="#f1b40a"/>`;
}

/** A rotating spoked wheel (.rt-wheel — base CSS spins it in the travel direction). */
export const wheel = (cx, cy, r, fill, spokes = 6, spokeCol) =>
  `<g class="rt-wheel">${spoke(cx, cy, r, fill, spokes, spokeCol)}</g>`;

/** A puffing smoke stack (.rt-smoke — base CSS staggers the five puffs upward). */
export function smokeSVG(cx, baseY, scale = 1) {
  const puffs = [[0, 0, 11], [11, -13, 9], [-9, -12, 8], [5, -25, 7], [-5, -34, 6]];
  return `<g class="rt-smoke">${puffs
    .map(([dx, dy, r], k) => `<circle cx="${cx + dx * scale}" cy="${baseY + dy * scale}" r="${r * scale}" fill="${k % 2 ? '#5d6975' : '#79838f'}"/>`)
    .join('')}</g>`;
}

/** The Now Marker pointer (a labelled tab + downward arrow). Caller toggles its
 *  visibility via the .rt-pointer / .rt-car--current state classes (base CSS). */
export function pointerSVG(cx, y, color, text) {
  return `<rect x="${cx - 26}" y="${y - 20}" width="52" height="22" rx="6" fill="${color}"/>` +
    `<text x="${cx}" y="${y - 4}" text-anchor="middle" font-weight="800" font-size="12" fill="#1f2937">${text}</text>` +
    `<path d="M ${cx - 7} ${y + 1} L ${cx + 7} ${y + 1} L ${cx} ${y + 12} Z" fill="${color}"/>`;
}

/**
 * A circular avatar: a backing disc + initials, then the (clipped) Broadcaster
 * image painted over it, then a ring. If the image 404s — common on the flaky
 * RaidPal CDN — the initials remain visible underneath, so no Car ever shows a
 * blank hole. `id` must be unique within the document (the clip-path reference).
 */
export function avatarSVG(id, cx, cy, r, image, name, ring) {
  let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#262626"/>`;
  s += `<text x="${cx}" y="${cy + r * 0.34}" text-anchor="middle" font-weight="800" font-size="${Math.round(r * 0.95)}" fill="#cbb48a">${esc(initials(name))}</text>`;
  if (image) {
    s += `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`;
    s += `<image href="${esc(image)}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`;
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${ring}" stroke-width="3.5"/>`;
}

/**
 * Shrink-to-fit every `.rt-fit` text so no Broadcaster name truncates.
 * SVG `<text class="rt-fit" data-maxw>` is condensed via textLength; HTML
 * `.rt-fit` (for the HTML Themes) steps the font size down, then wraps.
 * Runs once after attach — names don't change on a time tick.
 */
export function fitAll(root) {
  root.querySelectorAll('.rt-fit').forEach((el) => {
    if (el.namespaceURI && el.namespaceURI.includes('svg')) {
      const maxw = parseFloat(el.getAttribute('data-maxw'));
      if (!Number.isFinite(maxw)) return;
      const len = el.getComputedTextLength();
      if (len > maxw) {
        el.setAttribute('textLength', maxw);
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      } else if (len > 0 && len < maxw * 0.8) {
        // Grow a short name to better fill the fixed Car — widen the spacing toward
        // the slot (capped so a 2-char name doesn't sprawl). Height is unchanged.
        el.setAttribute('textLength', Math.min(maxw, len * 1.5));
        el.setAttribute('lengthAdjust', 'spacingAndGlyphs');
      }
      return;
    }
    el.style.whiteSpace = 'nowrap';
    let fs = parseFloat(getComputedStyle(el).fontSize);
    const baseFs = fs;
    const min = 8.5;
    let guard = 60;
    while (el.scrollWidth > el.clientWidth + 1 && fs > min && guard-- > 0) {
      fs -= 0.5;
      el.style.fontSize = `${fs}px`;
    }
    // Grow a short name to better fill the Car (capped); step back if it overshoots.
    guard = 40;
    while (el.scrollWidth < el.clientWidth - 3 && fs < baseFs * 1.25 && guard-- > 0) {
      fs += 0.5;
      el.style.fontSize = `${fs}px`;
    }
    if (el.scrollWidth > el.clientWidth + 1 && fs > min) {
      fs -= 0.5;
      el.style.fontSize = `${fs}px`;
    }
    if (el.scrollWidth > el.clientWidth + 1) {
      el.style.whiteSpace = 'normal';
      el.style.lineHeight = '1.04';
    }
  });
}

/**
 * Live Train view-model (lineup-engine) → the flat per-vehicle list every Theme
 * draws from. One canonical shape so each Theme's renderer maps the same fields
 * (classic predates this and keeps its own inline copy; the later ports share
 * this one). `kind` is the vehicle role; the boolean states drive the renderer's
 * toggleable `.rt-car--*` classes, so a time tick re-styles in place without a
 * rebuild. A hidden Engine (post-event `enginedim=finished`) is dropped here.
 */
export function toVehicles(train) {
  const out = [];
  if (!train.engine.isHidden) {
    // The locomotive shows the ORGANISER — the conductor of the raid train. The
    // Engine carries no Broadcaster, so this paints the Organiser onto the loco and
    // draws no separate tender. The loco has no Slot, so no live state of its own; a
    // Theme dims it only on isDimmed (enginedim post-event). Every streamer — the
    // first one included — rides as a Car below.
    const b = train.engine.broadcaster;
    out.push({
      kind: 'engine',
      name: b ? b.displayName : train.organiser.displayName,
      image: b ? b.image : train.organiser.image,
      slotOrder: train.engine.slotOrder,
      isCurrent: Boolean(train.engine.isCurrent),
      isSpotlit: Boolean(train.engine.isSpotlit),
      isDeparted: Boolean(train.engine.isDeparted),
      isDimmed: Boolean(train.engine.isDimmed),
      isCaboose: Boolean(train.engine.isCaboose),
      timeLines: train.engine.timeLines ?? [train.engine.relativeTime ?? ''],
      // The Organiser credit, rendered as a prominent tender behind the loco
      // (prototype verdict C+E). null when the Organiser is already driving the loco.
      organiser: b ? { name: train.organiser.displayName, image: train.organiser.image } : null,
    });
  }
  for (const car of train.cars) {
    out.push({
      kind: car.isOpen ? 'open' : car.isCaboose ? 'caboose' : 'car',
      slotOrder: car.slotOrder,
      name: car.isOpen ? car.displayName : car.broadcaster.displayName,
      image: car.isOpen ? null : car.broadcaster.image,
      isOpen: Boolean(car.isOpen),
      isCurrent: Boolean(car.isCurrent),
      isDeparted: Boolean(car.isDeparted),
      isSpotlit: Boolean(car.isSpotlit),
      timeLines: car.timeLines ?? [car.relativeTime],
    });
  }
  return out;
}

/** Stable per-index pseudo-random in [0,1) — deterministic so a re-render (and every
 *  marquee copy) keeps each Car's ride identical, which a seamless loop needs. A
 *  cheap hash, NOT Math.random (that would reshuffle the whole Train on each build). */
function rideRand(i, seed) {
  const x = Math.sin(i * 12.9898 + seed * 71.131) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Per-Car organic ambient motion. Each Car gets a STABLE,
 * per-index randomized sway/rock amplitude, period, and phase (set as the custom
 * props the base `rt-undulate` keyframe reads), so the Train undulates like a real
 * connected body: neighbours share an index-stagger (a "track-roughness" wave so
 * the couplers read connected) but the per-Car period spread + phase jitter keep
 * them from marching in lock-step — the uniform single-sinusoid read mechanical
 * (memory `theme-rendering-constraints`). The per-Theme Ride character `ride`
 * scales the overall amplitude (tron/departures tight, wood/comic loose); it may
 * bump a Car a little off the rail for life, never derailed. Amplitude floors stay
 * above Steve's rejected ±1.5px/±0.35deg. Compositor-only; reduced-motion disables
 * the animation entirely (base CSS), leaving a calm static baseline.
 *
 * `ride` defaults to the `--rt-ride` value declared on the Theme root (a per-Theme
 * convention, NOT a field on the Theme contract), or 1.
 */
export function undulate(root, ride) {
  if (ride == null) {
    const declared = parseFloat(getComputedStyle(root).getPropertyValue('--rt-ride'));
    ride = Number.isFinite(declared) ? declared : 1;
  }
  [...root.querySelectorAll('.rt-car')].forEach((el, i) => {
    const sway = (2.5 * ride * (0.72 + 0.56 * rideRand(i, 1))).toFixed(2);  // ~1.8–3.2px @ ride 1
    const rock = (0.6 * ride * (0.72 + 0.56 * rideRand(i, 2))).toFixed(2);  // ~0.43–0.77deg @ ride 1
    const period = 2.6 + 1.1 * rideRand(i, 3);                             // 2.6–3.7s — spreads to decohere
    const phase = i * 0.18 + rideRand(i, 4) * period;                      // connected stagger + per-Car jitter
    el.style.setProperty('--rt-sway', `${sway}px`);
    el.style.setProperty('--rt-rock', `${rock}deg`);
    el.style.setProperty('--rt-period', `${period.toFixed(2)}s`);
    el.style.animationDelay = `${(-phase).toFixed(2)}s`;
  });
}
