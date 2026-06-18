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
export default { key, ensureStyles, build, buildTrack };
```

| Member | Required | What it does |
|---|---|---|
| `key` | ✅ | The Theme's id. Must match its registry slot and the config enum (section 8). |
| `ensureStyles()` | ✅ | Inject the Theme's CSS once (guard by a style-id so re-renders don't duplicate it). |
| `build(train, opts)` | ✅ | Build the train art once; return a **handle** `{ node, update, afterAttach }`. |
| `buildTrack(opts)` | optional | Return the stationary rail/ground the train rolls over, or omit it. |

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
`tron`/`departures` ride tight (`~0.6–0.7`), `wood`/`comic` ride loose (`~1.25–1.35`).
`undulate()` reads it automatically.

### Sizing — three media, three strategies

The renderer sizes your Theme to the train height (`--rt-th`, which already folds in the
`scale` param). Pick the medium that fits your art:

| Medium | How it scales | Reference Theme |
|---|---|---|
| **SVG** (golden path) | A `viewBox` scales for free — no unit math. | [`classic`](../src/themes/classic.js), the [starter](../src/themes/starter/index.js) |
| **HTML/CSS** | No intrinsic ratio — size via the **`--u` token**: `--u: calc(var(--rt-th) / <design-height>)`, then every length is `calc(N * var(--u))` (don't use `em` or `transform: scale`). Reuse `shared-html.js`. | [`synthwave`](../src/themes/synthwave.js) |
| **canvas** | A `<canvas>` has an intrinsic ratio (its backing store), so it scales like SVG; draw the ambient motion in a redraw loop that self-terminates on `canvas.isConnected`. | [`pixel`](../src/themes/pixel.js) |

**Start with SVG** unless you specifically need HTML layout or a pixel buffer.

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

To make a Theme selectable, add its key in **three** files (the starter is registered in
the first one only — it's an authoring reference, not a roster Theme):

1. **`src/train-renderer.js`** — `import` it and add it to the `THEMES` map.
2. **`src/config.js`** — add the key to the `theme` enum (the `oneOf([...])` list).
3. **`configurator.html`** — add an `<option value="<key>">Your Label</option>` to the
   theme `<select>`, and add the key to the validation array that guards `els.theme.value`.

Unknown keys fall back to `classic`, so a half-registered Theme degrades gracefully rather
than blanking the Overlay.

---

## The rules, in one place

- **Paint only the train** — Cars, the loco, and the rail via `buildTrack`.
  Never a full-canvas backdrop. The stream is transparent.
- **Glow over a *static* group** — put Now/Spotlight glows (CSS `drop-shadow`) on a static
  element, with wheels/smoke in a sibling layer. A filter over an animating subtree
  re-rasterises every frame and tanks performance.
- **Undulate is sway + rock, not a bob** — and it's free via `undulate()`. Keep added
  motion compositor-only and reduced-motion-safe.
- **Never truncate a name** — mark names `.rt-fit` and call `fitAll()` in `afterAttach`.
- **Survive a 404 avatar** — paint initials first, the image over them, so a failed CDN
  load shows initials, not a hole (the shared `avatarSVG` / `htmlAvatar` do this).
- **The loco is the organiser** — it has no slot, so no NOW/departed/spotlight; dim only post-event.

Reference Themes: [`classic`](../src/themes/classic.js) (SVG, the bar),
[`synthwave`](../src/themes/synthwave.js) (HTML/`--u`), [`pixel`](../src/themes/pixel.js)
(canvas), and the [starter](../src/themes/starter/index.js) (golden path + a bundled
asset). The glossary and core concepts live in [`CONTEXT.md`](../CONTEXT.md).
