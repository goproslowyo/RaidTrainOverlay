/**
 * upcoming-card: the Live Link's opt-in idle state — a compact, localized,
 * palette-neutral panel listing the streamer's next raid trains while nothing
 * is live. Deliberately NOT themed art (a translucent dark panel that sits
 * on any scene): the per-Theme mini-train treatment is a possible future
 * effort. OBS-perf friendly by construction: the card pages on a slow timer
 * (one batch of row swaps every `upcycle` seconds, animated by CSS), and the
 * ticker is a single transform-only CSS marquee — no per-frame JS either way.
 * Verified headless on a live Event like the rest of the overlay DOM.
 *
 * Four knobs arrive on `config` (see parseConfig): `uppos` anchors the panel
 * in the scene (nine anchors, decoupled from the Train's own `height` — a
 * webcam or chat box decides where it can sit), `upop` is its opacity,
 * `upcycle` holds each page, and `upstyle`/`upscroll` pick and pace the
 * one-line ticker variant.
 */

import { visibleUpcoming, upcomingPages, CARD_MAX_ROWS } from './live-link.js';

/** Localized "Fri, Aug 8 · 22:30" — weekday cue first, viewer-local time. */
function formatDeparture(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

/**
 * The same departure as a UTC anchor — viewers are worldwide and nobody knows
 * the streamer's zone. Weekday appears only when UTC lands on a different day
 * than the viewer's local rendering (a late-night departure crossing midnight).
 */
function formatDepartureUtc(date, locale) {
  const day = (zone) => new Intl.DateTimeFormat('en', { weekday: 'short', ...(zone && { timeZone: zone }) }).format(date);
  const prefix = day(undefined) === day('UTC')
    ? ''
    : `${new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date)} `;
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(date);
  return `${prefix}${time} UTC`;
}

const FADE_MS = 620;

/**
 * Anchor key → the inset/justify styles that put a shrink-wrapped box there.
 * Exported for tests: this is the whole uppos grammar in one place.
 * Left/right anchors shrink-to-fit and the ticker's content is one very long
 * line, so the wrapper always carries a max-width ceiling.
 */
export function anchorStyle(key, pad = 24) {
  const [v, h] = (key ?? 'bc').split('');
  const vert = v === 't' ? `top:${pad}px`
    : v === 'm' ? 'top:50%;transform:translateY(-50%)'
      : `bottom:${pad}px`;
  const horz = h === 'l' ? `left:${pad}px;justify-content:flex-start`
    : h === 'r' ? `right:${pad}px;justify-content:flex-end`
      : `left:0;right:0;justify-content:center;padding-left:${pad}px;padding-right:${pad}px`;
  return `position:absolute;display:flex;pointer-events:none;max-width:calc(100% - ${pad * 2}px);${vert};${horz}`;
}

// The row-entry and marquee animations need keyframes, which cannot live in
// an inline style. Injected once, lazily, so importing this module in a test
// runner with no DOM stays safe.
const STYLE_ID = 'rt-upcoming-style';
function ensureStyles(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
@keyframes rt-upcoming-rowin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.rt-upcoming-row-enter { animation: rt-upcoming-rowin ${FADE_MS}ms cubic-bezier(.22,.61,.36,1) both; }
@keyframes rt-upcoming-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .rt-upcoming-row-enter { animation: none; }
  .rt-upcoming-ticker-run { animation: none !important; }
}`;
  doc.head.appendChild(style);
}

/** The shared panel skin: a translucent dark slab that sits on any scene. */
function panelCss(config) {
  return [
    `background:rgba(9, 12, 17, ${config.upop ?? 0.88})`, 'color:#f5f7fa',
    'border:1px solid rgba(255,255,255,0.12)', 'border-radius:12px',
    'font-family:system-ui, sans-serif', 'backdrop-filter:blur(6px)',
    'box-shadow:0 6px 22px rgba(0,0,0,0.45)', 'pointer-events:none',
  ].join(';');
}

function cardTitle(config) {
  const title = document.createElement('div');
  title.textContent = config.t('overlay.upcoming');
  title.style.cssText = 'font-size:13px;font-weight:700;letter-spacing:0.12em;opacity:0.75';
  return title;
}

/** The 3-row paging card. */
function renderCard(container, trains, config) {
  const card = document.createElement('div');
  card.className = 'rt-upcoming-card';
  card.style.cssText = `${panelCss(config)};max-width:min(72vw, 640px);padding:14px 20px`;

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:baseline;gap:14px;justify-content:space-between;margin-bottom:8px';
  head.appendChild(cardTitle(config));
  let pageMark = null;
  const pages = upcomingPages(trains);
  if (pages > 1) {
    pageMark = document.createElement('span');
    pageMark.style.cssText = 'font-size:11px;opacity:0.45;font-variant-numeric:tabular-nums;white-space:nowrap';
    head.appendChild(pageMark);
  }
  card.appendChild(head);

  const list = document.createElement('div');
  card.appendChild(list);

  const paintRows = (page) => {
    if (pageMark) pageMark.textContent = `${(((page % pages) + pages) % pages) + 1} / ${pages}`;
    list.replaceChildren();
    for (const train of visibleUpcoming(trains, page)) {
      const row = document.createElement('div');
      // Every row on a fresh page is an entering row; the soft rise is what
      // makes the swap read as the list moving on, not the card blinking.
      row.className = 'rt-upcoming-row-enter';
      row.style.cssText = 'display:flex;gap:16px;justify-content:space-between;align-items:baseline;padding:3px 0';
      const name = document.createElement('span');
      name.textContent = train.title;
      name.style.cssText = 'font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      const times = document.createElement('span');
      times.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;flex-shrink:0';
      const when = document.createElement('span');
      when.textContent = formatDeparture(train.starttime, config.locale);
      when.style.cssText = 'font-size:14px;opacity:0.85;white-space:nowrap;font-variant-numeric:tabular-nums';
      const utc = document.createElement('span');
      utc.textContent = formatDepartureUtc(train.starttime, config.locale);
      utc.style.cssText = 'font-size:12px;opacity:0.55;white-space:nowrap;font-variant-numeric:tabular-nums';
      times.append(when, utc);
      row.append(name, times);
      list.appendChild(row);
    }
  };

  let page = 0;
  paintRows(page);

  if (pages > 1) {
    // Page on a slow clock — one batch of DOM swaps per cycle, no per-frame work.
    const cycleTimer = setInterval(() => {
      page += 1;
      paintRows(page);
    }, (config.upcycle ?? 12) * 1000);
    container._rtUpcomingCleanup = () => clearInterval(cycleTimer);
  }
  return card;
}

/** The one-line ticker: the whole horizon on a seamless transform-only marquee. */
function renderTicker(trains, config) {
  const ticker = document.createElement('div');
  ticker.className = 'rt-upcoming-ticker';
  ticker.style.cssText = `${panelCss(config)};border-radius:999px;padding:8px 18px;display:flex;align-items:center;gap:12px;flex:0 1 640px;min-width:0`;

  const label = cardTitle(config);
  label.style.flex = 'none';
  ticker.appendChild(label);

  const wrap = document.createElement('span');
  wrap.style.cssText = 'overflow:hidden;flex:1;min-width:0;display:block;-webkit-mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent);mask-image:linear-gradient(90deg,transparent,#000 22px,#000 calc(100% - 22px),transparent)';

  const run = document.createElement('span');
  run.className = 'rt-upcoming-ticker-run';
  run.style.cssText = `display:inline-flex;white-space:nowrap;animation:rt-upcoming-marquee ${config.upscroll ?? 34}s linear infinite`;

  const entry = (train) => {
    const item = document.createElement('span');
    item.style.cssText = 'display:inline-flex;align-items:baseline;gap:8px;font-size:14px;font-weight:600';
    const when = document.createElement('span');
    when.textContent = formatDeparture(train.starttime, config.locale);
    when.style.cssText = 'font-size:12px;opacity:0.7;font-variant-numeric:tabular-nums';
    item.append(when, document.createTextNode(train.title));
    return item;
  };
  const sep = () => {
    const dot = document.createElement('span');
    dot.textContent = '•';
    dot.style.cssText = 'opacity:0.35';
    return dot;
  };
  // The run is laid as two identical LAP spans so the -50% loop is seamless.
  // The gap lives inside each lap (plus a matching trailing pad), never on the
  // run itself: a gap between two children of the run would sit astride the
  // -50% point and jump the loop by half a gap once per lap.
  const lap = () => {
    const half = document.createElement('span');
    half.style.cssText = 'display:inline-flex;gap:14px;align-items:baseline;padding-right:14px';
    for (const train of trains) half.append(entry(train), sep());
    return half;
  };
  run.append(lap(), lap());
  wrap.appendChild(run);
  ticker.appendChild(wrap);
  return ticker;
}

/**
 * Paint the idle panel into `container` (replacing its contents). An empty
 * `trains` list paints nothing — the overlay stays fully transparent.
 * `config` is the parsed Overlay config (`t`, `locale`, and the up* knobs).
 * Repainting always clears the previous panel's cycle timer first.
 */
export function renderUpcomingCard(container, trains, config) {
  container._rtUpcomingCleanup?.();
  container._rtUpcomingCleanup = null;
  container.replaceChildren();
  if (trains.length === 0) return;
  ensureStyles(container.ownerDocument ?? document);

  const anchor = document.createElement('div');
  anchor.style.cssText = anchorStyle(config.uppos);
  anchor.appendChild(config.upstyle === 'ticker'
    ? renderTicker(trains, config)
    : renderCard(container, trains, config));
  container.appendChild(anchor);
}
