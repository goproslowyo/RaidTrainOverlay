# Changelog

All notable changes to RaidTrainOverlay are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/).

## [0.4.0] - 2026-06-18

Four "gold-standard" themes. The roster gains its most detailed scenes yet — a cannabis
garden, a jazz vinyl lounge, an anime bullet train, and a psychedelic lava lounge — each
with a full scene behind the train. Plus two long-standing overlay fixes that touch the
whole roster.

### Added
- **Four new themes** (in the Configurator's theme picker, each with a friendly alias):
  - **High Vibes** (`highvibes` / `smoke`) — leaf-forward potted cannabis plants with
    frosted avatar medallions, over a rolling-hill landscape with drifting leaves and
    rising spores.
  - **Jazz** (`jazz` / `coltrane`) — spinning Blue-Note vinyl on a warm club deck, each
    record's label an instrument matched to the player; chrome tonearm + floating notes on
    the live cut; the spotlit cut wears a ★ STAFF pick.
  - **Bullet** (`bullet` / `shinkansen`) — an anime art-train, each car wrapped in a
    different Japanese art style (the lead car always sakura), gliding over scene-wide
    rushing speed-lines with a power-up burst on the live car.
  - **Lava Lounge** (`lava` / `lavalamp`) — one continuous psychedelic lava river that
    churns, fuses and colour-blends across the whole train, with each broadcaster a glass
    bead floating in the wax.
  - Each paints a translucent lower-third "scene band" behind the train, so the scene
    reads over a live stream while the top of the frame stays see-through. All four are
    localized in the Configurator across the 10 supported languages.

### Fixed
- **The locomotive is no longer stamped "PLAYED."** The organiser drives the train and has
  no slot of their own, so the engine now simply dims once the event is over instead of
  also carrying a PLAYED stamp (which had been riding along on several themes). Fixed
  theme-agnostically in the renderer, plus in-module for the canvas-based pixel theme.
- **CONDUCTOR badge placement.** The lead badge now anchors to the locomotive's own body
  rather than a coach's roofline, fixing it floating too high (classic, comic, paper,
  bullet) or dropping onto the first car's sign (departures).

### Performance
- The new themes are filter-free except **Lava**, which deliberately keeps a per-frame
  metaball + hue-cycle ("ultra mode") for its colour-blend; the effect is a single shared
  layer to keep the cost bounded. Worth an OBS check before a long broadcast.

## [0.3.0] - 2026-06-17

Periodic track. The rails can now clear out between passes, so the overlay reclaims your
lower-third in the gaps.

### Added
- **Periodic track** (`track` param): `track=periodic` fades the rails out after each
  pass and back in just before the next one, so the overlay goes completely empty between
  passes instead of leaving the bare rails on screen. The default `track=always` keeps the
  rails up the whole time, exactly as before. Pass mode only — the Configurator exposes it
  under **Motion** and disables it for Marquee. The track fades (it never slides — the
  rails stay put), fully laid down before the train arrives and cleared after it leaves.
  Fade durations are configurable (`trackfadein` / `trackfadeout`, default 15s / 10s, also
  under **Motion**) and clamped so even short intervals keep a beat of true-empty. The rails
  also fade in on the very first roll (and for each shuffle theme) rather than popping in.

### Fixed
- **Pass mode**: the held-off-screen train is now hidden during the wait between passes,
  so the trailing car's ambient sway can no longer peek a sliver back onto the left edge.
  Most visible with `track=periodic`, where the overlay is otherwise empty.

## [0.2.0] - 2026-06-17

Localization. The overlay and configurator now speak 10 languages, and the time display
is locale-aware.

### Added
- **Languages** (`lang` param + a picker in the Configurator): English, Spanish
  (Spain & Mexico), Brazilian Portuguese, Italian, German, Dutch, Danish, Lithuanian,
  and French. The on-stream words (NOW, OPEN, PLAYED, departures statuses, the organiser
  credit) and the configurator/landing UI all localize; absent a `lang`, the browser's
  language is used. Any missing string falls back to English, so the overlay never breaks.
- **Locale-aware time**: relative times ("in 2h30m") localize their prefix and units, and
  with `tz` set the absolute clock follows the locale — 24-hour for European locales,
  12-hour for en/es-MX.
- **Translation tooling for contributors**: a `lang`-aware preview in every surface,
  per-string context + a glossary (`src/i18n/context.js`), a contributor guide
  ([`TRANSLATING.md`](TRANSLATING.md)), an advisory quality lint (`test/i18n-lint.mjs`)
  and CI that checks every locale has every key with placeholders/markup intact.

### Notes
- The non-English catalogs are machine translations hardened by an automated
  back-translation + native-reviewer pass; strings still wanting a native eye are listed
  in [`docs/i18n-review-notes.md`](docs/i18n-review-notes.md). Corrections welcome.

## [0.1.0] - 2026-06-16

First public cut: a RaidPal raid train rendered as an animated train of streamer cars
for an OBS browser source. Static hosting on GitHub Pages, no build step.

### Added
- **Overlay** (`overlay.html?event=<slug>`): a transparent OBS browser source that
  turns a RaidPal event into a rolling train. The organiser drives the locomotive (the
  conductor), every booked streamer is a coach, the NOW marker rides whoever is live,
  and departed slots get a PLAYED stamp.
- **Ten themes**: Classic Americana, Flat, Synthwave, Vintage Ticket, Wooden Toy,
  Comic, Departures Board, Construction Paper, Tron (lightcycles), and 16-bit Pixel,
  plus a **Shuffle** mode that cycles the whole roster.
- **Configurator** (`configurator.html`): a form that builds and copies the overlay
  URL, with a live framed preview (Roll, Freeze, Resume, Recenter), saved presets, and
  a shareable configurator link.
- **Preview page** (`preview.html`): a standalone showcase on the built-in demo
  lineup. Click any of the eleven theme chips to preview it and copy its overlay URL.
- **Built-in demo** (`event=demo`): a self-contained lineup that renders with no
  RaidPal fetch, so the preview and landing page always have something live-looking.
- **Display options**: train size and vertical position (always clamped on-canvas),
  Pass vs Marquee motion, animation speed, open-slot cars, hide-finished, broadcaster
  spotlight, multi-zone clock times, engine-dim behaviour, and auto-refresh.
- **Theme-authoring kit**: a documented contract plus a copy-paste `starter` theme
  (`docs/authoring-a-theme.md`), including per-theme bundled raster assets.
- A cache-first RaidPal client resilient to transient fetch failures, and a GitHub
  Pages landing page with a live deployed-commit stamp in the footer.

[0.4.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.4.0
[0.3.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.3.0
[0.2.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.2.0
[0.1.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.1.0
