# Changelog

All notable changes to RaidTrainOverlay are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

The Configurator grew up into two ages of one app. A first visit is a three-stop
journey — who's streaming, how it looks, put it on your stream — and every visit
after that is a single page with a **Simple / Everything** switch: Simple is five
decisions with a live preview, Everything is the full app you already know. The
whole product also moved to the redesign's warm **sodium** palette, landing page
included.

### Added
- **First-run setup.** Three stops to a working Live Link. Finishing (or
  skipping) is remembered per Profile, so the journey never reappears — it can
  be re-run any time from the top bar.
- **Simple view.** The five decisions that matter — theme, cadence, size, open
  slots, played cars — editing your default Preset directly, beside a live
  preview, your Live Link, and an illustrated 30-second OBS walk-through.
- **The idle card is now yours to place.** New Live Link settings for the
  between-trains card: a 9-position anchor in your scene (`uppos`), opacity
  (`upop`), how long each page holds (`upcycle`), and a one-line ticker
  footprint (`upstyle`, `upscroll`) for scenes with no room for a card. They
  are per-Profile — the idle state belongs to the Live Link, not to any single
  train — and ride the URL like every other setting. Its preview sits over a
  stand-in stream scene, full width, so placement and opacity actually read.
- **The idle card says when YOU play.** Each row shows your own slot time from
  the train's lineup (cache-first, polite one-shot lookups) rather than the
  train's departure — a UTC-afternoon European train no longer reads as a
  3 AM Pacific set. Every time names its zone (…11:00 PM PDT), keeps the dim
  UTC anchor, and falls back to the departure while a lineup is unknown. The
  Configurator preview mirrors the same rule.
- **The Configurator remembers Simple vs Everything** across visits.
- **An upcoming-trains link (`uponly`).** A second overlay URL for a separate
  OBS scene (starting soon, be right back): it always shows your upcoming
  trains — even while one is live — and never the train itself. Copy it from
  the Live Link page, which is now its own page in Everything instead of
  sitting on top of My Raid Trains.

### Changed
- **Sodium palette, app-wide.** The Configurator and landing page adopt the
  redesign's warm sodium tokens (shared via `assets/app.css`), replacing the
  blue/gold set. `preview.html` keeps its own palette, as before.
- **The overlay's idle card wears the same design the Configurator previews.**
  Amber mono departure times and label, a page counter, and a dim UTC anchor
  on every row and ticker entry (viewers are worldwide — local time alone
  says little), replacing the old plain white panel.
- **The idle card pages instead of sliding.** With 8 trains the old
  one-row-at-a-time window wrapped the list (`7, 8, 1`), so a chronological
  list stopped reading chronologically twice per lap. It now pages three at a
  time — every page chronological, the whole list shown per lap — holding each
  page 12s by default.

## [0.8.0] - 2026-08-08

RaidPal now knows who you are. Instead of building an overlay URL per event, you
save your Twitch username once and the Configurator shows **your** raid trains —
with a **Live Link** you paste into OBS a single time and never touch again: it
finds whichever train is running (or up next) and switches itself over. The rest
of the tool was rebuilt around that, and the whole interface is translated.

### Added
- **Profiles.** Save your Twitch username and the Configurator becomes yours: your
  raid trains, your settings, your spotlights. Stored in your browser — no account,
  no login, nothing sent anywhere. Switch between several to manage someone else's
  setup.
- **My Raid Trains.** The Configurator's home is now a list of the trains you have
  joined or organised, pulled from RaidPal, with the live one on top, upcoming ones
  next, and finished ones tucked behind an expander.
- **The Live Link.** One overlay URL, set in OBS once. It resolves the live-or-next
  train by itself, carries your settings in the URL, and switches trains unattended
  — including per-train tweaks, so one train can run a different theme without
  touching OBS. Between trains it can show a card listing what's coming up, or
  nothing at all.
- **Raid Train Configs.** Per-train settings that start from a preset and override
  only what you change, with a badge showing what differs. Each train also gets its
  own copyable static link.
- **Presets, reworked.** Presets are now settings only, shared across trains and
  renameable, with duplicate and a per-profile default.
- **Backup and restore.** Export everything you have saved as a single code, and
  paste it into another browser or machine.
- **Ten more languages.** The whole interface — Configurator, landing page and
  overlay — is translated into Spanish (neutral, Spain, Mexico), Brazilian
  Portuguese, Italian, German, Dutch, Danish, Lithuanian and French. Corrections
  from native speakers are very welcome; see [TRANSLATING.md](TRANSLATING.md).

