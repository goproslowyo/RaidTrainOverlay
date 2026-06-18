/**
 * i18n runtime: resolve a locale, load its merged message catalog, and bind a
 * translator. Pure logic + dynamic catalog imports — no DOM (see dom.js for the
 * page-localizer). No build step: catalogs are native ES modules, lazy-loaded
 * via the explicit LOADERS map so a browser resolves each path at runtime.
 *
 * Locale model: `en` is the base / source of truth (every key). Region variants
 * layer over a language base — `es-ES`/`es-MX` both merge over the shared `es`
 * catalog, overriding only the strings that diverge. loadMessages ALWAYS starts
 * from `en`, so a key missing from a translation falls back to English rather
 * than rendering blank.
 */
export const DEFAULT_LOCALE = 'en';

/** The canonical locales a streamer can publish/select. */
export const SUPPORTED_LOCALES = ['en', 'es-ES', 'es-MX', 'pt-BR', 'it', 'de', 'nl', 'da', 'lt', 'fr'];

/**
 * locale → the catalog module(s) to merge left-to-right OVER the en base.
 * Spanish variants pull the shared `es` base first, then their thin override.
 * Explicit (not a computed `./locales/${x}.js`) so the paths are statically
 * analyzable and a bundler/preloader could see them later.
 */
const LOADERS = {
  'en': () => [import('./locales/en.js')],
  'es-ES': () => [import('./locales/es.js'), import('./locales/es-ES.js')],
  'es-MX': () => [import('./locales/es.js'), import('./locales/es-MX.js')],
  'pt-BR': () => [import('./locales/pt-BR.js')],
  'it': () => [import('./locales/it.js')],
  'de': () => [import('./locales/de.js')],
  'nl': () => [import('./locales/nl.js')],
  'da': () => [import('./locales/da.js')],
  'lt': () => [import('./locales/lt.js')],
  'fr': () => [import('./locales/fr.js')],
};

/** Map a language base (no region) to its default supported locale. */
const BASE_DEFAULT = {
  en: 'en', es: 'es-ES', pt: 'pt-BR', it: 'it', de: 'de', nl: 'nl', da: 'da', lt: 'lt', fr: 'fr',
};

/**
 * One BCP-47-ish tag → a canonical SUPPORTED_LOCALES entry, or null. Tries an
 * exact (case-insensitive) region match first (so `es-MX` keeps its own
 * catalog), then the language base (`es-419`, `es` → the default `es-ES`;
 * `pt`/`pt-PT` → `pt-BR`). Unknown languages → null so the caller can fall
 * through to the next candidate.
 */
export function canonicalLocale(tag) {
  if (tag == null) return null;
  const t = String(tag).trim().toLowerCase().replace(/_/g, '-');
  if (t === '') return null;
  const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === t);
  if (exact) return exact;
  const base = t.split('-')[0];
  return BASE_DEFAULT[base] ?? null;
}

/**
 * Pick the best locale from an explicit request then the navigator's preference
 * list. `requested` (the overlay's ?lang= or the configurator's selector) wins;
 * otherwise the first navigator language that maps to a supported locale; else
 * the default. navigatorLanguages is passed in so this stays testable + pure.
 */
export function resolveLocale(requested, navigatorLanguages = []) {
  for (const candidate of [requested, ...(navigatorLanguages || [])]) {
    const c = canonicalLocale(candidate);
    if (c) return c;
  }
  return DEFAULT_LOCALE;
}

/**
 * Locale → merged message catalog (a flat key→string object). Starts from the
 * full `en` base so every key resolves, then layers the locale's module(s) on
 * top. An unknown locale degrades to the en base.
 */
export async function loadMessages(locale) {
  const en = (await import('./locales/en.js')).default;
  let messages = { ...en };
  if (locale && locale !== DEFAULT_LOCALE && LOADERS[locale]) {
    const mods = await Promise.all(LOADERS[locale]());
    for (const mod of mods) messages = { ...messages, ...mod.default };
  }
  return messages;
}

/**
 * Bind a catalog to a translator: `t(key, params?)`. `{name}`-style tokens in
 * the string are replaced from params. A missing key returns the key itself
 * (a visible canary — shouldn't happen, since loadMessages merges the en base).
 */
export function makeT(messages) {
  return function t(key, params) {
    let s = messages[key];
    if (s == null) s = key;
    if (params) {
      for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
    }
    return s;
  };
}
