import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalLocale,
  resolveLocale,
  selectorLocale,
  loadMessages,
  makeT,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from '../src/i18n/index.js';
import enMessages from '../src/i18n/locales/en.js';
import { DESCRIPTIONS, BADGE_BUDGET } from '../src/i18n/context.js';

// The catalog files that make up each supported locale, merged left→right over
// the en base. Spanish variants layer a thin override over the shared es base.
const LOCALE_FILES = {
  'en': ['en.js'],
  'es-ES': ['es.js', 'es-ES.js'],
  'es-MX': ['es.js', 'es-MX.js'],
  'pt-BR': ['pt-BR.js'],
  'it': ['it.js'],
  'de': ['de.js'],
  'nl': ['nl.js'],
  'da': ['da.js'],
  'lt': ['lt.js'],
  'fr': ['fr.js'],
};

const tokensOf = (s) => (String(s).match(/\{[a-zA-Z]+\}/g) ?? []).sort();
const tagsOf = (s) => String(s).match(/<[^>]+>/g) ?? [];

test('canonicalLocale: exact region, language base, and unknowns', () => {
  assert.equal(canonicalLocale('es-MX'), 'es-MX');      // exact region kept
  assert.equal(canonicalLocale('ES-mx'), 'es-MX');      // case-insensitive
  assert.equal(canonicalLocale('es'), 'es-ES');         // bare es → default Spanish
  assert.equal(canonicalLocale('es-419'), 'es-ES');     // other es-* → default Spanish
  assert.equal(canonicalLocale('pt'), 'pt-BR');         // pt / pt-PT → Brazilian
  assert.equal(canonicalLocale('pt-PT'), 'pt-BR');
  assert.equal(canonicalLocale('de-DE'), 'de');         // region dropped to base
  assert.equal(canonicalLocale('fr'), 'fr');
  assert.equal(canonicalLocale('en-GB'), 'en');
  assert.equal(canonicalLocale('ja'), null);            // unsupported → null
  assert.equal(canonicalLocale(''), null);
  assert.equal(canonicalLocale(null), null);
});

test('resolveLocale: explicit request wins, then navigator, then default', () => {
  assert.equal(resolveLocale('de', ['fr', 'en']), 'de');                 // explicit wins
  assert.equal(resolveLocale(null, ['ja-JP', 'fr-FR', 'en']), 'fr');     // first supported nav lang
  assert.equal(resolveLocale(undefined, ['ja', 'ko']), DEFAULT_LOCALE);  // none supported → en
  assert.equal(resolveLocale(null, []), DEFAULT_LOCALE);
  assert.equal(resolveLocale('es-MX', ['de']), 'es-MX');
});

test('selectorLocale: maps a stored lang to the configurator selector value', () => {
  // Explicit English must stay selectable and distinct from Auto — the whole
  // point of issue #1: a non-English browser could not force English before.
  assert.equal(selectorLocale('en'), 'en');
  assert.equal(selectorLocale('de'), 'de');
  assert.equal(selectorLocale('es'), 'es-ES');   // canonicalized to the supported tag
  assert.equal(selectorLocale('es-MX'), 'es-MX');
  assert.equal(selectorLocale('en-GB'), 'en');   // region folded to the base
  // Absent / unknown → '' (Auto: omit lang, follow the browser).
  assert.equal(selectorLocale(''), '');
  assert.equal(selectorLocale(null), '');
  assert.equal(selectorLocale(undefined), '');
  assert.equal(selectorLocale('ja'), '');        // unsupported → Auto, never a stray value
});

test('SUPPORTED_LOCALES and LOCALE_FILES stay in lockstep', () => {
  assert.deepEqual([...SUPPORTED_LOCALES].sort(), Object.keys(LOCALE_FILES).sort());
});

test('loadMessages always falls back to the en base for missing keys', async () => {
  // A locale that exists but (hypothetically) lacks a key still resolves it via en.
  const de = await loadMessages('de');
  for (const key of Object.keys(enMessages)) {
    assert.ok(de[key] != null && de[key] !== '', `de missing a resolved value for ${key}`);
  }
  // Unknown locale degrades to the en base rather than throwing.
  const unknown = await loadMessages('zz');
  assert.equal(unknown['overlay.now'], enMessages['overlay.now']);
});

test('es-ES / es-MX override the shared es base', async () => {
  const esES = await loadMessages('es-ES');
  const esMX = await loadMessages('es-MX');
  // Both are complete and Spanish (not the English base value for a translated badge).
  assert.notEqual(esES['overlay.open'], enMessages['overlay.open']);
  assert.notEqual(esMX['overlay.open'], enMessages['overlay.open']);
});

