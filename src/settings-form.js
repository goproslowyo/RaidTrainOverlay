/**
 * settings-form: the settings editor both the Raid Train Config editor and the
 * Preset editor mount. One component off one schema (settings-schema.js), so a
 * field can never exist in one editor and not the other.
 *
 * Two modes, chosen by whether the caller supplies a `base`:
 *   base = null   → Preset editor. Plain fields; edits ARE the values.
 *   base = object → Raid Train Config editor. Fields show the EFFECTIVE value;
 *                   a field that differs from the base wears an override badge,
 *                   a revert button, and its Preset's value as the hint, and
 *                   each group counts its overridden fields.
 *
 * Chrome (badges, group tags, hints, gating) refreshes IN PLACE after an edit —
 * never by re-rendering — so a slider drag survives its own change events.
 */

import {
  FIELD_BY_KEY,
  SETTING_FIELDS,
  SETTING_GROUPS,
  diffSettings,
  fieldGating,
  groupOverrideCount,
  normalizeSettings,
} from './settings-schema.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** A raw value as a human would read it in a hint ("on"/"off", the option label, "blank"). */
function readableValue(def, value) {
  if (def.type === 'check') return value ? 'on' : 'off';
  if (def.type === 'select') return def.options[value] ?? String(value);
  return String(value) === '' ? 'blank' : String(value);
}

function controlHtml(def, value, id) {
  const common = `id="${id}" data-sfield="${def.key}"`;
  if (def.type === 'select') {
    const options = Object.entries(def.options)
      .map(([k, label]) => `<option value="${esc(k)}"${String(value) === String(k) ? ' selected' : ''}>${esc(label)}</option>`)
      .join('');
    return `<select ${common}>${options}</select>`;
  }
  if (def.type === 'range') {
    return `<div class="range-row">
      <input type="range" ${common} min="${def.min}" max="${def.max}" step="${def.step}" value="${esc(value)}">
      <span class="range-out" data-sout="${def.key}">${esc(value)}</span>
    </div>`;
  }
  if (def.type === 'number') {
    const bounds = [
      def.min != null ? ` min="${def.min}"` : '',
      def.max != null ? ` max="${def.max}"` : '',
      def.step != null ? ` step="${def.step}"` : '',
      def.placeholder ? ` placeholder="${esc(def.placeholder)}"` : '',
    ].join('');
    return `<input type="number" ${common}${bounds} value="${esc(value)}">`;
  }
  if (def.type === 'check') {
    return `<label class="check-row"><input type="checkbox" ${common}${value ? ' checked' : ''}>
      <span>${esc(def.checkText ?? '')}</span></label>`;
  }
  return `<input type="text" ${common} value="${esc(value)}"${def.placeholder ? ` placeholder="${esc(def.placeholder)}"` : ''} autocomplete="off">`;
}

function fieldHtml(def, value, prefix, overridden) {
  const id = `${prefix}-${def.key}`;
  const badge = overridden
    ? `<span class="ovr-badge">Overrides preset</span>
       <button type="button" class="ovr-revert" data-srevert="${def.key}"
         title="Revert to the preset value" aria-label="Revert ${esc(def.label)} to the preset value">↺</button>`
    : '';
  return `<div class="field" data-sfieldrow="${def.key}">
    <div class="field-head">
      <label for="${id}">${esc(def.label)}</label>
      <span class="ovr-slot" data-sovr="${def.key}">${badge}</span>
    </div>
    ${controlHtml(def, value, id)}
    <div class="hint" data-shint="${def.key}"></div>
  </div>`;
}

/**
 * Mount the form into `root`.
 *
 * `getState()` must return `{ values, base }` — the current effective settings
 * and the base to diff against (null in Preset mode). It is re-read after every
 * edit, so the page stays the single owner of the data.
 *
 * `onChange(key, value)` receives the raw new value (boolean for checkboxes);
 * `onRevert(key)` fires when a revert button is pressed.
 */
