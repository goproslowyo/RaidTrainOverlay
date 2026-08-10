/**
 * upcoming-card: the Live Link's opt-in **Upcoming card** — a compact,
 * localized panel listing the next raid trains while nothing is live (and
 * the whole product of an `uponly=1` source). Drawn in the sodium design
 * language the Configurator's "Between trains" preview promises — amber mono
 * departure times and label over a translucent near-black slab — via local
 * font stacks only: the Overlay page loads no webfonts, an OBS source must
 * not block on one. Deliberately NOT themed art (it sits on any scene; the
 * per-Theme mini-train treatment is a possible future effort).
 *
 * One card, two views (its **Footprint**): the CARD VIEW turns a **Page** of
 * three trains at a time, the SCROLLING VIEW carries the whole **Horizon**
 * past on one seamless **Lap**. It scrolls, but it is never named after the
 * **Mode** that makes the *Train* crawl — see CONTEXT.md's Pitfalls, and the
 * guard in test/vocabulary.test.js that keeps this file honest about it. The
 * param value is still `upstyle=ticker`, because it ships inside copied OBS
 * browser sources; only the words moved, and the DOM class names below shadow
 * the value rather than the word.
 *
 * OBS-perf friendly by construction: the card view turns its Page on a slow
 * timer (one batch of row swaps every `upcycle` seconds, animated by one-shot
 * CSS), and the scrolling view is a single transform-only CSS loop — no
 * per-frame JS. Verified headless on a live Event like the rest of the
 * overlay DOM.
 *
 * The knobs arrive on `config` (see parseConfig): `uppos` anchors the panel
 * in the scene (nine anchors, decoupled from the Train's own `height` — a
 * webcam or chat box decides where it can sit) and caps it at that anchor's
 * **Cell**, `upop` is its opacity, `upcycle` holds each Page, and
 * `upstyle`/`upscroll` pick and pace the scrolling view.
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
  // Every numeric field 2-digit: in the mono face that makes every departure
  // the same width, so the time column cannot drift between pages (a
  // 1-digit day used to re-size the grid on every page turn). The zone name
  // is per-DATE, so summer vs standard time (PDT/PST) is already right.
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit',
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
// The panel's own fades: mount/unmount, and the page-turn crossfade. Plain
// opacity transitions driven by one-shot timers — nothing per-frame, and
// fades are the motion vocabulary reduced-motion users are okay with.
const PANEL_FADE_MS = 450;
// The page-turn crossfade scales with the hold: a quarter of the cycle,
// capped — slow enough to read as a dissolve, never most of the hold. At the
// 12s default that is a 1.1s fade each way; 300ms fixed read as a blink.
const pageFadeMs = (config) => Math.min(1100, ((config.upcycle ?? 12) * 1000) / 4);
// A dissolve's finish fires this long after its fade ends; anything that
// mounts after an exit waits AFTER_EXIT_MS. AFTER_EXIT_MS > EXIT_SETTLE_MS is
// load-bearing: the mount must always find the finish already run.
const EXIT_SETTLE_MS = 60;
const AFTER_EXIT_MS = 80;

/**
 * What the painted panel is a pure function of. Two calls with the same
 * signature ARE the same panel — so a repaint can be skipped wholesale,
 * which keeps the resolve tick (every ~15 min) from rebuilding the card
 * mid-view: rows re-entering and the page cycle resetting read as a blink.
 */
function panelSignature(trains, config) {
  return JSON.stringify([
    trains.map((t) => [t.slug, +t.starttime, +(t.mySlotAt ?? 0), t.title]),
    config.uppos, config.upop, config.upcycle, config.upscroll, config.upstyle, config.locale,
  ]);
}

/**
 * The cell rule, in the owner's words: picture the scene as three columns and
 * three rows. The nine `uppos` anchors are those nine cells, and an item at
 * one anchor must not bleed into another column or row. So the cell is a
 * third of the scene on each axis.
 *
 * Expressed in VIEWPORT UNITS and never measured in JS: OBS browser sources
 * and our own tooling both report `window.innerWidth` as `0` in places, so a
 * measured cell computes garbage exactly where it matters.
 */