test('context.js documents every key and budgets only real keys', () => {
  const enKeys = Object.keys(enMessages);
  const undocumented = enKeys.filter((k) => !(k in DESCRIPTIONS));
  assert.deepEqual(undocumented, [], `context.js DESCRIPTIONS missing: ${undocumented.join(', ')}`);
  const strayBudget = Object.keys(BADGE_BUDGET).filter((k) => !(k in enMessages));
  assert.deepEqual(strayBudget, [], `BADGE_BUDGET references unknown keys: ${strayBudget.join(', ')}`);
});

test('makeT interpolates {tokens} and echoes unknown keys', () => {
  const t = makeT({ greet: 'Hi {name}!', bare: 'no tokens' });
  assert.equal(t('greet', { name: 'Ada' }), 'Hi Ada!');
  assert.equal(t('bare'), 'no tokens');
  assert.equal(t('missing.key'), 'missing.key'); // visible canary, never blank
});

// ── Catalog completeness + integrity (one subtest per locale) ───────────────
const enKeys = Object.keys(enMessages);
for (const [locale, files] of Object.entries(LOCALE_FILES)) {
  test(`catalog ${locale}: covers every en key, preserves tokens + HTML`, async () => {
    const merged = {};
    for (const file of files) {
      const mod = await import(`../src/i18n/locales/${file}`);
      Object.assign(merged, mod.default);
    }
    // Completeness: every en key present.
    const missing = enKeys.filter((k) => !(k in merged));
    assert.deepEqual(missing, [], `${locale} is missing keys: ${missing.join(', ')}`);

    // Integrity: every translated value keeps en's interpolation tokens and the
    // exact HTML tag sequence (tags/hrefs must be copied verbatim, only the text
    // between them translated).
    for (const key of enKeys) {
      assert.deepEqual(tokensOf(merged[key]), tokensOf(enMessages[key]),
        `${locale} key ${key}: interpolation tokens differ from en`);
      assert.deepEqual(tagsOf(merged[key]), tagsOf(enMessages[key]),
        `${locale} key ${key}: HTML tags differ from en`);
    }
  });
}

test('no catalog file carries a key en.js does not have', async () => {
  // Completeness (above) only asserts locale ⊇ en, so a key RENAMED in en.js
  // leaves the old one behind in a translation as dead weight — and takes its
  // divergence with it. That is exactly how `configurator.openslotsHint`
  // survived in es-MX.js after the rebuild renamed it to `openslotsCheck`:
  // Mexico's "regístrate" wording silently stopped rendering, and the merge
  // hid it because a stray key is never read. Checked per FILE, not per merged
  // locale, so a region variant's own dead overrides surface too.
  const files = [...new Set(Object.values(LOCALE_FILES).flat())];
  const strays = [];
  for (const file of files) {
    const mod = await import(`../src/i18n/locales/${file}`);
    for (const key of Object.keys(mod.default)) {
      if (!(key in enMessages)) strays.push(`${file}: ${key}`);
    }
  }
  assert.deepEqual(strays, [], `keys absent from en.js (renamed or deleted?): ${strays.join(', ')}`);
});

test('the open-slots checkbox names the badge its own overlay paints', async () => {
  // configurator.openslotsCheck tells the streamer to look for a car reading
  // OPEN; overlay.open is the word actually painted on that car. They are 350
  // lines apart in every catalog, so a translator fixing one never sees the
  // other — every locale localized the badge and left the English word in the
  // checkbox, promising a label that would never appear. Cross-key, so no
  // per-string review catches it; this does.
  for (const locale of SUPPORTED_LOCALES) {
    const merged = await loadMessages(locale);
    assert.ok(merged['configurator.openslotsCheck'].includes(merged['overlay.open']),
      `${locale}: openslotsCheck "${merged['configurator.openslotsCheck']}" `
      + `does not name the overlay.open badge "${merged['overlay.open']}"`);
  }
});

