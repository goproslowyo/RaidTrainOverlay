# Authoring a Theme

RaidTrainOverlay draws a raid train across the screen: a **locomotive** (the
organiser, who conducts the train) and a **coach** per slot, all rolling over a
stationary **track**. A **Theme** decides what all of that looks
like — Classic Americana, Synthwave, a vintage ticket, pixel art. This guide walks
you through building your own.

You write **one self-contained module**. The app gives you a live view-model of the
train and a few shared helpers; you return the art. No build step, no framework — plain
ES modules and the DOM. If you can write SVG or HTML/CSS, you can write a Theme.

> **Golden path:** copy [`src/themes/starter/`](../src/themes/starter/index.js), rename
> it, and reshape the art. The starter is a complete, commented SVG Theme (and it
> bundles its own image asset). Everything below explains what it does.

---

## 1. Quick start

```
1. cp -r src/themes/starter src/themes/aurora        # pick your key: "aurora"
2. edit src/themes/aurora/index.js                   # change the key + the art
3. register it (section 8) so it's selectable
4. preview it (section 7):
     test/manual/harness.html#theme=aurora
```

A Theme can be a **single file** `src/themes/<key>.js`, or — if it ships its own
image files — a **folder** `src/themes/<key>/index.js` + `assets/` (see section 6).
Both register identically.

---

## 2. The contract

Your module's `default` export is the Theme: an object with a **key** and three
functions.

```js
export default { key, ensureStyles, build, buildTrack, foot };
```

| Member | Required | What it does |
|---|---|---|
| `key` | ✅ | The Theme's id. Must match its registry slot (section 8) — the config enum derives from the registry, so there is no second list to keep it in step with. |
| `ensureStyles(doc)` | ✅ | Inject the Theme's CSS once into `doc` (guard by a style-id so re-renders don't duplicate it). |
| `build(train, opts)` | ✅ | Build the train art once out of `opts.doc` (never the global `document`); return a **handle** `{ node, update, afterAttach }`. |
| `foot` | ✅ | The Theme's **baseline** — where its floor sits, as a fraction of the train height, or a function of `{ maxTimeLines }` when the box height is content-driven (section 5). Omitting it falls back to `1` (the pre-baseline behaviour), which is a silent per-Theme drift — every shipped Theme declares one. |
| `buildTrack(opts)` | optional | Return the stationary rail/ground the train rolls over, built out of `opts.doc`, or omit it. |

### Take your Document from the caller, never the global

Every element and every stylesheet a Theme creates comes out of the **Document the
renderer hands it** — `ensureStyles(doc)`, and `opts.doc` in `build` and `buildTrack`:

```js
export function ensureStyles(doc) { … doc.createElement('style') … doc.head.appendChild(style); }
export function build(train, opts = {}) { const { doc } = opts; … doc.createElement('div') … }
export function buildTrack({ doc }) { … doc.createElement('div') … }
```

`renderTrain` resolves it once from the mount (`container.ownerDocument`), so a train
mounts into any document — the overlay page, a preview `iframe`, a constructed
`Document` in a test — and the whole train lands in one place. Reach for the global
`document` in even one of the three and that Theme *splits*: the stage in the mount, its
art and stylesheet in whatever page happens to be global. Nothing errors; it just
silently doesn't paint. The same applies after attach — anywhere you need a `Document`
or a `Window` later (a tick handler rewriting `<tspan>`s, say), take it from an element
you already hold: `el.ownerDocument`, `el.ownerDocument.defaultView`.

`opts` is `{ doc, config, maxTimeLines }`; `buildTrack` gets the same object.

### `build` returns a handle

```js
build(train, opts) {
  // ...create the DOM/SVG for the whole train...
  return {
    node,                 // the root element the renderer attaches
    update(nextTrain) {}, // re-style state IN PLACE on a tick (never rebuild)
    afterAttach() {},     // runs once node is in the document
  };
}
```

- **`node`** — one root element (an `<svg>`, or a `<div>` for HTML/canvas Themes).
- **`update(nextTrain)`** — called on the renderer's ~30s tick. **Toggle classes and
  rewrite text only**; never rebuild the DOM, or you'll restart the running marquee and
  ambient animations. (The renderer also calls this on every marquee copy.)