/**
 * The whole box budget, in one place because its three parts are one thing:
 * the `cell` an anchor may fill, the `pad` holding the panel off the screen
 * edge (which comes OUT of the cell, never adds to it), and the `floor` below
 * which the card view stops shrinking — when the cell can afford it.
 *
 * Sized for a 1080p OBS scene. The Configurator's preview passes its own,
 * measured against its stage instead of the viewport.
 */
const BUDGET = { cell: { w: '33.3333vw', h: '33.3333vh' }, pad: 24, floor: '340px' };

/**
 * Anchor key → the whole box budget for a panel at that anchor: where it sits
 * AND how much room it may take. Exported for tests and reused by the
 * Configurator's preview, which passes a stage-relative budget (see the `.up`
 * rules in configurator.html — one rule, two places, and a test holding them
 * together).
 *
 * Placement and size live together on purpose. They used to be three
 * independent rules — this grammar, plus a `max-width` on the card view and a
 * `flex:1 1 auto` on the scrolling view — with nothing holding them to each
 * other, and the scrolling view consequently spanned the whole screen at
 * every anchor and every scene size. Both views are now flex children that
 * fill this budget, so there is exactly one place a footprint is decided.
 */
export function anchorStyle(key, budget = {}) {
  const { cell, pad, floor } = { ...BUDGET, ...budget };
  const [v, h] = (key ?? 'bc').split('');
  const mid = v === 'm';
  // Centre columns centre by transform rather than `left:0;right:0`: an edge-
  // to-edge box leaves a max-width ceiling with nothing to bind against.
  const centre = h !== 'l' && h !== 'r';
  const vert = v === 't' ? `top:${pad}px` : mid ? 'top:50%' : `bottom:${pad}px`;
  const horz = h === 'l' ? `left:${pad}px;justify-content:flex-start`
    : h === 'r' ? `right:${pad}px;justify-content:flex-end`
      : 'left:50%;justify-content:center';
  const shift = [centre && 'translateX(-50%)', mid && 'translateY(-50%)'].filter(Boolean);
  // The inset that holds the panel off the screen edge comes OUT of the cell
  // rather than adding to it, so no anchor can reach past its column or row.
  // The floor is a `min()` against that same budget — a hard 340px is wider
  // than a third of a 960-wide scene, which is the bleed the rule exists to
  // prevent.
  const box = `max-width:calc(${cell.w} - ${pad * 2}px)`
    + `;max-height:calc(${cell.h} - ${pad * 2}px)`
    + `;min-width:min(${floor}, ${cell.w} - ${pad * 2}px)`;
  return `position:absolute;display:flex;pointer-events:none;${box};${vert};${horz}`
    + (shift.length ? `;transform:${shift.join(' ')}` : '');
}

// The row-entry and scrolling animations need keyframes, which cannot live in
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
@keyframes rt-upcoming-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.rt-upcoming-ticker-wrap {
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 26px, #000 calc(100% - 26px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 26px, #000 calc(100% - 26px), transparent);
}
/*
 * The cell rule leaves the scrolling view a third of the scene, and inside
 * that the eyebrow is a fixed ~209px caption competing with the trains it
 * captions. Capping it at 40% only bought a truncated caption — "UPCOMING
 * RAI…" over a window too narrow to hold a name — so below the width where it
 * fits whole, it does not appear at all: no caption reads better than half of
 * one. The secondary UTC stamp goes with it, and the edge fade narrows, both
 * for the same reason. A third of the scene must clear 522px for the English
 * eyebrow plus a readable remainder, which puts the scene at 1710px.
 *
 * The breakpoint is the VIEWPORT, not the panel: the cell is CSS viewport
 * units precisely because OBS browser sources report window.innerWidth as 0,
 * so a JS measurement of the panel is not available to branch on. It is tuned
 * to the English eyebrow; the 40% cap stays as the fallback for locales whose
 * label runs longer at scene widths above the breakpoint.
 */