### Changed
- **The Configurator is an app, not a form.** Sidebar navigation over My Raid
  Trains, a settings editor, a preset library and profile settings. Building a
  single overlay URL by hand is still there as the **One-off link**, for someone
  else's event or a lineup RaidPal has never heard of.
- **The landing page** was rebuilt on the same shell, leading with a live cycling
  example of the overlay instead of a wall of theme chips.
- **Every theme now bottoms out in the same place.** `height` used to drop each
  theme by its layout box rather than the ground its train stands on, so the same
  setting sat differently in every theme — an 85px spread. Themes now declare where
  their floor is, and the spread is under a pixel. You may want to re-check
  `height` once if you had compensated for this by hand.
- **Finished trains are "Ended", not "departed".** A train *departs* when it
  starts. Calling a finished one departed said the opposite of what it meant.

### Fixed
- **The overlay no longer renders unshrunk in an inactive OBS scene.** The
  post-layout pass waited for a frame that never arrives in a document nobody is
  painting, so a source in a background scene came up with names wrapped and
  cars unfitted.
- **A too-large Live Link is now visible instead of silent.** An overlong link
  used to quietly drop *every* per-train setting with no warning anywhere. The
  Configurator now says so before you copy it, and the overlay says so in the
  console. Links are never silently trimmed — that would drop some trains and
  keep others.
- **Old raid trains clean themselves up.** Settings for trains that have ended and
  left your RaidPal schedule are removed, with a notice and a **Keep them** undo.
  Several guards stop this touching a train that was merely renamed or a day
  RaidPal was unreachable.
- **A bad moment at RaidPal no longer looks like "you have no profile".** When
  RaidPal is down and Cloudflare answers with an error page, the Configurator now
  says it could not reach RaidPal and keeps showing your saved list, instead of
  reporting that your account does not exist. Failed reads are also retried.
- **The Configurator fits a phone.** The top bar no longer forces sideways
  scrolling at 375px.
- **The landing page's "build from a RaidPal event" button** pointed at a page that
  had stopped meaning that, so the paste-an-event door had no link at all.
- **Security: a hand-crafted overlay link can no longer beacon your IP.** The
  by-hand lineup format accepted an organiser avatar URL that the overlay would
  fetch. Nothing in the product ever wrote one, but "paste this URL into OBS" is
  how everyone is onboarded, so a link from a stranger could have reported your IP
  and go-live time, or probed devices on your home network. The field is gone from
  both the reader and the writer.

## [0.7.2] - 2026-07-12

### Fixed
- **High Vibes performance, take two** — the theme still stuttered in OBS's embedded
  (CEF) browser after the 0.7.0 node-count trim, and profiling found the real culprit
  was never the drifting leaves. It was the shared per-car *undulation* (the gentle
  body sway every theme rides): it transform-animates each car's SVG `<g>`, and Blink
  cannot composite a transform animation on an SVG group, so every frame it re-rasterizes
  that car's entire ~500-path plant on the main thread. A 24-car marquee re-rastered
  ~26,000 paths per frame (~11 fps); the very same plants, held still, composite at
  ~100 fps — the motion, not the detail, was the cost. High Vibes now opts out of the
  undulation (every other theme keeps it), lifting a 24-car marquee from 11 to ~44 fps
  and a typical 4–12-car train to 58–120 fps, with the full, unchanged lush plant art.
  The sway was ±2.5px and near-invisible on a scrolling marquee; the drifting leaves,
  swaying leaf-bed, rolling hills, and rising spores still carry the scene's motion.

## [0.7.1] - 2026-07-12

