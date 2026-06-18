/**
 * DOM localizer for the static HTML pages (Configurator, landing). Browser-only
 * — the overlay + themes never touch this; they read strings through config.t.
 *
 * English text stays inline in the HTML as the authored default; these data-*
 * hooks replace it when a non-en catalog loads, so a failed/absent translation
 * simply leaves the English in place:
 *   - [data-i18n]       → textContent
 *   - [data-i18n-html]  → innerHTML (strings carrying <a>/<code>/<strong>/<br>)
 *   - [data-i18n-attr]  → "attr:key; attr:key" (placeholder/title/aria-label/…)
 * A key absent from the catalog is left untouched (the inline default wins).
 */
export function localizeDom(root, messages) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (messages[key] != null) el.textContent = messages[key];
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    const key = el.getAttribute('data-i18n-html');
    if (messages[key] != null) el.innerHTML = messages[key];
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
      const idx = pair.indexOf(':');
      if (idx === -1) continue;
      const attr = pair.slice(0, idx).trim();
      const key = pair.slice(idx + 1).trim();
      if (attr && key && messages[key] != null) el.setAttribute(attr, messages[key]);
    }
  });
}
