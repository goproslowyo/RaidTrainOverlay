/**
 * manual-editor: the "Build by hand" authoring UI mounted inside the Configurator's
 * hero when the lineup Source is Manual. Renders into a root element and mutates a
 * shared `state` object in place, calling `onChange` after every edit so the
 * Configurator rebuilds the overlay URL + live preview from readForm() (same `state`).
 * Owns NO preview/copy/OBS logic — those are the Configurator's, shared with RaidPal.
 *
 *   state = { title, organiser, zone, startISO, slotMins, djs:[{handle, mins}] }
 *
 * Time entry: pick a DEFAULT SET LENGTH (the base slot), and each DJ's "Plays for"
 * dropdown offers multiples of it (×1, ×2, …) — so a longer set is just more uniform
 * slots downstream and back-to-back same-handle slots merge into one Car. Clock times
 * shown here are wall-clock in the chosen zone; the absolute instant is resolved at
 * encode time. All user-facing strings come from the injected translator `t`.
 */
import { normalizeHandle, parseLine, clampCount } from './manual-lineup.js';

const SET_LENGTHS = [30, 60, 90, 120, 180, 240];   // "Default set length" options (minutes)
const COUNTS = [1, 2, 3, 4, 6, 8];                  // per-DJ multiples of the set length
const PALETTE = ['#6ea8fe', '#3ad29f', '#f7b955', '#c792ea', '#ff6b6b', '#4dd0e1', '#f48fb1', '#aed581'];