@media (max-width: 1709px) {
  .rt-upcoming-ticker-label,
  .rt-upcoming-ticker-utc { display: none; }
  .rt-upcoming-ticker-wrap {
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent);
    mask-image: linear-gradient(90deg, transparent, #000 14px, #000 calc(100% - 14px), transparent);
  }
}
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
    // border-box so the geometry lock (min-width := measured offsetWidth)
    // can never out-vote the max-width by a padding's worth.
    'box-sizing:border-box',
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

/** The card view: three rows, turning a Page. Returns `{ panel, cleanup }` — the caller owns
 *  attaching the cleanup, so the container handshake lives in one place. */
function renderCard(trains, config) {
  const card = document.createElement('div');
  card.className = 'rt-upcoming-card';
  // No width of its own: `anchorStyle` owns the box budget for both views, and
  // the panel is the flex child that fills it. `overflow:hidden` makes the
  // cell's height a real ceiling on a short scene rather than a nominal one —
  // rows are clipped by the slab instead of spilling out of it.
  card.style.cssText = `${panelCss(config)};flex:1 1 auto;min-width:0;overflow:hidden;padding:14px 18px`;

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

  // One grid for the whole list, cells as direct children: every row's time
  // and UTC land in SHARED columns sized by the widest entry, so the card
  // reads as a table — per-row flex let a long time or name nudge its
  // neighbours out of column.
  const list = document.createElement('div');
  list.style.cssText = 'display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;column-gap:14px;align-items:baseline';
  card.appendChild(list);

  const paintRows = (page) => {
    if (pageMark) pageMark.textContent = `${(((page % pages) + pages) % pages) + 1} / ${pages}`;
    list.replaceChildren();
    for (const train of visibleUpcoming(trains, page)) {
      const [when, utc] = timePair(train, config);
      const name = document.createElement('span');
      name.textContent = train.title;
      // min-width:0 makes the ellipsis real (a grid item's min-width defaults
      // to its content); the soft shadow lifts the name off any scene behind
      // the panel's translucency.
      name.style.cssText = 'min-width:0;font-size:17px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'
        + 'text-shadow:0 1px 2px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)';
      // Every cell on a fresh page is an entering cell; the shared soft rise
      // makes the swap read as the list moving on, not the card blinking.
      for (const cell of [when, name, utc]) {
        cell.classList.add('rt-upcoming-row-enter');
        cell.style.padding = '4px 0';
      }
      list.append(when, name, utc);
    }
  };

  let page = 0;
  paintRows(page);

  let cleanup = null;
  if (pages > 1) {
    card.style.transition = `opacity ${pageFadeMs(config)}ms ease-in-out`;
    let swapTimer = null;
    let locked = false;
    // Page on a slow clock — one batch of DOM swaps per cycle, no per-frame
    // work. Each turn is a crossfade: the panel eases out, the rows swap
    // while it is invisible, and it eases back in — so a page with fewer or
    // narrower rows never snaps the outline in front of the viewer.
    const cycleTimer = setInterval(() => {
      // Self-disposing: a Train render replaces the container wholesale
      // without asking us, so a detached list means this cycle is over.
      if (!list.isConnected) { clearInterval(cycleTimer); return; }
      if (!locked) {
        // Page 0 carries the fullest row count, so its box is the floor the
        // panel holds for the whole cycle — later pages fade in at the same
        // outline instead of a shorter, narrower one.
        list.style.minHeight = `${list.offsetHeight}px`;
        card.style.minWidth = `${card.offsetWidth}px`;
        locked = true;
      }
      card.style.opacity = '0';
      swapTimer = setTimeout(() => {
        page += 1;
        paintRows(page);
        card.style.opacity = '1';
      }, pageFadeMs(config));
    }, (config.upcycle ?? 12) * 1000);
    cleanup = () => { clearInterval(cycleTimer); clearTimeout(swapTimer); };
  }
  return { panel: card, cleanup };
}

