/**
 * upcoming-card: the Live Link's opt-in idle state — a compact, localized
 * panel listing the streamer's next raid trains while nothing is live (and
 * the whole product of an `uponly=1` source). Drawn in the sodium design
 * language the Configurator's "Between trains" preview promises — amber mono
 * departure times and label over a translucent near-black slab — via local
 * font stacks only: the Overlay page loads no webfonts, an OBS source must
 * not block on one. Deliberately NOT themed art (it sits on any scene; the
 * per-Theme mini-train treatment is a possible future effort).
 *
 * OBS-perf friendly by construction: the card pages on a slow timer (one
 * batch of row swaps every `upcycle` seconds, animated by one-shot CSS), and
 * the ticker is a single transform-only CSS marquee — no per-frame JS.
 * Verified headless on a live Event like the rest of the overlay DOM.
 *
 * The knobs arrive on `config` (see parseConfig): `uppos` anchors the panel
 * in the scene (nine anchors, decoupled from the Train's own `height` — a
 * webcam or chat box decides where it can sit), `upop` is its opacity,
 * `upcycle` holds each page, and `upstyle`/`upscroll` pick and pace the
 * one-line ticker variant.
 */

import { visibleUpcoming, upcomingPages, CARD_MAX_ROWS } from './live-link.js';

// Local stacks matching the design system's fallback chains (assets/app.css)
// — the sodium look's signature here is the mono/amber time treatment, not a
// downloaded face.
const FONT_UI = "'Public Sans', 'Helvetica Neue', system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONT_MONO = "'DM Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
const AMBER = '#FFC578';
const INK = '#EDF1F7';

/**
 * Localized "Fri, Aug 8, 10:30 PM PDT" — weekday cue first, then the time
 * WITH its zone named. A bare clock time on stream is ambiguous (whose
 * clock?), and these trains span the globe: a UTC-afternoon train departs at
 * 3 AM Pacific, which reads as "wrong" until the zone is on screen. `zone` is
 * the streamer's first `tz` setting when set (pinning the card to a chosen
 * zone even when the OBS machine's clock lives elsewhere), else the machine's
 * own zone.
 */
function formatDeparture(date, locale, zone) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZoneName: 'short', ...(zone && { timeZone: zone }),
  }).format(date);
}

/**
 * The same departure as a UTC anchor — the streamer's viewers are worldwide
 * and nobody knows the streamer's zone, so every row carries a fixed
 * reference. Weekday appears only when UTC lands on a different day than the
 * local rendering (a late-night departure crossing midnight).
 */
function formatDepartureUtc(date, locale) {
  const day = (zone) => new Intl.DateTimeFormat('en', { weekday: 'short', ...(zone && { timeZone: zone }) }).format(date);
  const prefix = day(undefined) === day('UTC')
    ? ''
    : `${new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date)} `;
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(date);
  return `${prefix}${time} UTC`;
}

const ROW_ENTER_MS = 620;

/**
 * Anchor key → the inset/justify styles that put a shrink-wrapped box there.
 * Exported for tests (and reused by the Configurator's preview): this is the
 * whole uppos grammar in one place. Left/right anchors shrink-to-fit and the
 * ticker's content is one very long line, so the wrapper always carries a
 * max-width ceiling.
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
@keyframes rt-upcoming-rowin { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }
.rt-upcoming-row-enter { animation: rt-upcoming-rowin ${ROW_ENTER_MS}ms cubic-bezier(.22,.61,.36,1) both; }
@keyframes rt-upcoming-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@media (prefers-reduced-motion: reduce) {
  .rt-upcoming-row-enter { animation: none; }
  .rt-upcoming-ticker-run { animation: none !important; }
}`;
  doc.head.appendChild(style);
}

/**
 * The shared panel skin — the same translucent near-black slab the
 * Configurator's preview draws, at on-stream (1080p) scale.
 */
function panelCss(config) {
  return [
    `background:rgba(9, 12, 17, ${config.upop ?? 0.88})`, `color:${INK}`,
    'border:1px solid rgba(255,255,255,0.09)', 'border-radius:12px',
    `font-family:${FONT_UI}`, 'backdrop-filter:blur(8px)',
    'box-shadow:0 10px 34px rgba(0,0,0,0.45)', 'pointer-events:none',
  ].join(';');
}