export function mountSettingsForm({ root, prefix = 'sf', getState, onChange = () => {}, onRevert = () => {} }) {
  function render() {
    const { values, base } = getState();
    const effective = normalizeSettings(values);
    const overrides = base ? diffSettings(base, effective) : {};
    root.innerHTML = SETTING_GROUPS.map((group) => {
      const fields = SETTING_FIELDS.filter((def) => def.group === group.id)
        .map((def) => fieldHtml(def, effective[def.key], prefix, Object.hasOwn(overrides, def.key)))
        .join('');
      const count = base ? groupOverrideCount(group.id, overrides) : 0;
      return `<details class="fgroup"${group.id === 'look' ? ' open' : ''}>
        <summary>
          <span class="g-label">${esc(group.label)}</span>
          <span class="g-ovr" data-sgroup="${group.id}">${count ? `${count} overridden` : ''}</span>
          <span class="g-chev" aria-hidden="true">▾</span>
        </summary>
        <div class="fgroup-body">${fields}</div>
      </details>`;
    }).join('');
    refresh();
  }

  /** Badges, group tags, hints, range read-outs and gating — all in place. */
  function refresh() {
    const { values, base } = getState();
    const effective = normalizeSettings(values);
    const overrides = base ? diffSettings(base, effective) : {};
    const gating = fieldGating(effective);
    const baseValues = base ? normalizeSettings(base) : null;

    for (const def of SETTING_FIELDS) {
      const overridden = Object.hasOwn(overrides, def.key);
      const slot = root.querySelector(`[data-sovr="${def.key}"]`);
      if (slot) {
        const wanted = overridden ? 'on' : 'off';
        // Rebuild only on a transition — an untouched badge keeps its :focus.
        if (slot.dataset.state !== wanted) {
          slot.dataset.state = wanted;
          slot.innerHTML = overridden
            ? `<span class="ovr-badge">Overrides preset</span>
               <button type="button" class="ovr-revert" data-srevert="${def.key}"
                 title="Revert to the preset value" aria-label="Revert ${esc(def.label)} to the preset value">↺</button>`
            : '';
        }
      }
      const hint = root.querySelector(`[data-shint="${def.key}"]`);
      if (hint) {
        const gate = gating[def.key];
        hint.textContent = overridden && baseValues
          ? `Preset value: ${readableValue(def, baseValues[def.key])}`
          : (gate?.disabled && gate.note) || gate?.note || def.hint || '';
      }
      const out = root.querySelector(`[data-sout="${def.key}"]`);
      if (out) out.textContent = effective[def.key];

      const input = root.querySelector(`[data-sfield="${def.key}"]`);
      const row = root.querySelector(`[data-sfieldrow="${def.key}"]`);
      const disabled = Boolean(gating[def.key]?.disabled);
      if (input) input.disabled = disabled;
      if (row) row.classList.toggle('dimmed', disabled);
    }

    for (const group of SETTING_GROUPS) {
      const tag = root.querySelector(`[data-sgroup="${group.id}"]`);
      if (!tag) continue;
      const count = base ? groupOverrideCount(group.id, overrides) : 0;
      tag.textContent = count ? `${count} overridden` : '';
    }
  }

  /** Push new values into the live controls without rebuilding them (preset switch, reset-all). */
  function sync() {
    const { values } = getState();
    const effective = normalizeSettings(values);
    for (const def of SETTING_FIELDS) {
      const input = root.querySelector(`[data-sfield="${def.key}"]`);
      if (!input) continue;
      if (def.type === 'check') input.checked = Boolean(effective[def.key]);
      else input.value = effective[def.key];
    }
    refresh();
  }

  function handleEdit(target) {
    const key = target.dataset?.sfield;
    if (!key) return;
    const def = FIELD_BY_KEY[key];
    onChange(key, def.type === 'check' ? target.checked : target.value);
    refresh();
  }

  root.addEventListener('input', (e) => handleEdit(e.target));
  root.addEventListener('change', (e) => handleEdit(e.target));
  root.addEventListener('click', (e) => {
    const button = e.target.closest('[data-srevert]');
    if (!button) return;
    onRevert(button.dataset.srevert);
    sync();
  });

  render();
  return { render, refresh, sync };
}