/** The scrolling view: the whole Horizon on a seamless transform-only Lap. */
function renderScrollingView(trains, config) {
  const panel = document.createElement('div');
  panel.className = 'rt-upcoming-ticker';
  // `flex:1 1 auto;min-width:0` is the same fill rule the card view uses: the
  // panel takes the budget `anchorStyle` set and no more. It used to be the
  // whole width rule, which is why one line spanned whole screens — its
  // content is one very long line, so with no ceiling above it there was
  // nothing to shrink against.
  panel.style.cssText = `${panelCss(config)};border-radius:999px;padding:11px 22px;display:flex;align-items:center;gap:16px;flex:1 1 auto;min-width:0`;

  const label = panelLabel(config);
  // The eyebrow yields to the trains. It is a fixed ~209px at every scene size
  // (13px mono, wide tracking), so inside a cell it is a caption eating the
  // content's room: 35% of the budget at 1920, 55% at 1280, and everything at
  // a 960-wide scene. Below 1710px it is hidden outright by the stylesheet —
  // see the note there — and the 40% cap remains only as the longer-locale
  // fallback above that width.
  label.className = 'rt-upcoming-ticker-label';
  label.style.cssText += ';flex:0 1 auto;max-width:40%;min-width:0;overflow:hidden;text-overflow:ellipsis';
  panel.appendChild(label);

  const wrap = document.createElement('span');
  wrap.className = 'rt-upcoming-ticker-wrap';
  wrap.style.cssText = 'overflow:hidden;flex:1;min-width:0;display:block';

  const run = document.createElement('span');
  run.className = 'rt-upcoming-ticker-run';
  run.style.cssText = `display:inline-flex;white-space:nowrap;animation:rt-upcoming-ticker ${config.upscroll ?? 34}s linear infinite`;

  const entry = (train) => {
    const item = document.createElement('span');
    item.style.cssText = 'display:inline-flex;align-items:baseline;gap:9px;font-size:15.5px;font-weight:600';
    const [when, utc] = timePair(train, config);
    when.style.fontSize = '13.5px';
    utc.style.fontSize = '11.5px';
    // Sheds below the eyebrow's breakpoint: the UTC anchor is the least of the
    // three parts, and dropping it buys the name ~80px of the scroll window.
    utc.className = 'rt-upcoming-ticker-utc';
    const name = document.createElement('span');
    name.textContent = train.title;
    name.style.textShadow = '0 1px 2px rgba(0,0,0,0.85), 0 0 8px rgba(0,0,0,0.5)';
    item.append(when, name, utc);
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
  panel.appendChild(wrap);
  return panel;
}

/** Chain a cleanup onto the container's without losing what's already there. */
function addCleanup(container, fn) {
  const prior = container._rtUpcomingCleanup;
  container._rtUpcomingCleanup = prior ? () => { prior(); fn(); } : fn;
}

/**
 * Fade `target` out over PANEL_FADE_MS, then clear it. `target` is either a
 * retiring panel anchor (removed) or the container itself when it holds
 * foreign content — a Train — whose children we cannot restyle one by one;
 * there the container's own opacity carries the exit and is reset after.
 * The finish is registered as cleanup, so a superseding render completes the
 * exit instantly instead of leaving a ghost.
 */
function dissolve(container, target) {
  target.style.transition = `opacity ${PANEL_FADE_MS}ms ease`;
  target.style.opacity = '0';
  // Idempotent: the finish stays reachable through the cleanup chain after
  // the timer has already fired, and running it twice would replaceChildren
  // whatever mounted since — a hard cut of an innocent panel or Train.
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (target === container) {
      container.replaceChildren();
      container.style.opacity = '';
      container.style.transition = '';
    } else {
      target.remove();
    }
  };
  const gone = setTimeout(finish, PANEL_FADE_MS + EXIT_SETTLE_MS);
  addCleanup(container, () => { clearTimeout(gone); finish(); });
}