- **`afterAttach()`** — called once the node is in the document. Do measurement-dependent
  work here: fit the names (`fitAll`) and start the per-Car undulation (`undulate`).

---

## 3. The view-model

`toVehicles(train)` (from `shared-svg.js`) flattens the live train into a plain array
you draw from. The shape per vehicle:

```js
{
  kind: 'engine' | 'open' | 'caboose' | 'car',
  name, image,            // broadcaster display name + avatar URL (image may 404 — fall back)
  slotOrder,              // the slot's position (coaches); the engine is tracked separately
  isCurrent, isSpotlit,   // live states (see section 4)
  isDeparted, isDimmed,   // departed = this slot is over; isDimmed = the whole Event is over
  isOpen, isCaboose,
  timeLines,              // ['in 30m'] or stacked absolute times for multi-zone
  organiser,              // on the engine only: a vestigial fallback, always null in practice (the organiser drives the loco)
}
```

Conventions to honour:

- **`vehicles[0]` is the locomotive — the *organiser*, who conducts the train**.
  The organiser has no slot of their own, so the loco carries **no** live state — no
  NOW marker, no departed, no spotlight. It simply leads the train and dims only on
  `isDimmed` (the Event is over). Every booked streamer is a **coach**: the first
  streamer rides the first coach and kicks off the train, and the NOW marker rides
  whichever coach is currently live.
