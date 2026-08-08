# Translating RaidTrainOverlay

The overlay speaks 10 languages. The current non-English catalogs are
**machine translations, hardened by an automated review pass but not yet
confirmed by a native speaker** — so if a word reads wrong to you, you are
exactly the person we need. Fixing one is a two-minute edit.

> You don't translate from a blank page — every string already has a draft you
> just *correct*, plus a one-line note saying what it means and where it shows.

## Where the strings live

```
src/i18n/locales/
  en.js          ← source of truth (every key, in English). Don't translate this.
  es.js          ← neutral Spanish base
  es-ES.js        es-MX.js     ← thin Spain / Mexico overrides (only divergent keys)
  pt-BR.js  it.js  de.js  nl.js  da.js  lt.js  fr.js
src/i18n/context.js   ← what every key MEANS, the glossary, and badge length limits
```

Each locale file is a plain ES module:

```js
export default {
  'overlay.now': 'JETZT',
  'overlay.open': 'FREI',
  // …
};
```

A locale only needs the keys it changes — anything missing falls back to English
automatically, so the overlay is never broken or blank.

## Fix or improve a language (the 2-minute path)

1. Open `src/i18n/locales/<your-locale>.js`.
2. Find the key (e.g. `'overlay.played'`) and correct its value.
3. Check what it means in `src/i18n/context.js` (`DESCRIPTIONS['overlay.played']`)
   — it tells you the word sense and where it appears.
4. **See it live** (no build step — just open the file in a browser, or
   `python3 -m http.server` and visit):
   - On-stream overlay: `overlay.html?event=demo&lang=<locale>&theme=departures`
   - The render harness (forces every state): `test/manual/harness.html#now=2026-06-16T19:30:00Z&openslots=1&lang=<locale>&theme=departures`
   - The configurator / landing UI: `configurator.html?lang=<locale>` · `index.html?lang=<locale>`
5. Open a pull request. CI checks it for you (see below).

## The five rules

1. **Keep the keys.** Translate the value, never the key on the left.
2. **Keep `{tokens}` verbatim** — `{slug}`, `{name}`, `{zones}`, `{mins}`, `{v}`
   are filled in at runtime. `'Saved "{name}".'` → `'"{name}" gespeichert.'`
3. **Keep HTML and links verbatim** — translate only the visible text between
   tags. `<strong>`, `<a href="…">`, `<code>`, `<br>`, entities, and URLs stay.
4. **Keep the badges short.** The words painted on the train cars (`overlay.*`,
   `status.*`, `departures.header`) sit on fixed-width cars. `context.js`
   `BADGE_BUDGET` lists the character budget for each — shorter is safer.
5. **Keep emoji/glyphs** — `🔀 ✓ ✗ … ❤️` stay as-is.

Tone is casual streamer-speak: address the viewer informally (du / tu / tú / je),
not formally.

## Validate before you PR

```bash
node --test                 # hard checks: every key present, {tokens} + HTML intact, files parse
node test/i18n-lint.mjs     # advisory: badge overflow, leftover English, diacritics, fr spacing
```

CI runs both on every pull request, so a structural mistake is caught
automatically — you can't accidentally break the build.

## Add a brand-new language

1. Create `src/i18n/locales/<bcp47>.js` (copy `en.js`, translate the values).
2. Register it in `src/i18n/index.js`: add the code to `SUPPORTED_LOCALES` and a
   `LOADERS` entry; add a base-language fallback in `BASE_DEFAULT` if it has regions.
3. Add an `<option>` to the language selector in `configurator.html`.
4. `node --test` — the completeness test will tell you if you missed a key.

## Don't want to touch code? Just tell us

You do not have to open a pull request. If a word reads wrong in your language,
[**open an issue**](https://github.com/goproslowyo/RaidTrainOverlay/issues/new)
and say so in your own words — which language, roughly where you saw it, and what
it should say instead. That is enough. Screenshots help; a perfect bug report is
not required.

There is no translation platform to sign up for, no account, and no invite to
wait on. The catalogs live in this repo in plain text, the site is served from
this repo, and a one-line correction from someone who actually speaks the
language is worth more than another round of machine translation.

Thank you — every corrected word makes someone's stream feel like it was built for
them.