/** Build the panel for `trains`, ease it in, and register its timers. */
function mountPanel(container, trains, config) {
  const anchor = document.createElement('div');
  anchor.style.cssText = `${anchorStyle(config.uppos)};opacity:0;transition:opacity ${PANEL_FADE_MS}ms ease`;
  const built = config.upstyle === 'ticker'
    ? { panel: renderScrollingView(trains, config), cleanup: null }
    : renderCard(trains, config);
  anchor.appendChild(built.panel);
  container.appendChild(anchor);
  container._rtUpcomingAnchor = anchor;
  if (built.cleanup) addCleanup(container, built.cleanup);
  void anchor.offsetWidth; // commit the hidden start state before easing in
  anchor.style.opacity = '1';
}

/**
 * Paint the card into `container`. An empty `trains` list paints
 * nothing — the overlay stays fully transparent. `config` is the parsed
 * Overlay config (`t`, `locale`, and the up* knobs).
 *
 * The lifecycle is faded end to end: the panel eases in on mount, eases out
 * when the horizon empties, changed data crossfades old panel into new, and
 * a Train left standing in the container dissolves before the panel takes
 * the stage. A repaint whose inputs haven't changed is a no-op — the Live
 * Link's resolve tick never blinks a card that is already right (and never
 * resets its page cycle) — and so is an empty repaint over an exit already
 * in progress, which would otherwise cut the farewell short.
 */
export function renderUpcomingCard(container, trains, config) {
  const sig = trains.length === 0 ? null : panelSignature(trains, config);
  const standing = container._rtUpcomingAnchor?.isConnected ?? false;
  // No-op when this exact panel is already standing, already on its way out
  // (empty over empty), or already scheduled behind a dissolving Train.
  if (container._rtUpcomingSig === sig
    && (standing || sig === null || container._rtUpcomingPending)) return;
  container._rtUpcomingCleanup?.();
  container._rtUpcomingCleanup = null;
  container._rtUpcomingSig = sig;
  container._rtUpcomingPending = false;

  // What must leave the stage: our own standing panel, or — after a train
  // ends — the Train's DOM, which we can only fade via the container itself.
  const leaving = standing ? container._rtUpcomingAnchor
    : container.childElementCount > 0 ? container : null;
  container._rtUpcomingAnchor = null;

  if (sig === null) {
    if (leaving) dissolve(container, leaving);
    return;
  }
  ensureStyles(container.ownerDocument ?? document);
  if (leaving === container) {
    // A Train holds the stage: mounting now would ride the container's own
    // exit fade, so let it dissolve fully, then enter on the empty stage.
    dissolve(container, leaving);
    container._rtUpcomingPending = true;
    const mountTimer = setTimeout(() => {
      container._rtUpcomingPending = false;
      mountPanel(container, trains, config);
    }, PANEL_FADE_MS + AFTER_EXIT_MS);
    addCleanup(container, () => {
      container._rtUpcomingPending = false;
      clearTimeout(mountTimer);
    });
    return;
  }
  if (leaving) dissolve(container, leaving); // changed data: crossfade old panel into new
  mountPanel(container, trains, config);
}

/**
 * The shell's pre-Train hook: a train is about to render into `container`.
 * Cancels every pending card-transition timer — an in-flight dissolve or
 * deferred mount would otherwise fire AFTER the Train renders and wipe or
 * cover it — and starts the exit fade of a standing panel. Returns how long
 * the Train render should wait for that farewell (0 when nothing stands).
 * Never touches foreign content: the Train's own render is its entrance.
 */
export function retireUpcomingCard(container) {
  const anchor = container._rtUpcomingAnchor?.isConnected ? container._rtUpcomingAnchor : null;
  container._rtUpcomingCleanup?.();
  container._rtUpcomingCleanup = null;
  container._rtUpcomingAnchor = null;
  container._rtUpcomingPending = false;
  container._rtUpcomingSig = undefined; // pristine — the next card paints fresh
  if (!anchor) return 0;
  dissolve(container, anchor);
  return PANEL_FADE_MS + AFTER_EXIT_MS;
}