// A broad, common set of zones ordered WEST → EAST (one per major streamer region),
// not the full 400+ IANA list. The organiser's own detected zone is pinned on top.
const COMMON_ZONES = [
  ['Pacific/Honolulu', 'Hawaii'],
  ['America/Anchorage', 'Alaska'],
  ['America/Los_Angeles', 'Pacific (US & Canada)'],
  ['America/Denver', 'Mountain (US & Canada)'],
  ['America/Chicago', 'Central (US & Canada)'],
  ['America/New_York', 'Eastern (US & Canada)'],
  ['America/Sao_Paulo', 'Brazil (São Paulo)'],
  ['UTC', 'UTC'],
  ['Europe/London', 'UK & Ireland (London)'],
  ['Europe/Paris', 'Central Europe (Paris)'],
  ['Europe/Athens', 'Eastern Europe (Athens)'],
  ['Europe/Moscow', 'Moscow'],
  ['Asia/Kolkata', 'India'],
  ['Asia/Shanghai', 'China (Shanghai)'],
  ['Asia/Tokyo', 'Japan & Korea (Tokyo)'],
  ['Australia/Sydney', 'Australia East (Sydney)'],
  ['Pacific/Auckland', 'New Zealand'],
];
function zoneOptions(t) {
  let detected = 'UTC';
  try { detected = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { /* keep UTC */ }
  const out = [[detected, `${detected} ${t('configurator.manual.zoneYours')}`]];
  const seen = new Set([detected]);
  for (const [z, label] of COMMON_ZONES) { if (!seen.has(z)) { seen.add(z); out.push([z, label]); } }
  return out;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const escAttr = (s) => esc(s).replace(/"/g, '&quot;');
function fmtDur(mins) { if (mins < 60) return `${mins}m`; const h = Math.floor(mins / 60); const m = mins % 60; return m ? `${h}h${m}` : `${h}h`; }

/** Wall-clock display: start time + cumulative minutes, formatted in the entry zone. */
function fmtClock(startISO, addMins) {
  const tm = (String(startISO || '').split('T')[1] || '00:00').split(':');
  let total = (Number(tm[0]) || 0) * 60 + (Number(tm[1]) || 0) + addMins;
  const dayOffset = Math.floor(total / 1440);
  total = ((total % 1440) + 1440) % 1440;
  const hh = Math.floor(total / 60); const mm = total % 60;
  const ap = hh < 12 ? 'AM' : 'PM'; const h12 = ((hh + 11) % 12) + 1;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}${dayOffset ? ` +${dayOffset}d` : ''}`;
}

function ensureStyles() {
  if (document.getElementById('rt-manual-editor-styles')) return;
  const css = `
  .me-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
  .me-fields label{display:block;font-size:.78rem;color:var(--muted,#93a0b4);margin:0 0 3px}
  .me-bar{display:flex;gap:8px;margin:12px 0;align-items:center;flex-wrap:wrap}
  .me-paste{margin:0 0 12px;padding:10px;background:var(--panel2,#0d1015);border:1px dashed var(--line,#2a313c);border-radius:8px}
  .me-paste[hidden]{display:none}
  .me-tl{position:relative;height:54px;border:1px solid var(--line,#2a313c);border-radius:8px;display:flex;overflow:hidden;background:var(--panel2,#0d1015);margin-bottom:6px}
  .me-tl-b{position:relative;min-width:2px;border-right:1px solid #0d1015;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#0b1220;font-weight:600;overflow:hidden;white-space:nowrap;padding:0 4px;cursor:grab}
  .me-tl-b.drag{opacity:.4}.me-tl-b.over{box-shadow:inset 0 0 0 2px #fff}
  .me-tl-empty{color:var(--muted,#93a0b4);font-size:.8rem;display:flex;align-items:center;justify-content:center;width:100%}
  .me-legend{font-size:.72rem;color:var(--muted,#93a0b4);margin:0 0 12px}
  .me-tbl{width:100%;border-collapse:collapse}
  .me-tbl th{text-align:left;font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted,#93a0b4);font-weight:600;padding:5px 6px;border-bottom:1px solid var(--line,#2a313c)}
  .me-tbl td{padding:4px 6px;vertical-align:middle;border-bottom:1px solid #20262f}
  .me-tbl tr.drag{opacity:.4}.me-tbl tr.over td{box-shadow:inset 0 2px 0 0 var(--accent,#6ea8fe)}
  .me-grip{cursor:grab;color:var(--muted,#93a0b4);width:16px;text-align:center;user-select:none}
  .me-when{color:var(--ok,#3ad29f);font-variant-numeric:tabular-nums;font-size:.8rem;white-space:nowrap}
  .me-tbl input.me-h{max-width:200px}
  .me-tbl input.dupe{border-color:var(--warn,#f7b955)}
  .me-tot{margin-top:10px;font-size:.8rem;color:var(--muted,#93a0b4);display:flex;gap:14px;flex-wrap:wrap}
  .me-tot b{color:var(--ink,#e7ecf3)}
  .me-warn{margin-top:6px;font-size:.76rem;color:var(--warn,#f7b955)}
  .me-streamers{margin:14px 0 18px;padding-top:10px;border-top:1px dashed var(--line,#2a313c)}
  .me-streamers-h{display:block;font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted,#93a0b4);margin:0 0 8px}
  .me-chips{display:flex;flex-wrap:wrap;gap:6px}
  .me-chip{display:inline-flex;align-items:center;background:var(--panel2,#0d1015);border:1px solid var(--line,#2a313c);border-radius:999px;overflow:hidden}
  .me-chip-add{border:0;background:transparent;color:var(--ink,#e7ecf3);padding:4px 4px 4px 12px;cursor:pointer;font:inherit}
  .me-chip-add:hover{color:var(--accent,#6ea8fe)}
  .me-chip-x{border:0;background:transparent;color:var(--muted,#93a0b4);padding:4px 9px 4px 6px;cursor:pointer;font-size:.85rem}
  .me-chip-x:hover{color:var(--bad,#ff6b6b)}`;
  const el = document.createElement('style');
  el.id = 'rt-manual-editor-styles';
  el.textContent = css;
  document.head.appendChild(el);
}

/**
 * Mount the editor. opts.t is the (live) translator. Returns { refresh() } so the host
 * can re-render after writing new state (hydrate from a ?lineup= link, load a preset)
 * or after the overlay language changes.
 */
export function mountManualEditor({ root, state, onChange, t = (k) => k, getStreamers = () => [], onForgetStreamer = () => {}, onAddStreamer = () => {} }) {
  ensureStyles();
  if (!Array.isArray(state.djs)) state.djs = [];
  if (!state.slotMins) state.slotMins = 60;
  let pasteOpen = false;
  let pasteText = ''; // in-progress paste-box text, preserved across redraws (e.g. a set-length change)

  // A DJ holds N slots ("×N cars on the train"); their length = N × the default set length.
  const minsOf = (d) => clampCount(d.slots) * state.slotMins;
  const startIndexOf = (i) => state.djs.slice(0, i).reduce((n, d) => n + minsOf(d), 0);
  const totalMins = () => state.djs.reduce((n, d) => n + minsOf(d), 0);
  function dupeSet() {
    const seen = {}; const dupes = new Set();
    for (const d of state.djs) { const h = (d.handle || '').trim().toLowerCase(); if (!h) continue; if (seen[h]) dupes.add(h); seen[h] = 1; }
    return dupes;
  }
  function reorder(from, to) {
    if (from == null || from === to || to < 0 || to >= state.djs.length) return;
    const [x] = state.djs.splice(from, 1); state.djs.splice(to, 0, x); draw(); onChange();
  }
  function attachDrag(container) {
    if (!container) return; let from = null;
    container.querySelectorAll('[data-i]').forEach((el) => {
      el.addEventListener('dragstart', () => { from = +el.dataset.i; el.classList.add('drag'); });
      el.addEventListener('dragend', () => { el.classList.remove('drag'); container.querySelectorAll('.over').forEach((x) => x.classList.remove('over')); });
      el.addEventListener('dragover', (e) => { e.preventDefault(); container.querySelectorAll('.over').forEach((x) => x.classList.remove('over')); el.classList.add('over'); });
      el.addEventListener('drop', (e) => { e.preventDefault(); reorder(from, +el.dataset.i); from = null; });
    });
  }

  function fieldsHTML() {
    const zones = zoneOptions(t).map(([z, label]) => `<option value="${escAttr(z)}" ${state.zone === z ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const lengths = SET_LENGTHS.map((m) => `<option value="${m}" ${state.slotMins === m ? 'selected' : ''}>${fmtDur(m)}</option>`).join('')
      + (SET_LENGTHS.includes(state.slotMins) ? '' : `<option value="${state.slotMins}" selected>${fmtDur(state.slotMins)}</option>`);
    return `<div class="me-fields">
      <div><label>${esc(t('configurator.manual.fieldTitle'))}</label><input type="text" id="me-title" value="${escAttr(state.title || '')}" placeholder="${escAttr(t('configurator.manual.titlePlaceholder'))}"></div>
      <div><label>${esc(t('configurator.manual.fieldOrganiser'))}</label><input type="text" id="me-org" value="${escAttr(state.organiser || '')}" placeholder="you"></div>
      <div><label>${esc(t('configurator.manual.fieldStart'))}</label><input type="datetime-local" id="me-start" value="${escAttr(state.startISO || '')}"></div>
      <div><label>${esc(t('configurator.manual.fieldZone'))}</label><select id="me-zone">${zones}</select></div>
      <div><label>${esc(t('configurator.manual.fieldSetLength'))}</label><select id="me-setlen">${lengths}</select></div>
    </div>`;
  }

  function timelineHTML() {
    const total = totalMins() || 1;
    if (!state.djs.length) return `<div class="me-tl"><span class="me-tl-empty">${esc(t('configurator.manual.emptyTimeline'))}</span></div><div class="me-legend">&nbsp;</div>`;
    const blocks = state.djs.map((dj, i) => {
      const mins = minsOf(dj); const w = (mins / total * 100);
      return `<div class="me-tl-b" draggable="true" data-i="${i}" title="${escAttr(dj.handle || '—')} · ${fmtDur(mins)}" style="flex:0 0 ${w}%;background:${PALETTE[i % PALETTE.length]}">${esc(dj.handle || '—')}</div>`;
    }).join('');
    return `<div class="me-tl">${blocks}</div><div class="me-legend">${esc(t('configurator.manual.legend'))}</div>`;
  }

  // Per-DJ control = a slot multiplier ("×N cars on the train"), labelled with the
  // resulting length so both the count AND the time are visible, e.g. "×2 (2h)".
  function slotOptions(slots) {
    const counts = COUNTS.includes(slots) ? COUNTS : [...COUNTS, slots].sort((a, b) => a - b);
    return counts.map((c) => `<option value="${c}" ${slots === c ? 'selected' : ''}>×${c} (${fmtDur(c * state.slotMins)})</option>`).join('');
  }

  function tableHTML() {
    const dupes = dupeSet();
    const rows = state.djs.map((dj, i) => {
      const dupe = dj.handle && dupes.has(dj.handle.trim().toLowerCase());
      const slots = clampCount(dj.slots);
      return `<tr draggable="true" data-i="${i}">
        <td class="me-grip" title="${escAttr(t('configurator.manual.dragReorder'))}">⠿</td>
        <td style="color:var(--muted,#93a0b4)">${i + 1}</td>
        <td><input type="text" class="me-h ${dupe ? 'dupe' : ''}" data-i="${i}" list="me-streamers-dl" value="${escAttr(dj.handle || '')}" placeholder="${escAttr(t('configurator.manual.handlePlaceholder'))}"></td>
        <td><select class="me-d" data-i="${i}">${slotOptions(slots)}</select></td>
        <td class="me-when">${fmtClock(state.startISO, startIndexOf(i))}</td>
        <td style="text-align:right"><button type="button" class="me-del" data-i="${i}" title="${escAttr(t('configurator.manual.remove'))}">✕</button></td>
      </tr>`;
    }).join('');
    return `<table class="me-tbl"><thead><tr><th></th><th>${esc(t('configurator.manual.colNum'))}</th><th>${esc(t('configurator.manual.colHandle'))}</th><th>${esc(t('configurator.manual.colPlays'))}</th><th>${esc(t('configurator.manual.colLive'))}</th><th></th></tr></thead><tbody class="me-rows">${rows}</tbody></table>`;
  }

  function footerHTML() {
    const dupes = dupeSet(); const empties = state.djs.filter((d) => !(d.handle || '').trim()).length;
    let warn = '';
    if (dupes.size) warn += `${t('configurator.manual.warnDup', { names: [...dupes].join(', ') })} `;
    if (empties) warn += `${t('configurator.manual.warnEmpty', { n: empties })} `;
    if (state.djs.length > 40) warn += `${t('configurator.manual.warnMany')} `;
    return `<div class="me-tot"><span>${t('configurator.manual.totDjs', { n: state.djs.length })}</span><span>${t('configurator.manual.totDuration', { dur: fmtDur(totalMins()) })}</span></div>${warn ? `<div class="me-warn">${esc(warn)}</div>` : ''}`;
  }

  function refreshTimeline() {
    const old = root.querySelector('.me-tl'); if (!old) return;
    const tmp = document.createElement('div'); tmp.innerHTML = timelineHTML();
    old.replaceWith(tmp.firstChild);
    attachDrag(root.querySelector('.me-tl'));
  }
  function refreshFooter() { const f = root.querySelector('#me-footer'); if (f) f.innerHTML = footerHTML(); }

  // Saved-streamers: a click-to-add chip rail (newest-first) + a <datalist> that drives
  // autocomplete on every handle input. Both read the host's remembered-streamers store.
  function streamersHTML() {
    const saved = getStreamers();
    const dl = `<datalist id="me-streamers-dl">${saved.map((h) => `<option value="${escAttr(h)}"></option>`).join('')}</datalist>`;
    const chips = saved.map((h) => `<span class="me-chip"><button type="button" class="me-chip-add" data-add="${escAttr(h)}">${esc(h)}</button><button type="button" class="me-chip-x" data-forget="${escAttr(h)}" title="${escAttr(t('configurator.manual.forget'))}">✕</button></span>`).join('');
    // Always shown — even with nothing saved — so the "save a streamer" field is available
    // without needing to save a preset or copy the URL.
    return `<div class="me-streamers">
      <span class="me-streamers-h">${esc(t('configurator.manual.savedStreamers'))}</span>
      <div class="me-bar" style="margin:0"><input type="text" id="me-streamer-add" style="flex:1;min-width:140px" placeholder="${escAttr(t('configurator.manual.addStreamer'))}"><button type="button" id="me-streamer-save">${esc(t('configurator.save'))}</button></div>
      ${saved.length ? `<div class="me-chips" style="margin-top:8px">${chips}</div>` : ''}
    </div>${dl}`;
  }

  function draw() {
    root.innerHTML = fieldsHTML()
      // Add controls go ABOVE the list, so "Add to lineup" reads naturally with the table below.
      + `<div class="me-bar"><button type="button" id="me-add">${esc(t('configurator.manual.addDj'))}</button>`
      + `<button type="button" id="me-paste-toggle">${esc(pasteOpen ? t('configurator.manual.pasteClose') : t('configurator.manual.pasteOpen'))}</button>`
      + `<span style="font-size:.76rem;color:var(--muted,#93a0b4)">${esc(t('configurator.manual.pasteHint'))}</span></div>`
      + `<div class="me-paste" id="me-paste" ${pasteOpen ? '' : 'hidden'}><label style="font-size:.78rem;color:var(--muted,#93a0b4)">${esc(t('configurator.manual.pasteLabel'))}</label>`
      + `<textarea id="me-bulk" rows="4" style="width:100%;margin-top:6px" placeholder="djsparkle&#10;nightowl 2h&#10;https://twitch.tv/basslines 90m">${esc(pasteText)}</textarea>`
      + `<div class="me-bar" style="margin-bottom:0"><button type="button" class="primary" id="me-add-these">${esc(t('configurator.manual.pasteAdd'))}</button></div></div>`
      + streamersHTML()
      + timelineHTML() + tableHTML() + `<div id="me-footer">${footerHTML()}</div>`;
    wire();
  }

  function wire() {
    const bind = (id, key, after) => { const el = root.querySelector(id); if (el) el.addEventListener('input', () => { state[key] = el.value; onChange(); if (after) after(); }); };
    bind('#me-title', 'title');
    bind('#me-org', 'organiser');
    bind('#me-start', 'startISO', () => { refreshTimeline(); rebuildRowsTimes(); });
    const zoneEl = root.querySelector('#me-zone'); if (zoneEl) zoneEl.addEventListener('change', () => { state.zone = zoneEl.value; onChange(); });
    const setlenEl = root.querySelector('#me-setlen'); if (setlenEl) setlenEl.addEventListener('change', () => { state.slotMins = Number(setlenEl.value); draw(); onChange(); });

    root.querySelectorAll('input.me-h').forEach((el) => {
      el.addEventListener('input', () => { state.djs[+el.dataset.i].handle = el.value; onChange(); refreshTimeline(); refreshFooter(); });
      el.addEventListener('blur', () => {
        // Normalize IN PLACE (no full draw) so a click on this row's select/✕ that triggered
        // the blur isn't swallowed by the DOM being rebuilt under it.
        const i = +el.dataset.i; const n = normalizeHandle(el.value);
        if (n !== el.value) { state.djs[i].handle = n; el.value = n; refreshTimeline(); refreshFooter(); onChange(); }
      });
    });
    root.querySelectorAll('select.me-d').forEach((el) => el.addEventListener('change', () => { state.djs[+el.dataset.i].slots = clampCount(el.value); draw(); onChange(); }));
    root.querySelectorAll('button.me-del').forEach((el) => el.addEventListener('click', () => { state.djs.splice(+el.dataset.i, 1); draw(); onChange(); }));
    attachDrag(root.querySelector('.me-rows'));
    attachDrag(root.querySelector('.me-tl'));

    root.querySelector('#me-add').addEventListener('click', () => {
      state.djs.push({ handle: '', slots: 1 }); draw(); onChange();
      const ins = root.querySelectorAll('input.me-h'); ins[ins.length - 1]?.focus();
    });
    root.querySelector('#me-paste-toggle').addEventListener('click', () => { pasteOpen = !pasteOpen; draw(); if (pasteOpen) root.querySelector('#me-bulk')?.focus(); });
    const bulk = root.querySelector('#me-bulk');
    if (bulk) bulk.addEventListener('input', () => { pasteText = bulk.value; }); // keep text through redraws
    root.querySelector('#me-add-these').addEventListener('click', () => {
      // A pasted duration ("2h"/"90m") rounds to the nearest number of set-length slots.
      const parsed = pasteText.split('\n')
        .map((l) => parseLine(l, state.slotMins)).filter(Boolean)
        .map((p) => ({ handle: p.handle, slots: clampCount(Math.round(p.mins / state.slotMins)) }));
      if (parsed.length) { state.djs.push(...parsed); pasteText = ''; pasteOpen = false; draw(); onChange(); }
    });

    // Saved-streamer chips: add to the lineup, or forget.
    root.querySelectorAll('.me-chip-add').forEach((el) => el.addEventListener('click', () => {
      state.djs.push({ handle: el.dataset.add, slots: 1 }); draw(); onChange();
    }));
    root.querySelectorAll('.me-chip-x').forEach((el) => el.addEventListener('click', () => { onForgetStreamer(el.dataset.forget); draw(); }));

    // Manually save a streamer to the list (no preset / no copy needed).
    const addInput = root.querySelector('#me-streamer-add');
    const saveBtn = root.querySelector('#me-streamer-save');
    const doAddStreamer = () => { const h = normalizeHandle(addInput.value); if (h) { onAddStreamer(h); draw(); } };
    if (saveBtn) saveBtn.addEventListener('click', doAddStreamer);
    if (addInput) addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doAddStreamer(); } });
  }

  // Update only the "Goes live" cells in place (start-time change; no full redraw).
  function rebuildRowsTimes() { root.querySelectorAll('.me-when').forEach((c, i) => { c.textContent = fmtClock(state.startISO, startIndexOf(i)); }); }

  draw();
  return { refresh: draw };
}