/** The amber mono eyebrow both footprints open with. */
function panelLabel(config) {
  const label = document.createElement('span');
  label.textContent = config.t('overlay.upcoming');
  label.style.cssText = `font-family:${FONT_MONO};font-size:13px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${AMBER};white-space:nowrap`;
  return label;
}

/**
 * One moment as [zoned time (amber mono), UTC anchor (dim mono)]. The moment
 * is the streamer's OWN slot start (`mySlotAt`, annotated by the Live Link
 * feed from the Event's lineup) wherever it is known — that is the question
 * the card actually answers on stream — falling back to the train's
 * departure while the lineup is unknown or the streamer isn't on it.
 */
function timePair(train, config) {
  const at = train.mySlotAt ?? train.starttime;
  const when = document.createElement('span');
  // The streamer's first `tz` zone pins the clock; otherwise the machine's.
  when.textContent = formatDeparture(at, config.locale, config.tz?.[0]?.zone);
  when.style.cssText = `font-family:${FONT_MONO};font-size:15px;color:${AMBER};white-space:nowrap;flex:none`;
  const utc = document.createElement('span');
  utc.textContent = formatDepartureUtc(at, config.locale);
  utc.style.cssText = `font-family:${FONT_MONO};font-size:12.5px;color:rgba(237,241,247,0.45);white-space:nowrap;flex:none`;
  return [when, utc];
}

/** The 3-row paging card. */
function renderCard(container, trains, config) {
  const card = document.createElement('div');
  card.className = 'rt-upcoming-card';
  card.style.cssText = `${panelCss(config)};max-width:min(72vw, 680px);min-width:340px;padding:14px 18px`;

  const head = document.createElement('div');
  head.style.cssText = 'display:flex;align-items:baseline;gap:14px;padding-bottom:9px;margin-bottom:7px;border-bottom:1px solid rgba(255,255,255,0.07)';
  head.appendChild(panelLabel(config));
  let pageMark = null;
  const pages = upcomingPages(trains);
  if (pages > 1) {
    pageMark = document.createElement('span');
    pageMark.style.cssText = `margin-left:auto;font-family:${FONT_MONO};font-size:12.5px;color:#71808F;letter-spacing:0.06em;font-variant-numeric:tabular-nums;white-space:nowrap`;
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
      row.style.cssText = 'display:flex;gap:14px;align-items:baseline;padding:4px 0';
      const [when, utc] = timePair(train, config);
      const name = document.createElement('span');
      name.textContent = train.title;
      // flex:1 + min-width:0 makes the ellipsis real — a flex item's min-width
      // defaults to its content, so a long title would stretch the card
      // instead of truncating.
      name.style.cssText = 'flex:1;min-width:0;font-size:17px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
      utc.style.marginLeft = 'auto';
      row.append(when, name, utc);
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
  ticker.style.cssText = `${panelCss(config)};border-radius:999px;padding:11px 22px;display:flex;align-items:center;gap:16px;flex:1 1 auto;min-width:0`;

  const label = panelLabel(config);
  label.style.flex = 'none';
  ticker.appendChild(label);

  const wrap = document.createElement('span');
  wrap.style.cssText = 'overflow:hidden;flex:1;min-width:0;display:block;-webkit-mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent);mask-image:linear-gradient(90deg,transparent,#000 26px,#000 calc(100% - 26px),transparent)';

  const run = document.createElement('span');
  run.className = 'rt-upcoming-ticker-run';
  run.style.cssText = `display:inline-flex;white-space:nowrap;animation:rt-upcoming-marquee ${config.upscroll ?? 34}s linear infinite`;

  const entry = (train) => {
    const item = document.createElement('span');
    item.style.cssText = 'display:inline-flex;align-items:baseline;gap:9px;font-size:15.5px;font-weight:600';
    const [when, utc] = timePair(train, config);
    when.style.fontSize = '13.5px';
    utc.style.fontSize = '11.5px';
    item.append(when, document.createTextNode(train.title), utc);
    return item;
  };
  const sep = () => {
    const dot = document.createElement('span');
    dot.textContent = '•';
    dot.style.cssText = 'color:#4C5A6B';
    return dot;
  };
  // The run is laid as two identical LAP spans so the -50% loop is seamless.
  // The gap lives inside each lap (plus a matching trailing pad), never on the
  // run itself: a gap between two children of the run would sit astride the
  // -50% point and jump the loop by half a gap once per lap.
  const lap = () => {
    const half = document.createElement('span');
    half.style.cssText = 'display:inline-flex;gap:16px;align-items:baseline;padding-right:16px';
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
