/**
 * upcoming-card: the Live Link's opt-in idle state — a compact, localized,
 * palette-neutral card listing the streamer's next raid trains while nothing
 * is live. Deliberately NOT themed art (a translucent dark panel that sits
 * on any scene): the per-Theme mini-train treatment is a possible future
 * effort. Static DOM, no animation — OBS-perf friendly by construction.
 * Verified headless on a live Event like the rest of the overlay DOM.
 */

import { visibleUpcoming, CARD_MAX_ROWS } from './live-link.js';

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

// A long list cycles instead of growing: the window slides one row at a time,
// each swap a quick fade. Slow enough to read, cheap enough for OBS (one
// opacity transition every few seconds — no per-frame work).
const CYCLE_MS = 7_000;
const FADE_MS = 400;

/**
 * Paint the card into `container` (replacing its contents). An empty `trains`
 * list paints nothing — the overlay stays fully transparent. `config`
 * supplies `t` (translator) and `locale`; `--train-pos` keeps governing
 * vertical placement so the card sits where the Train would.
 *
 * The card holds a CONSTANT height of at most CARD_MAX_ROWS rows: a longer
 * list slowly cycles through its window rather than creeping up the stream.
 * Repainting always clears the previous card's cycle timers first.
 */
export function renderUpcomingCard(container, trains, config) {
  container._rtUpcomingCleanup?.();
  container._rtUpcomingCleanup = null;
  container.replaceChildren();
  if (trains.length === 0) return;

  const card = document.createElement('div');
  card.className = 'rt-upcoming-card';
  card.style.cssText = [
    'position:absolute', 'left:50%', 'bottom:calc((1 - var(--train-pos, 1)) * 60%)',
    'transform:translateX(-50%)', 'max-width:min(72vw, 640px)',
    'background:rgba(12, 14, 20, 0.82)', 'color:#f5f7fa',
    'border:1px solid rgba(255,255,255,0.14)', 'border-radius:12px',
    'padding:14px 20px', 'font-family:system-ui, sans-serif',
    'backdrop-filter:blur(2px)', 'box-shadow:0 4px 24px rgba(0,0,0,0.35)',
  ].join(';');

  const title = document.createElement('div');
  title.textContent = config.t('overlay.upcoming');
  title.style.cssText = 'font-size:13px;font-weight:700;letter-spacing:0.12em;opacity:0.75;margin-bottom:8px';
  card.appendChild(title);

  const list = document.createElement('div');
  list.style.cssText = `transition:opacity ${FADE_MS}ms ease`;
  card.appendChild(list);

  const paintRows = (visible) => {
    list.replaceChildren();
    for (const train of visible) {
      const row = document.createElement('div');
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

  let offset = 0;
  paintRows(visibleUpcoming(trains, offset));

  if (trains.length > CARD_MAX_ROWS) {
    // Fade out → slide the window one row → fade back in.
    let fadeTimer = null;
    const cycleTimer = setInterval(() => {
      list.style.opacity = '0';
      fadeTimer = setTimeout(() => {
        offset += 1;
        paintRows(visibleUpcoming(trains, offset));
        list.style.opacity = '1';
      }, FADE_MS);
    }, CYCLE_MS);
    container._rtUpcomingCleanup = () => {
      clearInterval(cycleTimer);
      if (fadeTimer != null) clearTimeout(fadeTimer);
    };

    // A quiet "and more" cue so 3 rows never read as the whole story.
    const more = document.createElement('div');
    more.textContent = `+${trains.length - CARD_MAX_ROWS}`;
    more.style.cssText = 'font-size:11px;opacity:0.4;text-align:right;margin-top:6px;font-variant-numeric:tabular-nums';
    card.appendChild(more);
  }
  container.appendChild(card);
}
