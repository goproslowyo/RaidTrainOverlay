/**
 * Shared primitives for the HTML/CSS Themes (synthwave, ticket, wood,
 * comic, departures, paper, tron). The SVG Themes use shared-svg.js; these are
 * the HTML analogues so avatars, wheels, and the unit-scaling convention behave
 * identically across the HTML roster.
 *
 * Sizing: an HTML Theme has no intrinsic ratio, so it scales to the
 * Train height by defining a unit token on its root —
 * `--u: calc(var(--rt-th) / <design-height>)` — and writing every length as
 * `calc(<design-px> * var(--u))`. The shared CSS here follows the same rule, so
 * the avatar and wheels scale with the Theme. `--u` is an absolute length, so it
 * is immune to the em-nesting trap (a child setting font-size never rescales it).
 */
import { esc, initials } from './shared-svg.js';

const SHARED_ID = 'rt-theme-html-shared-style';

/** Inject the shared HTML-Theme CSS once (avatar layering + spoked wheel). */
export function ensureHtmlShared() {
  if (document.getElementById(SHARED_ID)) return;
  const style = document.createElement('style');
  style.id = SHARED_ID;
  style.textContent = `
    /* Shrink-to-fit names: fitAll measures scrollWidth vs clientWidth
       and steps the font down, so the name element MUST be width-constrained to
       its Car (else it grows with the text and never shrinks → long names clip).
       overflow-wrap lets a pathological single long word break to a second line
       rather than truncate. SVG Themes don't load this CSS (they use textLength). */
    .rt-fit { display: block; max-width: 100%; overflow-wrap: anywhere; }

    /* Avatar: an initials backing layer with the Broadcaster image laid over it as
       a background-image. If the image 404s (the flaky RaidPal CDN) a background
       paints NOTHING — no broken-image glyph (an <img> renders one over the
       initials in headless/OBS) — so the initials stay visible. No onerror needed.
       The enclosing ring (sized + coloured by each Theme) must be position:relative
       and overflow:hidden; these fill it. */
    .rt-av-init { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: 800; line-height: 1; }
    .rt-av-img { position: absolute; inset: 0; background-size: cover; background-position: center; }

    /* Spoked wheel body: a cross of two bars over a disc. The base renderer CSS
       (.rt-wheel) spins it and disables it under reduced-motion; the Theme sizes
       and colours it (background + --spk for the spokes). */
    .rt-hw { position: relative; border-radius: 50%; flex: none; }
    .rt-hw::before, .rt-hw::after { content: ''; position: absolute; background: var(--spk, #0007); border-radius: 1px; }
    .rt-hw::before { left: 14%; right: 14%; top: 45%; height: 10%; }
    .rt-hw::after { top: 14%; bottom: 14%; left: 45%; width: 10%; }
  `;
  document.head.appendChild(style);
}

/** Inject a Theme's own stylesheet once, keyed by id. */
export function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * The avatar inner markup, to drop inside a Theme's ring element. Returns the
 * initials layer plus (if present) the image layered over it. The caller's ring
 * supplies the frame, colour, and font-size the initials inherit.
 */
export function htmlAvatar(v) {
  const init = esc(initials(v.name));
  // Lay the image over the initials as a background-image (a failed load paints
  // nothing, vs an <img>'s broken-image glyph). esc() covers the " of the style
  // attribute; %27 covers the ' of the url() so a stray quote can't break out.
  const img = v.image
    ? `<span class="rt-av-img" style="background-image:url('${esc(v.image).replace(/'/g, '%27')}')"></span>`
    : '';
  return `<span class="rt-av-init">${init}</span>${img}`;
}

/** A spinning spoked wheel (.rt-wheel spins via base CSS; themeClass sizes it). */
export function htmlWheel(themeClass) {
  return `<span class="rt-wheel rt-hw ${themeClass}"></span>`;
}

/**
 * One vehicle's state → the renderer's toggleable class string. Build-time
 * structural classes (engine/caboose/open) are the Theme's own; the Now /
 * Spotlight / departed states ride the shared .rt-car--* classes so a time tick
 * re-styles in place (the renderer toggles them; never a rebuild).
 */
export function stateClasses(v) {
  if (v.kind === 'engine') {
    // The loco shows the first streamer's NOW + Spotlight, but dims only on
    // isDimmed (enginedim post-event) — never on their per-slot departed, so it
    // stays bright as the eternal leader.
    return [
      v.isCurrent ? 'rt-car--current' : '',
      v.isSpotlit ? 'rt-car--spotlit' : '',
      v.isDimmed ? 'rt-car--departed' : '',
    ].filter(Boolean).join(' ');
  }
  return [
    v.isCurrent ? 'rt-car--current' : '',
    v.isDeparted ? 'rt-car--departed' : '',
    v.isSpotlit ? 'rt-car--spotlit' : '',
  ].filter(Boolean).join(' ');
}

/** Stacked time lines as inline spans (one line normally; ≤3 for multi-zone tz). */
export function timeLinesHTML(lines) {
  return lines.map((l) => `<span>${esc(l)}</span>`).join('');
}
