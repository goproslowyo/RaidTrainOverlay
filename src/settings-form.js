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
 *
 * i18n: settings-schema.js names its strings by catalog key and holds no
 * English; this is where they become words, so every caller must supply a `t`.
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

/**
 * A select's `value → label` map, translated. `optionKeys` carry catalog keys;
 * `literalOptions` (the language endonyms) are already language-independent and
 * pass through untranslated. Order follows optionKeys then literalOptions, which
 * is why Auto heads the language list.
 */
function optionLabels(def, t) {
  const out = {};
  for (const [value, key] of Object.entries(def.optionKeys ?? {})) out[value] = t(key);
  for (const [value, label] of Object.entries(def.literalOptions ?? {})) out[value] = label;
  return out;
}

/** A raw value as a human would read it in a hint ("on"/"off", the option label, "blank"). */
function readableValue(def, value, t) {
  if (def.type === 'check') return value ? t('configurator.valueOn') : t('configurator.valueOff');
  if (def.type === 'select') return optionLabels(def, t)[value] ?? String(value);
  return String(value) === '' ? t('configurator.valueBlank') : String(value);
}

function controlHtml(def, value, id, t) {
  const common = `id="${id}" data-sfield="${def.key}"`;
  const placeholder = def.placeholderKey ? t(def.placeholderKey) : '';
  if (def.type === 'select') {
    const options = Object.entries(optionLabels(def, t))
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
      placeholder ? ` placeholder="${esc(placeholder)}"` : '',
    ].join('');
    return `<input type="number" ${common}${bounds} value="${esc(value)}">`;
  }
  if (def.type === 'check') {
    return `<label class="check-row"><input type="checkbox" ${common}${value ? ' checked' : ''}>
      <span>${esc(def.checkTextKey ? t(def.checkTextKey) : '')}</span></label>`;
  }
  return `<input type="text" ${common} value="${esc(value)}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''} autocomplete="off">`;
}

/** The override badge + its revert button — built in two places, so built once. */
function badgeHtml(def, t) {
  return `<span class="ovr-badge">${esc(t('configurator.ovrBadge'))}</span>
       <button type="button" class="ovr-revert" data-srevert="${def.key}"
         title="${esc(t('configurator.ovrRevert'))}" aria-label="${esc(t('configurator.ovrRevertField', { field: t(def.labelKey) }))}">↺</button>`;
}

function fieldHtml(def, value, prefix, overridden, t) {
  const id = `${prefix}-${def.key}`;
  return `<div class="field" data-sfieldrow="${def.key}">
    <div class="field-head">
      <label for="${id}">${esc(t(def.labelKey))}</label>
      <span class="ovr-slot" data-sovr="${def.key}">${overridden ? badgeHtml(def, t) : ''}</span>
    </div>
    ${controlHtml(def, value, id, t)}
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
 *
 * `t` is the bound translator — required, since the schema holds no English.
 */
export function mountSettingsForm({ root, prefix = 'sf', getState, onChange = () => {}, onRevert = () => {}, t }) {
  const groupTag = (count) => (count ? esc(t('configurator.groupOverridden', { n: count })) : '');

  function render() {
    const { values, base } = getState();
    const effective = normalizeSettings(values);
    const overrides = base ? diffSettings(base, effective) : {};
    root.innerHTML = SETTING_GROUPS.map((group) => {
      const fields = SETTING_FIELDS.filter((def) => def.group === group.id)
        .map((def) => fieldHtml(def, effective[def.key], prefix, Object.hasOwn(overrides, def.key), t))
        .join('');
      const count = base ? groupOverrideCount(group.id, overrides) : 0;
      return `<details class="fgroup"${group.id === 'look' ? ' open' : ''}>
        <summary>
          <span class="g-label">${esc(t(group.labelKey))}</span>
          <span class="g-ovr" data-sgroup="${group.id}">${groupTag(count)}</span>
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
          slot.innerHTML = overridden ? badgeHtml(def, t) : '';
        }
      }
      const hint = root.querySelector(`[data-shint="${def.key}"]`);
      if (hint) {
        const gate = gating[def.key];
        if (overridden && baseValues) {
          // Carries a raw setting value — `tz` is whatever the streamer typed —
          // so this branch stays textContent. The catalog branch below may hold
          // authored markup (<strong>, <code>, <br>) and is trusted.
          hint.textContent = t('configurator.presetValue', { value: readableValue(def, baseValues[def.key], t) });
        } else {
          const noteKey = gate?.noteKey;
          hint.innerHTML = noteKey ? t(noteKey) : (def.hintKey ? t(def.hintKey) : '');
        }
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
      tag.textContent = count ? t('configurator.groupOverridden', { n: count }) : '';
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

  // `input` only: selects and checkboxes fire it too, so also listening for
  // `change` ran every edit twice — two store writes and two preview re-renders
  // per keystroke on a slider drag.
  root.addEventListener('input', (e) => handleEdit(e.target));
  root.addEventListener('click', (e) => {
    const button = e.target.closest('[data-srevert]');
    if (!button) return;
    onRevert(button.dataset.srevert);
    sync();
  });

  render();
  return { render, refresh, sync };
}
