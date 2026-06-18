import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalLocale,
  resolveLocale,
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
