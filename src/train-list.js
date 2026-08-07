/**
 * train-list: the My Raid Trains view's presentation logic — which trains are
 * live, upcoming or departed, how their times read, and the card markup.
 *
 * Kept out of the page so the ordering and the departed rule are testable: a
 * train's status is derived from the clock alone (RaidPal's own `status` field
 * is per-Event detail, not carried on the summaries the user endpoint returns),
 * and getting "departed" wrong would grey out a train that is still running.
 */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/**
 * Event summaries → `{ live, upcoming, past }`. Live is now ∈ [start, end];
 * everything ending in the past is departed. Live and upcoming sort ascending
 * by start (the next thing to happen first); departed sorts DESCENDING, so the
 * most recent train is at the top of the collapsed list.
 */
export function classifyTrains(events, now) {
  const at = now instanceof Date ? now.getTime() : now;
  const live = [];
  const upcoming = [];
  const past = [];
  for (const event of events) {
    const start = event.starttime.getTime();
    const end = event.endtime.getTime();
    if (end < at) past.push(event);
    else if (start <= at) live.push(event);
    else upcoming.push(event);
  }
  const ascending = (a, b) => a.starttime - b.starttime;
  return {
    live: live.sort(ascending),
    upcoming: upcoming.sort(ascending),
    past: past.sort((a, b) => b.starttime - a.starttime),
  };
}

/**
 * A train's departure as a streamer reads it: "Today · 4:00 PM – 10:00 PM" for
 * something today, a dated form otherwise. Rendered in the viewer's own zone
 * (this is the Configurator, not the Overlay — no tz param applies here).
 */
export function whenLabel(event, now, locale = undefined) {
  const start = event.starttime;
  const end = event.endtime;
  const sameDay = start.toDateString() === new Date(now).toDateString();
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  const head = sameDay ? 'Today' : day.format(start);
  return `${head} · ${time.format(start)} – ${time.format(end)}`;
}

/** A little train silhouette: an engine plus one car per Slot, open Slots hollow. */
function miniTrainHtml(detail) {
  if (!detail) return '';
  const max = 8;
  const shown = Math.min(detail.slots, max);
  const cars = Array.from({ length: shown }, (_, i) => {
    const open = i >= detail.filled;
    return `<span class="mt-c${open ? ' open' : ''}"${open ? '' : ` style="--car:${i % 6}"`}></span>`;
  }).join('');
  const more = detail.slots > max ? `<span class="mt-more">+${detail.slots - max}</span>` : '';
  return `<span class="mini-train" aria-hidden="true"><span class="mt-e"></span>${cars}${more}</span>`;
}

/**
 * One Event card. `view` carries everything the card shows:
 *   { event, status, when, detail?, config?, error? }
 * where `detail` is `{ slots, filled }` once the Event's detail has loaded,
 * `config` is `{ presetName, overrideCount }` when the train has a saved Raid
 * Train Config, and `error` marks a detail that failed to refresh (the card
 * still renders — a failed read is never "you left the train").
 */
export function trainCardHtml(view) {
  const { event, status, when, detail, config, error } = view;
  const past = status === 'past';
  const chips = [
    status === 'live' ? '<span class="chip-live"><span class="dot"></span>LIVE NOW</span>' : '',
    event.organiser ? '<span class="chip-org" title="You organise this raid train">Organiser</span>' : '',
    config
      ? `<span class="chip-cfg" title="This train has a saved Raid Train Config">${esc(config.presetName)}${config.overrideCount ? ` +${config.overrideCount}` : ''}</span>`
      : '',
  ].join('');
  const slots = detail
    ? ` · <b>${detail.filled}/${detail.slots}</b> slots filled`
    : (error ? ' · <span class="meta-warn">couldn’t refresh</span>' : ' · …');
  return `<div class="card event-card${status === 'live' ? ' is-live' : ''}${past ? ' past' : ''}" data-slug="${esc(event.slug)}">
    <div class="event-main">
      <div class="event-title-row">
        ${past ? '<span class="stamp">Departed</span>' : ''}
        <span class="event-title">${esc(event.title)}</span>
        ${chips}
      </div>
      <div class="event-meta">${esc(when)}${slots}</div>
      ${past ? '' : miniTrainHtml(detail)}
    </div>
    <div class="event-actions">
      <button type="button" class="icon-btn" data-act="refresh-train" data-slug="${esc(event.slug)}"
        title="Refresh this train from RaidPal" aria-label="Refresh ${esc(event.title)} from RaidPal">⟳</button>
      <button type="button" class="icon-btn" data-act="copy-train-link" data-slug="${esc(event.slug)}"
        title="Copy the overlay link for this train" aria-label="Copy the overlay link for ${esc(event.title)}">⧉</button>
      <button type="button" class="btn sm" data-act="open-config" data-slug="${esc(event.slug)}">Configure</button>
    </div>
  </div>`;
}