### Fixed
- **Explicit English is no longer dropped from the overlay URL** (#1). Picking a
  language in the Configurator now bakes it into the URL — *including* `lang=en` —
  instead of silently omitting English as though it were the default. Previously a
  streamer on a non-English browser who selected English got a URL with no `lang`,
  so the overlay fell back to browser auto-detection and rendered in the browser's
  language. An absent `lang` now means one thing only: follow the browser.

### Added
- **"Auto (browser)" language choice** in the Configurator. The picker gains an
  explicit *Auto (browser)* option that omits `lang` and follows browser detection,
  cleanly distinct from choosing a concrete language. Localized across all ten
  interface languages.

## [0.7.0] - 2026-06-29

The overlay now clears itself between passes by default, and the leaf-forward
"High Vibes" theme is markedly lighter on the embedded browser OBS runs.

### Changed
- **The track and scenery now clear between passes by default** (`track=periodic`).
  Once the train rolls off-screen, a theme's track *and* its ambient scenery — the
  Pride rainbow speed-lines, the High Vibes hills and drifting leaves, the Synthwave
  and Tron grids, the Bullet landscape, the Jazz club glow, the Lava lounge — fade
  out so the overlay goes fully empty between passes, then fade back in as the next
  train rolls in. Previously the default (`track=always`) kept every theme's scene on
  screen the whole time, so atmospheric themes left their effects lingering on an
  otherwise-empty lower-third with no train in sight. Set `track=always` to keep the
  old persistent-scene behavior. (Pass mode only; marquee and preview are unchanged.)

### Fixed
- **High Vibes performance** — the theme stuttered in OBS's embedded (CEF) browser as
  the train rolled by. It animated hundreds of simultaneous SVG nodes, each carrying
  `will-change`, with 13 drifting leaves *per car* — a compositor-layer / GPU-memory
  explosion. Halved the ambient node count (drifting leaves 13 → 6 per car, plus trims
  to the soil leaves, spores, scene leaves, and motes) and dropped the `will-change`
  over-use (a transform animation already gets its own layer; the hint just reserved
  hundreds of backing stores up front). The potted-plant scene is still lush; the
  motion is far cheaper to composite.
- **Departures** — the split-flap flip animated a CSS `brightness()` filter at the
  flip apex, re-rasterizing the filtered text on every letter of every car each frame
  it flipped (against the theme roster's no-per-frame-filter guideline for OBS). The
  flip is now a pure compositor `scaleY`; the board looks the same.

## [0.6.0] - 2026-06-22

### Added
- **Pride theme** (`theme=pride`) — a rainbow parade train: a bright "steam-bullet"
  locomotive (rainbow flank stripe, nose chevron, and rainbow smoke), full-flag 6-stripe
  rainbow coaches with windows and strung bunting, a cupola-lookout caboose with a tail-lamp,
  twinkling sparkles, and a full-width band of rushing rainbow speed-lines. Selectable in the
  Configurator, the landing-page theme chips, the preview gallery, and `shuffle`; localized
  across all 11 locales.

### Fixed
- Themes picked the locomotive by car position (`index 0`) instead of by role. When the
  Engine is hidden post-event (`enginedim=finished` + `hidefinished`), the view-model drops
  it — so the first car is a regular coach, or the train is empty. The old code mis-rendered
  that coach as the loco (and froze its time updates) or threw while building the loco from an
  empty list. Every theme now keys the loco off the view-model's `kind`.

## [0.5.0] - 2026-06-22

Build a raid-train overlay with **no RaidPal event at all** — type your DJs in by hand.
The Configurator gains a "Build by hand" mode that produces the same full overlay (every
theme and option) from a lineup you enter yourself, carried entirely in the URL so it
still works as an OBS browser source with no backend. Plus a long-standing rendering fix
for streamers who play back-to-back.

### Added
- **Build a lineup by hand.** A *RaidPal event ⇄ Build by hand* toggle in the Configurator.
  In manual mode you set an event title, your handle, a start time and timezone, then a list
  of DJs — each with a default set length and a per-DJ **×N slot** count. The lineup is
  encoded into the overlay URL (`?lineup=…`); re-opening that link rehydrates the editor so
  you can tweak and re-copy. Same themes, motion, live preview, copy, and OBS steps as a
  RaidPal lineup.
  - Paste a whole list at once (one handle per line, optional `2h`/`90m`), drag rows or
    timeline blocks to reorder, and `@name` / `twitch.tv/…` links are cleaned up.
  - **Saved streamers** — handles you use are remembered (when you save a preset or copy the
    URL, or via a "save a streamer" field) and offered back as click-to-add chips and as
    autocomplete on the handle fields. Stored locally; nothing leaves your browser.
  - A west-to-east timezone picker with your own zone detected at the top.
- **Landing page**: separate **Build from a RaidPal event** and **Build by hand** paths, and
  theme chips that link straight to a preview or the builder.
- The preview gallery now lists all 14 themes.

### Changed
- The Configurator leads with **"Paste your RaidPal event link"** — the jargon word "slug"
  is gone from every user-facing string (and all 10 translations), replaced with plain,
  link-first copy. A fresh page leaves the event field empty (so its hint shows) while still
  previewing the built-in demo.
- Native form controls (the date/time picker and the dropdowns) now render in the dark theme.

### Fixed
- **No more "double train."** A streamer holding consecutive slots (a multi-hour set) is now
  drawn as a single car spanning the combined time, instead of one identical car per slot.

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

[0.8.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.8.0
[0.7.2]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.7.2
[0.7.1]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.7.1
[0.7.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.7.0
[0.6.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.6.0
[0.5.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.5.0
[0.4.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.4.0
[0.3.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.3.0
[0.2.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.2.0
[0.1.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.1.0