- **The loco shows the organiser directly** — there is no separate tender car.
  `engine.organiser` is a vestigial fallback (it once credited the organiser on a
  tender when they weren't driving) and is **always null in practice**, since the
  organiser always drives the loco. Themes do **not** draw a tender; if you read
  `engine.organiser` at all, treat it purely defensively.
- **`buildTrack` paints only the rail/ground**, full canvas width, behind the train.

---

## 4. State & live updates

The renderer toggles three **shared state classes** on each `.rt-car` so the states
coexist and a tick re-styles them in place — your CSS reacts to them:

| Class | Meaning | Typical treatment |
|---|---|---|
| `.rt-car--current` | live right now | reveal the **NOW marker**; a warm glow |
| `.rt-car--spotlit` | organiser's pick (`spotlight=` param) | a cyan accent glow (coexists with current) |
| `.rt-car--departed` | this slot is over | a **light** dim + a **PLAYED** stamp |

Two always-in-the-DOM hooks the base CSS drives for you:

- **`.rt-pointer`** — hidden by default, revealed on `.rt-car--current`. Put your NOW
  marker inside it (the starter uses the shared `pointerSVG`). Add `.rt-now-bob` to make
  it bob.
- **`.rt-wheel`, `.rt-smoke`** — the base CSS spins/puffs these; just emit the markup.

> **Departed must stay readable.** Viewer feedback: don't bury a played slot under heavy
> shade. Keep the avatar/name legible (raise opacity, lighten desaturation) and say
> "done" with a clear **PLAYED** stamp, not darkness.

In `update(nextTrain)`, toggle the classes from the next train's state and rewrite any
time text — see the starter's `update`.

### Localized words (don't hardcode English)

The words your Theme paints — **NOW**, **OPEN**, **sign up!**, **PLAYED**, the organiser
credit, the departures statuses — are translated. Read them through a translator instead
of writing the literal: import `themeT` from `shared-svg.js`, bind it at the top of
`build(train, opts)`, and look up the catalog key:

```js
import { themeT } from './shared-svg.js';
let L = themeT();                       // English fallback until build runs
export function build(train, opts = {}) {
  const { doc } = opts;                 // the mount's Document — never the global one
  L = themeT(opts);                     // opts.config.t, set by the overlay shell
  // …`>${esc(L('overlay.played'))}</text>`  instead of  `>PLAYED</text>`
}
```

Keys live in `src/i18n/locales/en.js`: `overlay.now` / `overlay.open` / `overlay.signUp`
/ `overlay.played` / `overlay.conductor` / `overlay.organisedBy` / `overlay.staff`,
`status.{onTime,boarding,departed,lead}`, `departures.header`. (`NOW` and the open-slot
name already arrive localized in the view model's `timeLines` / `name`.) Keep badge words
**short** — they sit on fixed-width cars. The starter Theme shows the pattern.

---

## 5. Motion, sizing & media

### Ambient motion (you get it for free)

Every `.rt-car` undulates — a gentle side-to-side **sway + a small rock about the wheel
line** (never a vertical bob; a train rides the rails). Call `undulate(node)` in
`afterAttach()` and it's done: each Car gets a stable, organic, per-Car variation.
Spinning wheels and smoke come from `.rt-wheel`/`.rt-smoke`. All of it is
compositor-only and disables under `prefers-reduced-motion`.

**Ride character (`--rt-ride`)** — a per-Theme convention (not a contract field): declare
`--rt-ride: <n>` on your Theme's root to scale how loosely it rides. `1` is the default;
`tron`/`bullet` ride tight (`0.35`/`0.45`), `comic`/`departures` ride loose
(`1.25`/`1.2`), and `pixel` declares `0` (its motion is a deliberately stepped bob
instead). `undulate()` reads it automatically.

**Skipping undulate is allowed — for a reason.** `highvibes` deliberately never calls
`undulate()`: its per-plant art is dense enough that the per-Car sway forced a
main-thread SVG re-raster, so it ships its own compositor-only leaf drift instead
(the module's comments explain the trade). If your Theme's ambient motion replaces
the sway rather than adding to it, that is fine — but keep it compositor-only and
say why in a comment.

### Sizing — three media, three strategies

The renderer sizes your Theme to the train height (`--rt-th`, which already folds in the
`scale` param). Pick the medium that fits your art:

| Medium | How it scales | Reference Theme |
|---|---|---|
| **SVG** (golden path) | A `viewBox` scales for free — no unit math. | [`classic`](../src/themes/classic.js), the [starter](../src/themes/starter/index.js) — and most of the roster |
| **HTML/CSS** | No intrinsic ratio — size via the **`--u` token**: `--u: calc(var(--rt-th) / <design-height>)`, then every length is `calc(N * var(--u))` (don't use `em` or `transform: scale`). Reuse `shared-html.js`. | [`wood`](../src/themes/wood.js); also [`departures`](../src/themes/departures.js), [`ticket`](../src/themes/ticket.js) |
| **canvas** | A `<canvas>` has an intrinsic ratio (its backing store), so it scales like SVG; draw the ambient motion in a redraw loop that self-terminates on `canvas.isConnected`. | none shipped — the pre-redesign `pixel` was canvas; today's [`pixel`](../src/themes/pixel.js) is SVG |

**Start with SVG** unless you specifically need HTML layout or a pixel buffer.

### The baseline (`foot`) — where your floor sits

Sizing tells the renderer how **tall** your art is. `foot` tells it where the art's
**floor** is. Almost no Theme's art ends exactly at the bottom of its box: an SVG
viewBox usually keeps a few units of slack under the wheels, and an HTML Car can
overhang its holder. If the renderer positioned the train by its box, the `height`
param would mean a different thing on every Theme — which is exactly the drift that
made owners nudge `height` per Theme before this existed.

So declare it: **the fraction of the train height, measured down from the top of your
box, at which your floor sits.**

```js
const VIEW_H = 220;                       // your viewBox height
const railY = 168;                        // your wheel line
export const foot = (railY + 12 + 16) / VIEW_H;   // wheels: cy = railY + 12, r = 16
```

The renderer drops the train until *that* line reaches the bottom edge at
`height=100`, so every Theme bottoms out identically and a Preset needs no per-Theme
compensation. Rules of thumb:

- **Write it from your own art constants**, not as a magic decimal — then it stays
  right when you move the art. HTML Themes express it in the same design units as
  `--u` (`export const foot = (DESIGN_H - 3) / DESIGN_H`).
- **Measure the lowest *resting* art** — wheels, a ground shadow, or a name/time line
  that hangs below them. It may exceed `1` if your art overhangs its box; that is fine
  and is the point (the pre-redesign departures board slung its bogies below the box —
  today's roster happens to top out at exactly `1`, but the contract test sanity-bounds
  it at `1.5`).
- **Ignore effects that bleed on purpose**: smoke, glows, the NOW marker, a departed
  stamp, a live-only burst. They come and go with state, and a baseline that moved
  with the live car would be worse than no baseline at all.
- **If your box height is content-driven, declare a function, not a constant.** A
  fixed-`viewBox` SVG Theme always has the same floor, but an HTML Theme whose card
  grows with its content does not: such a Theme exports `foot` as
  `({ maxTimeLines }) => …` and the renderer evaluates it per render. No roster Theme
  currently needs this (the pre-redesign synthwave stacked one time line per `tz` zone
  inside its card, so three zones pushed its floor 40px further down; its outrun
  redesign is fixed-height SVG) — but the renderer still resolves both forms and the
  contract test in [`test/train-renderer.test.js`](../test/train-renderer.test.js)
  keeps the function path exercised. If you use it, pin any line box the formula
  counts (`line-height` in `--u`) so the arithmetic is exact rather than a platform
  font metric.
- **Usually the Train, occasionally the Track.** Take the floor from the train's own
  art. Take it from `buildTrack` only when the track paints the physical ground the
  train *rests on* and that ground reads as the floor — `jazz` (the wood console the
  records sit on) is the Theme that does, and says so in a comment. (`lava` used to;
  its river redesign has no lamp furniture, so its floor is now its own time-caption
  ink.) Decorative bands that merely run downward — tie strips, receding grids,
  translucent backing — are scenery and are allowed to bleed off the bottom edge.

---

## 6. Bringing your own art (PNG · JPG · SVG · WebP)

Every shipped Theme draws procedurally, but you can **bundle image files** and paint them
per-element. The starter does this — its locomotive wears
[`assets/badge.svg`](../src/themes/starter/assets/badge.svg).

**Use the folder form and resolve against the module URL:**

```
src/themes/<key>/
  index.js
  assets/
    plank.png
```

```js
// in index.js — resolves against THIS module's deployed location, so it's correct
// under the GitHub-Pages project subpath (/RaidTrainOverlay/) with NO build step:
const PLANK = new URL('./assets/plank.png', import.meta.url).href;
// ...then use it like any URL: <image href="${PLANK}">, background-image, drawImage.
```

The rules:

- **Per-element only.** An image may texture a Car body, a plate, a sprite — it may
  **never** span the whole canvas or sit behind the train. A raster is just another
  per-element fill.
- **Author for transparency.** The stream is transparent, so non-rectangular art needs an
  **alpha channel** — prefer **PNG / WebP / SVG**. A **JPG has no alpha** and paints an
  opaque box; use it only for genuinely rectangular fills. Nothing validates this at
  runtime, so **verify by previewing over a busy background** (next section).
- **Author for scale.** The train scales up; prefer **vector** (SVG/CSS) for line art, and
  author raster textures for the **largest expected height**.
- **Bundled beats remote.** In-repo assets keep the Overlay self-contained and offline-safe.
  A remote URL still works but invites link-rot and canvas-taint.

A tiny icon can instead inline as a `data:` URI to stay single-file.

---

## 7. Verify your Theme

Verification is **headless/visual** — there are no unit tests for the art. Use the manual
harness, which feeds the real renderer a fixture event and a fake clock:

```
test/manual/harness.html#theme=<key>
```

Drive it with hash params (full list in the file's header comment):

| Goal | URL |
|---|---|
| Pre-event / live / post-event | `#now=2026-06-16T17:00:00Z` · `…T20:30:00Z` · `…T22:00:00Z` |
| Watch the NOW marker advance | `#now=2026-06-16T20:59:30Z&clockRate=60` |
| Spotlight (coexists with NOW) | `#spotlight=DJ Charlie` |
| Open slots | `#openslots=1` |
| 20+ Car perf / the Modes | `#cars=24&mode=marquee&speed=2` |
| **Transparency / asset alpha** | `#theme=<key>&bg=checker` |
| Multi-zone times | `#tz=PT,ET,GMT` |

Check that: names never truncate (they shrink to fit), the NOW + spotlight glows read
without lag at 20+ Cars, a departed slot stays legible with its PLAYED stamp, and — over
`bg=checker` — nothing paints an opaque rectangle where you wanted transparency.

---

## 8. Register it

In JS, a Theme is declared **once**: add a line to `THEME_LOADERS` in
**`src/themes/registry.js`**.

```js
mytheme: () => import('./mytheme.js'),        // a single-file Theme
mytheme: () => import('./mytheme/index.js'),  // a Theme that bundles its own assets
```

It is an `import()` **thunk**, not a static `import`, and that matters. `src/config.js`
and `src/settings-schema.js` import this registry for the roster's *keys* — the `theme`
enum and the Configurator's option labels. While the Themes were static imports, asking
for sixteen strings pulled sixteen Themes' worth of art down the wire: a measured
**+127 KB** on a cold Configurator load, art those pages never paint
([the measurement](research/theme-registry-page-cost.md)). Now the art arrives only when
something is about to paint with it, and the **Overlay in OBS downloads one Theme
instead of sixteen**.

Write the specifier out in full, as above. A bare `import()` of a template string is not
statically analysable, so nothing — a future build step, or a human grepping for who uses
a Theme file — could find it. `test/theme-registry.test.js` fails if a static Theme import
creeps back in, and if any key is not a full, greppable specifier.

The enum and the label map both still derive from this one literal, so a key cannot be
selectable in one place and unknown to the other. (The starter is registered here too and
filtered back out of the roster — it's an authoring reference, not a roster Theme.)

**If you render a Train yourself** — a harness, a test, a gallery — load the art first:
`await loadTheme(key)`, or `await loadAllThemes()` for the whole roster. `resolveTheme`
and `renderTrain` stay synchronous on purpose (a render must be one indivisible turn, or
it can wipe an **Upcoming card** that went up mid-flight), so a roster key whose art has
not arrived **throws** rather than quietly painting `classic`.

Two things are still written by hand, because the site has no build step:

- its **name**, under `configurator.theme.<key>`, in each of the 11 catalogs
  (`src/i18n/locales/`). Translation is not drift.
- its **swatch** in `configurator.html` and its **chip** in `preview.html`.
  [`test/theme-registry.test.js`](../test/theme-registry.test.js) goes red if either page
  is missing a roster key, so a forgotten one is a failing build rather than a Theme
  nobody can find.

Unknown keys — a stale URL naming a Theme that no longer exists — still fall back to
`classic`, so a half-registered Theme degrades gracefully rather than blanking the
Overlay. That tolerance is for keys the roster does *not* know; a key it knows but whose
art nobody loaded is a caller bug, and is loud.

---

## The rules, in one place

- **Paint only the train** — Cars, the loco, and the rail via `buildTrack`.
  Never a full-canvas backdrop. The stream is transparent.
- **Glow over a *static* group** — put Now/Spotlight glows (CSS `drop-shadow`) on a static
  element, with wheels/smoke in a sibling layer. A filter over an animating subtree
  re-rasterises every frame and tanks performance. The one deliberate exception is
  `lava`: its metaball `#goo` and hue-rotate cycle are two per-frame filters over a
  *single* shared field layer (one raster for the whole train, not one per Car), and
  the module's header documents the trade and the OBS-test obligation. Every other
  Theme's filters are *static* — a glow rastered once and cached, with everything that
  animates (wheels, beams, light trails) in an unfiltered sibling layer — so no filter
  re-computes per frame; don't add a second per-frame exception without the same
  justification.
- **Undulate is sway + rock, not a bob** — and it's free via `undulate()`. Keep added
  motion compositor-only and reduced-motion-safe.
- **Declare your baseline** — `foot`, the fraction of the train height at which your
  floor sits, written from your own art constants. Without it the Theme rides at its
  own private `height` offset and users have to nudge it per Theme.
- **Never truncate a name** — mark names `.rt-fit` and call `fitAll()` in `afterAttach`.
- **Survive a 404 avatar** — paint initials first, the image over them, so a failed CDN
  load shows initials, not a hole (the shared `avatarSVG` / `htmlAvatar` do this).
- **The loco is the organiser** — it has no slot, so no NOW/departed/spotlight; dim only post-event.

Reference Themes: [`classic`](../src/themes/classic.js) (SVG, the bar),
[`wood`](../src/themes/wood.js) (HTML/`--u`), and the
[starter](../src/themes/starter/index.js) (golden path + a bundled asset). The glossary
and core concepts live in [`CONTEXT.md`](../CONTEXT.md).
