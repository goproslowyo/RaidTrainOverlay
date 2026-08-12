/**
 * The Theme roster: the one place a Theme is declared. Everything else derives.
 *
 * A Theme registers the same way whether it is a single file (./<key>.js) or a
 * folder that bundles its own assets (./<key>/index.js) — both are ES modules
 * with a default export. `starter` is the folder form: the authoring-guide
 * reference Theme (docs/authoring-a-theme.md), which bundles badge.svg and
 * resolves it via import.meta.url (subpath-safe, no build step).
 *
 * The roster used to be written out three times in JS — the renderer's map,
 * config's enum, and settings-schema's option keys — and nothing held the
 * copies to each other. The failure mode was silent: `resolveTheme` fell back
 * to classic for any key it did not know, so a Theme added to the enum but
 * missed in the map was selectable in the Configurator, survived parseConfig
 * intact, shipped inside a copied OBS browser source, and painted classic with
 * nothing anywhere saying why. Deriving the enum from the loaders below makes
 * that unrepresentable: a Theme in the registry is in the enum, by construction.
 *
 * ## Loading is separated from resolving
 *
 * The declarations are `import()` THUNKS rather than static imports, and that is
 * the whole of #89. `config.js` and `settings-schema.js` import this module for
 * the roster's KEYS — the `theme` param's enum, the Configurator's option
 * labels. With static imports, asking for sixteen strings pulled sixteen
 * Themes' worth of art through the wire: measured at **+127 KB** on a cold
 * Configurator load, art those pages never paint. `overlay.html` paid it too,
 * downloading all sixteen to paint one.
 *
 * The thunks are still ONE literal, so the drift class #70 closed stays closed —
 * the enum is still derived, not restated. What changed is that the art arrives
 * when someone asks for it, which is `loadTheme`'s job and the caller's moment
 * to choose. `resolveTheme` and `renderTrain` stay **synchronous** (see the note
 * on stale paints in train-renderer.js and overlay-shell.js): the network is the
 * only async thing here, and it is confined to this file.
 *
 * The measured cost of NOT doing this, and the cross-validated byte counts, are
 * in docs/research/theme-registry-page-cost.md.
 */

/**
 * Every renderable Theme, by the key `config.theme` selects it with → a thunk
 * that fetches its module.
 *
 * The specifiers are written out in full and statically: a bare `import()` of a
 * template string is not analysable, so a bundler or a future build step could
 * not find them, and neither can a human grepping for who uses a Theme file.
 * test/theme-registry.test.js fails this file if a STATIC theme import creeps
 * back in — that is the one guard the whole change rests on.
 */
export const THEME_LOADERS = {
  classic: () => import('./classic.js'),
  flat: () => import('./flat.js'),
  synthwave: () => import('./synthwave.js'),
  ticket: () => import('./ticket.js'),
  wood: () => import('./wood.js'),
  comic: () => import('./comic.js'),
  departures: () => import('./departures.js'),
  paper: () => import('./paper.js'),
  tron: () => import('./tron.js'),
  pixel: () => import('./pixel.js'),
  highvibes: () => import('./highvibes.js'),
  jazz: () => import('./jazz.js'),
  bullet: () => import('./bullet.js'),
  lava: () => import('./lava.js'),
  pride: () => import('./pride.js'),
  starter: () => import('./starter/index.js'),
};

/** Every roster key, in declaration order. */
export const THEME_ROSTER = Object.keys(THEME_LOADERS);

/** The roster offered for selection + `theme=shuffle` cycling — every Theme
 *  except `starter`, which stays registered (renderable via the manual harness
 *  #theme=starter) but out of the user-facing enum: it is the authoring
 *  reference, not a roster Theme. */
export const SHIPPED_THEMES = THEME_ROSTER.filter((key) => key !== 'starter');

/** The `theme` param's enum: the roster, plus `shuffle` — not a look but an
 *  instruction to cycle the whole roster, which the Overlay resolves to a real
 *  Theme before anything paints. */
export const THEME_KEYS = [...SHIPPED_THEMES, 'shuffle'];

/** A Theme key → the catalog key its Configurator label lives under. */
export const optionKeyFor = (key) => `configurator.theme.${key}`;

/**
 * The art, as far as anyone has asked for it: key → Theme module, filled in by
 * `loadTheme`. Empty until something renders, which is the whole point — a page
 * that wants the roster's KEYS reads `THEME_LOADERS` above and never touches
 * this, so it never pulls a byte of art.
 */
export const THEMES = {};

/**
 * Which slot a key lands in. An unknown key resolves to `classic`, mirroring the
 * tolerance `resolveTheme` has always had: asking for a Theme that does not
 * exist gets you the fallback, never an error.
 */
const slotFor = (key) => (THEME_LOADERS[key] ? key : 'classic');

/** Has this Theme's art arrived? The question a caller asks before rendering. */
export const isThemeLoaded = (key) => Object.hasOwn(THEMES, slotFor(key));

/** Imports in flight, so the same key asked for twice shares one request. */
const inFlight = new Map();

/**
 * Fetch a Theme's art and register it. Idempotent and concurrency-safe.
 * Rejects only if the module itself fails to load — a network fault, which
 * the caller decides what to do about (the Overlay logs it and leaves the
 * Stage alone; an OBS source must never show half-torn-down UI).
 */
export function loadTheme(key) {
  const slot = slotFor(key);
  if (Object.hasOwn(THEMES, slot)) return Promise.resolve(THEMES[slot]);
  let pending = inFlight.get(slot);
  if (!pending) {
    pending = THEME_LOADERS[slot]().then((mod) => {
      THEMES[slot] = mod.default;
      inFlight.delete(slot);
      return mod.default;
    }, (err) => {
      // A failed import must not poison the slot: a later attempt should be
      // able to retry, which it cannot if the rejected promise stays cached.
      inFlight.delete(slot);
      throw err;
    });
    inFlight.set(slot, pending);
  }
  return pending;
}

/**
 * Every Theme at once — the roster sweep the suites and the manual gallery
 * want, and the one call that restores the old "everything is already here"
 * world for a caller that genuinely needs it.
 */
export const loadAllThemes = () => Promise.all(THEME_ROSTER.map(loadTheme));
