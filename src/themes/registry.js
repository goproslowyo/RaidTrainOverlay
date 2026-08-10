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
 * copies to each other. The failure mode was silent: `resolveTheme` falls back
 * to classic for any key it does not know, so a Theme added to the enum but
 * missed in the map is selectable in the Configurator, survives parseConfig
 * intact, ships inside a copied OBS browser source, and paints classic with
 * nothing anywhere saying why. Deriving the enum from the map makes that
 * unrepresentable: a Theme in the registry is in the enum, by construction.
 */
import classic from './classic.js';
import flat from './flat.js';
import synthwave from './synthwave.js';
import ticket from './ticket.js';
import wood from './wood.js';
import comic from './comic.js';
import departures from './departures.js';
import paper from './paper.js';
import tron from './tron.js';
import pixel from './pixel.js';
import highvibes from './highvibes.js';
import jazz from './jazz.js';
import bullet from './bullet.js';
import lava from './lava.js';
import pride from './pride.js';
import starter from './starter/index.js';

/** Every renderable Theme, by the key `config.theme` selects it with. */
export const THEMES = { classic, flat, synthwave, ticket, wood, comic, departures, paper, tron, pixel, highvibes, jazz, bullet, lava, pride, starter };

/** The roster offered for selection + `theme=shuffle` cycling — every Theme
 *  except `starter`, which stays registered (renderable via the manual harness
 *  #theme=starter) but out of the user-facing enum: it is the authoring
 *  reference, not a roster Theme. */
export const SHIPPED_THEMES = Object.keys(THEMES).filter((key) => key !== 'starter');

/** The `theme` param's enum: the roster, plus `shuffle` — not a look but an
 *  instruction to cycle the whole roster, which the Overlay resolves to a real
 *  Theme before anything paints. */
export const THEME_KEYS = [...SHIPPED_THEMES, 'shuffle'];

/** A Theme key → the catalog key its Configurator label lives under. */
export const optionKeyFor = (key) => `configurator.theme.${key}`;