test('theme modules paint viewer words through the translator, never as literals', async () => {
  // Every word painted into the on-stream train art must come from the catalog
  // via L(...) — a hardcoded 'BOARDING' renders English to a German viewer and
  // no catalog test can see it. node can't mount a Theme (no DOM), so the
  // invariant is pinned at the source, like the rAF and Configurator-translator
  // tests: no theme module may carry an en badge value as a bare string.
  // shared-svg.js is exempt — it IS the English fallback catalog (LABELS_EN).
  const { readFile, readdir } = await import('node:fs/promises');
  const dir = new URL('../src/themes/', import.meta.url);
  // The en values of every viewer-facing badge/status/caption, plus the words
  // the departures board once hardcoded outside the catalog.
  const words = [
    'NOW', 'OPEN', 'PLAYED', 'STAFF', 'ORGANISED BY',
    'ON TIME', 'BOARDING', 'DEPARTED', 'LEAD', 'CONDUCTOR',
    'NEXT SLOT', 'COACH', 'DEPARTURES',
  ];
  // \b-style boundaries that also treat _ and digits as word chars, so the
  // identifiers R_OPEN / LEAD_W don't read as painted words.
  const wordRe = new RegExp(`(?<![A-Za-z0-9_])(?:${words.join('|')})(?![A-Za-z0-9_])`);
  const offenders = [];
  for (const entry of await readdir(dir)) {
    if (!entry.endsWith('.js') || entry === 'shared-svg.js') continue;
    const code = (await readFile(new URL(entry, dir), 'utf8'))
      .replace(/\/\*[\s\S]*?\*\//g, '')      // block comments
      .replace(/^\s*\/\/.*$/gm, '')          // whole-line comments
      .replace(/\s\/\/[^'"`]*$/gm, '');      // trailing comments (never a string; ':/\/' in URLs survives)
    const m = code.match(wordRe);
    if (m) offenders.push(`${entry}: paints "${m[0]}" as a literal`);
  }
  assert.ok((await readdir(dir)).includes('departures.js'), 'the walk found the theme roster');
  assert.deepEqual(offenders, [], 'viewer words must go through L(...) so locales translate them');
});

test('every Configurator render call passes a translator', async () => {
  // settings-schema.js holds no English — it names its strings by catalog key —
  // so the modules that render from it (settings-form, train-list, preview-frame)
  // only produce words if a `t` reaches them. Each keeps a passthrough default so
  // a missing translator degrades to raw keys instead of throwing mid-render, and
  // that softness is exactly what hid a real bug: paintCard() repainted a card
  // without `t`, so a train whose details had loaded showed "configurator.slotsFilled"
  // and "configurator.cardConfigure" on screen while its neighbours read fine.
  //
  // node can't mount the page, so the invariant is pinned at the source: every
  // call to one of these must pass something named `t` as its translator argument.
  const { readFile } = await import('node:fs/promises');
  const page = (await readFile(new URL('../configurator.html', import.meta.url), 'utf8'))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  // These calls nest parentheses (`trainCardHtml(cardView(…), t)`) and sit inside
  // .map(…), so the argument list has to be read by paren balance — a lazy regex
  // to the next `);` runs straight past the end of the call.
  const argsOf = (source, name) => {
    const out = [];
    for (const m of source.matchAll(new RegExp(`\\b${name}\\(`, 'g'))) {
      let depth = 1;
      let i = m.index + m[0].length;
      for (; i < source.length && depth > 0; i++) {
        if (source[i] === '(') depth++;
        else if (source[i] === ')') depth--;
      }
      out.push(source.slice(m.index + m[0].length, i - 1));
    }
    return out;
  };

  // Split an argument list on its TOP-LEVEL commas only, so a nested call or
  // object literal counts as one argument. Arity matters as much as presence:
  // `whenLabel(event, now, t)` ends in `, t` and would pass a "last arg is t"
  // check, but drops `t` into the `locale` slot — Intl.DateTimeFormat then
  // throws and the whole card list fails to render.
  const topLevelArgs = (args) => {
    if (args.trim() === '') return [];
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < args.length; i++) {
      const c = args[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      else if (c === ',' && depth === 0) { out.push(args.slice(start, i)); start = i + 1; }
    }
    out.push(args.slice(start));
    return out.map((a) => a.trim());
  };

  const offenders = [];
  // name → how many arguments the call must have for `t` to land in the right slot.
  for (const [name, arity] of [['trainCardHtml', 2], ['whenLabel', 4]]) {
    for (const args of argsOf(page, name)) {
      const parts = topLevelArgs(args);
      if (parts.length !== arity || parts[arity - 1] !== 't') {
        offenders.push(`${name}(${args.slice(0, 50)}…) — ${parts.length} args, want ${arity} ending in t`);
      }
    }
    // A bare reference (`.map(trainCardHtml)`) has no argument list to inspect,
    // so it would slip past argsOf entirely. Outside the import, every mention
    // must be a call.
    const body = page.replace(/^\s*import[\s\S]*?;\s*$/gm, '');
    for (const m of body.matchAll(new RegExp(`\\b${name}\\b(?!\\s*\\()`, 'g'))) {
      offenders.push(`${name} referenced without calling it (index ${m.index})`);
    }
  }
  assert.ok(argsOf(page, 'trainCardHtml').length >= 3, 'the page renders train cards');
  // mountSettingsForm / createPreviewFrame take it as an option.
  for (const name of ['mountSettingsForm', 'createPreviewFrame']) {
    const calls = [...page.matchAll(new RegExp(`\\b${name}\\(\\{([\\s\\S]*?)\\}\\)`, 'g'))];
    assert.ok(calls.length > 0, `${name} is called by the page`);
    for (const m of calls) if (!/\bt:/.test(m[1])) offenders.push(`${name}: missing t`);
  }
  assert.deepEqual(offenders, [], 'a render call would paint raw message keys');
});
