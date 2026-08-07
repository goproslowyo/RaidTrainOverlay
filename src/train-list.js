/**
 * train-list: the My Raid Trains view's presentation logic — which trains are
 * live, upcoming or departed, how their times read, and the card markup.
 *
 * Kept out of the page so the ordering and the departed rule are testable: a
 * train's status is derived from the clock alone (RaidPal's own `status` field
 * is per-Event detail, not carried on the summaries the user endpoint returns),
 * and getting "departed" wrong would grey out a train that is still running.
 *
 * i18n: every user-facing word comes from the injected translator `t`. Values
 * interpolated into a string (an Event title, a Preset name) are RaidPal or
 * streamer data, so the translated result is escaped as a whole — never the
 * fragments before interpolation, which would double-escape.
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
export function whenLabel(event, now, locale = undefined, t = (k) => k) {
  const start = event.starttime;
  const end = event.endtime;
  const sameDay = start.toDateString() === new Date(now).toDateString();
  const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' });
  const head = sameDay ? t('configurator.whenToday') : day.format(start);
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
export function trainCardHtml(view, t = (k) => k) {
  const { event, status, when, detail, config, error } = view;
  const past = status === 'past';
  const chips = [
    status === 'live' ? `<span class="chip-live"><span class="dot"></span>${esc(t('configurator.chipLive'))}</span>` : '',
    event.organiser
      ? `<span class="chip-org" title="${esc(t('configurator.chipOrganiserTitle'))}">${esc(t('configurator.chipOrganiser'))}</span>`
      : '',
    config
      ? `<span class="chip-cfg" title="${esc(t('configurator.chipConfigTitle'))}">${esc(config.presetName)}${config.overrideCount ? ` +${config.overrideCount}` : ''}</span>`
      : '',
  ].join('');
  // The filled/total counts are numbers we generate, so the catalog string may
  // carry the <b> around them; the test asserts translations keep that tag.
  const slots = detail
    ? ` · ${t('configurator.slotsFilled', { filled: detail.filled, slots: detail.slots })}`
    : (error ? ` · <span class="meta-warn">${esc(t('configurator.cardRefreshFailed'))}</span>` : ' · …');
  return `<div class="card event-card${status === 'live' ? ' is-live' : ''}${past ? ' past' : ''}" data-slug="${esc(event.slug)}">
    <div class="event-main">
      <div class="event-title-row">
        ${past ? `<span class="stamp">${esc(t('configurator.stampDeparted'))}</span>` : ''}
        <span class="event-title">${esc(event.title)}</span>
        ${chips}
      </div>
      <div class="event-meta">${esc(when)}${slots}</div>
      ${past ? '' : miniTrainHtml(detail)}
    </div>
    <div class="event-actions">
      <button type="button" class="icon-btn" data-act="refresh-train" data-slug="${esc(event.slug)}"
        title="${esc(t('configurator.cardRefreshTitle'))}" aria-label="${esc(t('configurator.cardRefreshAria', { title: event.title }))}">⟳</button>
      <button type="button" class="icon-btn" data-act="copy-train-link" data-slug="${esc(event.slug)}"
        title="${esc(t('configurator.cardCopyTitle'))}" aria-label="${esc(t('configurator.cardCopyAria', { title: event.title }))}">⧉</button>
      <button type="button" class="btn sm" data-act="open-config" data-slug="${esc(event.slug)}">${esc(t('configurator.cardConfigure'))}</button>
    </div>
  </div>`;
}
