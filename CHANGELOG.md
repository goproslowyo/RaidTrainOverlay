# Changelog

All notable changes to RaidTrainOverlay are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.10.1] - 2026-08-12

Three moments where the overlay painted the wrong thing for a frame and then
corrected itself — the kind a viewer catches in a VOD clip and a test with no
layout engine cannot see at all. Two were found by reviewing the fix for the
first.

### Fixed
- **A Breather cut short no longer snaps the Train back.** A marquee **Breather**
  clears the **Stage** by fading, "Train and Track together, by a fade, never a
  slide" — but only when it was allowed to finish. When the **Horizon** emptied
  on a resolve tick mid-Breather, the Stage's opacity was restored in a single
  frame. It now finishes the fade upwards over what a natural return would have
  had left. Measured in a browser: a 0.666 one-frame step becomes 0.001, and at
  the shipped defaults the Stage is below full opacity for a quarter of every
  cycle, so the artefact it removes was the whole Train appearing out of
  nothing. (#88)
- **An emptied Horizon no longer flashes the Upcoming card over the live Train.**
  The presence class carries the card layer's only opacity source, so dropping
  it did not hide the card — it handed the layer the base opacity every element
  has, painting the card at full opacity over the Train and dissolving it over
  460 ms. The layer's own opacity is now nothing, declared beside the keyframe
  that is its presence. It also fails closed: a generated cycle a browser cannot
  parse now hides the card rather than parking it over the Train. (#90)
- **The Stage and the card read their phase on the clock their keyframes run
  on.** Both animations run on the monotonic document timeline; both epochs were
  wall-clock reads, and an OBS source runs for days past NTP steps, manual clock
  changes and resumes from suspend. A backward step did not merely degrade the
  Breather's return, it restored the snap exactly; on the card it moved the
  appearance window off the **Pass** it is timed against, which is the one thing
  the choreography exists to prevent. Both now read the mount Document's
  monotonic clock through a single module.

### Documented
- **What the roster costs the pages, measured against the deployment rather than
  localhost** (`docs/research/theme-registry-page-cost.md`): +127 KB on a cold
  Configurator load and +13 ms, with parse time turning out not to be the cost
  at all. The landing page's weight is unchanged. Recorded with its negative
  control, and with two instruments that failed reported as failures rather than
  as zeros. (#76)
- **Three traps `node --test` cannot model about a stylesheet**
  (`docs/agents/environment.md`): `linkedom` does not enforce CSSOM value
  parsing, it cannot see a class coming off an element as a painted change, and
  a generated base rule that outranks a presence keyframe kills the feature it
  was written to protect while the suite stays green.

## [0.10.0] - 2026-08-10

The Upcoming card learned to fill a live train's downtime — and then learned to
stay in its own corner while doing it. The overlay also settled what to *call*
the thing: a glossary for the card's anatomy, and the same words in the code.

### Added
- **The Upcoming card now appears while a train is live**, filling the downtime
  the overlay used to spend empty. In `pass` mode it pulses into the true-empty
  middle of each gap between Passes; in `marquee`, which has no gap, the cycle
  manufactures one — a **Breather**, in which the Train and the Track clear the
  stage together (by a fade, never a slide) and return afterwards. The card and
  a visible Train are never on screen at once. Live Link sources only, listing
  the *other* upcoming trains; `uponly=1` sources are unaffected.
  Appearances are one generated CSS keyframe sharing the Train's own period —
  no per-frame JavaScript, no timers, and no drift over a long stream — with
  whole pages (or whole ticker laps) only, and a deterministic sit-out when a
  gap is too short to hold even one. (wayfinder map #53, spec #59)
- **`upgap`** — one boolean, on by default wherever the card is on, meaning the
  same thing in both modes: `upgap=0` says never interrupt a live train.
- **The Configurator's "Between trains" toggle is now a three-way** — *Never* /
  *Between trains* / *Between trains, and while one is live* (the default),
  translated across every locale.

### Changed
- **"Marquee" now names one thing only: a Mode.** The word described both the
  Train's continuous crawl (`mode=marquee`) and the Upcoming card's one-line
  footprint — which sent at least one streamer to `mode=` hunting for a control
  that lives two fields away, under *How much room it takes → One line*. The
  card's one-line variant is the **scrolling view**: `CONTEXT.md` gains
  **Upcoming card** and **Footprint** entries, **Mode** now says it governs the
  Train alone, and the internal identifiers followed (`rt-upcoming-marquee` →
  `rt-upcoming-ticker`, the Configurator's `tickmarquee` → `tickscroll`).
  **No URL param changed** — `mode=marquee` and `upstyle=ticker` are baked into
  copied OBS browser sources, so existing sources keep working. (#67)
- `prefers-reduced-motion` extends to the new behaviour: the Breather is
  suppressed (the Train stays put) and the between-Pass card does not pulse.
- **A manual prototype of the Upcoming card's between-Pass choreography**
  (`test/manual/upcoming-gap-prototype.html`, dev-facing, not shipped to the
  overlay): the card pulsing in the true-empty middle of a pass-mode gap on
  one gap-synced CSS keyframe — preset gap scenarios, time compression, a
  click-to-seek period timeline, and a readout of the derived appearance
  windows. The approved choreography feeds the between-Passes spec
  (wayfinder map #53, ticket #56).
- **The card's anatomy has words now, and the code uses them.** `CONTEXT.md`
  gains **Horizon**, **Stage**, **Page**, **Lap**, **Card view**, **Scrolling
  view**, **Occasion** and **Cell** — four of which the previous round used
  without ever defining. "Ticker" is retired as a *word*: on review it was not
  recognised, and the one-line variant was twice called *the scrolling view*, so
  that is what the glossary records and what the renderer is named. About 48
  identifiers, the DOM ids and 25 i18n keys move to one `upcoming*` namespace,
  and the five English strings that still said "idle" now say **Upcoming card** —
  the ten translations never said it (they already said a *waiting* card), so
  this converges on them rather than diverging. `idle` survives in exactly one
  sense: the Live Link having no train to show.

### Fixed
- **The Upcoming card stays inside its anchor's cell.** Placement worked but
  size never followed it: the scrolling view spanned the whole screen at every
  anchor and every scene size — 2.9× the cell it was anchored in — and the card
  view's ceiling reached 1.59× at 1280×720, so a card at one corner covered the
  others. Three rules were deciding one box independently. The anchor grammar
  now owns the entire budget, placement *and* a ceiling of a third of the scene
  on each axis, with both views filling it. The cell is expressed in CSS
  viewport units rather than measured in JavaScript, because OBS browser
  sources report a window width of 0.
- **The scrolling view stops captioning itself into illegibility.** Inside a
  cell its fixed ~209px eyebrow competed with the trains it captions, and
  capping it merely produced a truncated `UPCOMING RAI…` above a window too
  narrow to hold a name — at 1280 no point in the cycle ever showed a whole
  entry. Below the width where the eyebrow fits whole it is now dropped
  entirely, along with the secondary UTC stamp, and the edge fade narrows: the
  1280 scroll window goes from 184px to 333px, enough for a full date and a
  full streamer name. 1920 keeps its caption unchanged.

## [0.9.1] - 2026-08-09

A standards pass over the v2 theme roster: the OBS-perf rule ("no filter
re-computes per frame") and the reduced-motion promise now hold on every theme.

### Fixed
- **Synthwave, Tron and Pixel stop paying a per-frame filter tax.** Each had an
  animating element living *inside* its glow-filtered art group — synthwave's
  breathing headlight beam (on the live car), tron's trail ribbon (breathing
  wall + travelling sweep, on **every** machine, at rest), and pixel's stepped
  smoke puff (on the engine whenever it carried a state filter). An animation
  under an SVG filter re-rasterises the filter every frame; all three now
  animate in unfiltered sibling layers — same look, and each glow bitmap is
  rastered once and cached. The authoring guide's rule was also re-worded to
  state the real invariant (static filters cached, animation in sibling
  layers) instead of the untrue "every other Theme is filter-free at rest".
- **The Departures board honors `prefers-reduced-motion`.** The split-flap
  status change restarted its flip via an inline style, which outranks any
  media-query guard; it is now a class toggle the reduced-motion rule can
  beat. The live unit's blinking lamp — an infinite animation with no guard at
  all — joins the same rule, alongside the existing cell-wave guard.

## [0.9.0] - 2026-08-09

The Configurator grew up into two ages of one app. A first visit is a three-stop
journey — who's streaming, how it looks, put it on your stream — and every visit
after that is a single page with a **Simple / Everything** switch: Simple is five
decisions with a live preview, Everything is the full app you already know. The
whole product also moved to the redesign's warm **sodium** palette, landing page
included.

### Added
- **First-run setup.** Three stops to a working Live Link. Finishing (or
  skipping) is remembered per Profile, so the journey never reappears — it can
  be re-run any time from the profile menu.
- **The Live Link page is the whole handoff.** Both stream links — the Live
  Link and its upcoming-trains companion, now at equal billing with its own
  badge and copy button — followed by the illustrated four-step OBS
  walk-through, which lives only there (plus setup's last stop) instead of
  repeating on every view. A visible **Add to OBS** top-bar button jumps
  straight to the steps, and the closing line offers a preview button instead
  of printing the raw overlay URL. Both URL rows carry their own
  **Preview the overlay** door too, and the idle-card settings sit between the
  links and the steps as their own section — one card, both links, styled
  once — instead of reading as the Live Link's alone.
- **Simple view.** The five decisions that matter — theme, cadence, size, open
  slots, played cars — editing your default Preset directly, beside a live
  preview and your Live Link.
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
- **The idle card reads as a table.** One grid for the whole list — every
  row's time and UTC share columns sized by the widest entry — with
  constant-width departures (2-digit days and hours) so the columns cannot
  drift between pages. Train names carry a soft shadow to pop off the scene,
  and page turns dissolve over a quarter of the hold (up to 1.1s each way).
  Zone names are per-date, so PDT and PST rows coexist correctly on one card.
- **The idle card's whole lifecycle is faded, never cut.** It eases in on
  mount and out when the horizon empties; page turns crossfade while the
  panel holds a locked outline, so a shorter last page no longer snaps the
  box in front of the viewer; and a repaint whose inputs haven't changed is
  now a no-op — the Live Link's resolve tick no longer blinks a card that is
  already right or resets its page cycle. The Configurator's between-trains
  preview turns its pages with the same crossfade.

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

[Unreleased]: https://github.com/goproslowyo/RaidTrainOverlay/compare/v0.10.1...HEAD
[0.10.1]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.10.1
[0.10.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.10.0
[0.9.1]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.9.1
[0.9.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.9.0
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
