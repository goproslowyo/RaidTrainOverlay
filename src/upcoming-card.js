/**
 * upcoming-card: the Live Link's opt-in idle state — a compact, localized,
 * palette-neutral card listing the streamer's next raid trains while nothing
 * is live. Deliberately NOT themed art (a translucent dark panel that sits
 * on any scene): the per-Theme mini-train treatment is a possible future
 * effort. Static DOM, no animation — OBS-perf friendly by construction.
 * Verified headless on a live Event like the rest of the overlay DOM.
 */

/** Localized "Fri, Aug 8 · 22:30" — weekday cue first, viewer-local time. */
function formatDeparture(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

/**
 * Paint the card into `container` (replacing its contents). An empty `trains`
 * list paints nothing — the overlay stays fully transparent. `config`
 * supplies `t` (translator) and `locale`; `--train-pos` keeps governing
 * vertical placement so the card sits where the Train would.
 */
export function renderUpcomingCard(container, trains, config) {
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

  for (const train of trains) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:16px;justify-content:space-between;align-items:baseline;padding:3px 0';
    const name = document.createElement('span');
    name.textContent = train.title;
    name.style.cssText = 'font-size:16px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    const when = document.createElement('span');
    when.textContent = formatDeparture(train.starttime, config.locale);
    when.style.cssText = 'font-size:14px;opacity:0.85;white-space:nowrap;font-variant-numeric:tabular-nums';
    row.append(name, when);
    card.appendChild(row);
  }
  container.appendChild(card);
}
