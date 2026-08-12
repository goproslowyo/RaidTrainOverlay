# RaidTrainOverlay

A stream overlay that turns a [RaidPal](https://raidpal.com) **raid train** into an
animated train of streamer cars rolling across your scene — built for OBS, hosted on
GitHub Pages, no build step.

The locomotive is the **organiser** — the conductor of the raid train; every booked slot is
a coach with its broadcaster's avatar and name (the streamer who kicks things off rides the
first coach), the **NOW** marker rides whoever's live, and departed slots get a **PLAYED**
stamp. Fifteen themes, from Classic Americana to 16-bit pixel art to a rainbow Pride parade.

**▶ [Open the app](https://goproslowyo.github.io/RaidTrainOverlay/)** &nbsp;·&nbsp;
[Preview it](https://goproslowyo.github.io/RaidTrainOverlay/preview.html) &nbsp;·&nbsp;
[Build an overlay URL](https://goproslowyo.github.io/RaidTrainOverlay/configurator.html)
&nbsp;·&nbsp; [Author a theme](docs/authoring-a-theme.md)

## Quick start (OBS)

1. **Open the [Configurator](https://goproslowyo.github.io/RaidTrainOverlay/configurator.html).**
   Your first visit is a three-stop setup: your Twitch username (no sign-in — RaidPal's
   public profile is read by name), how the train should look, and putting it on your
   stream. Every visit after that is one page with a **Simple / Everything** switch —
   Simple is the five decisions that matter, Everything is the full app (My Raid Trains,
   Presets, per-train Configs, One-off links).
2. **Copy your Live Link** — one URL, keyed to your username, that always shows whichever
   train is live (or your next one). Set it in OBS once and never edit it per train.
   Prefer a link pinned to a single train? Hit **Configure** on that train and copy its link:
   ```
   https://goproslowyo.github.io/RaidTrainOverlay/overlay.html?event=your-event
   ```
3. **Add it to OBS** — *Sources → + → Browser*, paste the URL, set the width/height to your
   canvas (e.g. 1920×1080). The overlay background is transparent, so it composites over
   your scene.

Not your RaidPal account, or no RaidPal event at all? **One-off link** takes any event link,
or lets you type a lineup in by hand.

Settings live in **Presets** — saved bundles of look and motion with no event attached. Each
train's **Raid Train Config** points at a Preset and overrides only what differs, so one tweak
to a Preset flows to every train that hasn't overridden that field.

## Options

All optional, set as query params (the Configurator writes these for you):

| Param | Meaning |
|---|---|
| `event` | **Required.** RaidPal event slug. |
| `lang` | Overlay language: `en`, `es-ES`, `es-MX`, `pt-BR`, `it`, `de`, `nl`, `da`, `lt`, `fr`. Localizes the on-screen words (NOW, OPEN, PLAYED, statuses) and uses a locale-aware clock. When omitted, the overlay intentionally uses Auto/browser detection. |
| `theme` | `classic` (default), `flat`, `synthwave`, `ticket`, `wood`, `comic`, `departures`, `paper`, `tron`, `pixel`, `highvibes`, `jazz`, `bullet`, `lava`, `pride`; or `shuffle` to cycle the whole roster. |
| `mode` | How the *train* moves: `pass` (one pass every `interval`) or `marquee` (continuous loop). Train only — the between-trains listing has its own shape knob, `upstyle`. |
| `speed`, `interval` | Traversal speed; minutes between passes. |
| `track` | `periodic` (default) fades the rails/scenery out between passes so the overlay goes fully empty until the next one rolls in — nothing lingers with no train; `always` keeps them on screen the whole time (a persistent lower-third). Pass mode only. |
| `trackfadein`, `trackfadeout` | Fade durations in seconds for `track=periodic` (default `15` / `10`; `0` = instant; long values are trimmed to fit short intervals). |
| `scale`, `height` | Size multiplier (`0.5`–`2`); vertical position (`0`–`100`). `100` rests the train's floor on the bottom edge, so themes no longer need per-theme nudging; `jazz` and `lava` sit their *scenery* — the console deck, the lounge floor — on that edge instead, leaving the train a little above it by design. |
| `spotlight` | Comma-separated names to highlight. |
| `openslots` | Show unbooked slots as **OPEN** sign-ups. |
| `tz` | Up to three zones (e.g. `PT,ET,GMT`) for absolute times. |
| `refresh` | Auto-refresh cadence in minutes (`0` = on load only). |
| `hidefinished`, `enginedim` | Drop departed cars; how the loco behaves post-event. |

Live Link URLs use `user` (a Twitch login the overlay resolves to the live-or-next train)
instead of `event`, plus its own params — all written by the Configurator:

| Param | Meaning |
|---|---|
| `user` | Twitch login; the overlay resolves your live (or next) train from RaidPal at load. |
| `trains` | Per-train settings blob (each train's saved differences from your base look). |
| `upcoming` | Between trains, list what's coming up: `3` (next 3), `2w` (2 weeks), `1m`, `all`. Omitted = fully transparent between trains. |
| `upstyle` | How much room the listing takes: `card` (default, three rows, pages through longer lists) or `ticker` (one line, scrolling the whole list on a loop). Independent of `mode` — this is the listing's shape, not the train's. |
| `uppos` | Where it sits in your scene: nine anchors, `tl`/`tc`/`tr`/`ml`/`mc`/`mr`/`bl`/`bc` (default)/`br`. |
| `upop` | Its opacity, `0.3`–`1` (default `0.88`). |
| `upcycle` | Seconds each page of three is held (default `12`). |
| `upscroll` | Seconds for one full lap of the scrolling view (default `34`; higher is slower). |
| `uponly` | Upcoming-trains-only source for a separate OBS scene: always the listing, never the train — even while one is live. Lists every train you haven't played yet, including one that has already departed and is running now with your slot later on it. |
| `upgap` | On by default: while a train is live, the listing also pops up briefly in the pauses — between passes, or in a marquee's breathers — never over the train itself. `upgap=0` turns that off, leaving the listing to appear only between trains. |
| `lead` | Minutes before **your own slot** that the train rolls in (default `60`, max `360`). `lead=0` means it appears exactly as you go on. |
| `wholetrain` | `wholetrain=1` goes back to showing any train that's running, for as long as it runs, regardless of whether you're on it. |

The overlay follows **you**, not the timetable: it shows the train you're playing on,
from `lead` minutes before your slot until the moment your slot ends — then it clears
and the upcoming listing takes over. Two trains overlapping is fine; the one you're
actually on wins. If a lineup can't be read, or doesn't name you, that train falls back
to being shown for its whole run.

## Self-hosting on GitHub Pages

It's a static site — no build, no server.

1. Fork or push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source: _Deploy from a branch_**, branch
   **`main`**, folder **`/ (root)`**. Save.
3. Your overlay is live at `https://<you>.github.io/<repo>/overlay.html?event=…`.

The bundled `.nojekyll` disables Jekyll processing, and all paths are relative, so it works
under the project subpath as-is. The RaidPal API is fetched client-side from the served
origin (it works the same from `github.io` as from `localhost`).

## Languages

The overlay and configurator are available in English, Spanish (Spain & Mexico),
Brazilian Portuguese, Italian, German, Dutch, Danish, Lithuanian, and French. Choose
**Auto (browser)** in the configurator to omit `lang` and follow browser detection, or
choose a concrete language such as English to bake `lang=en` into the copied URL.

The non-English catalogs are machine translations hardened by an automated review pass but
**not yet confirmed by native speakers** — corrections are very welcome and take ~2 minutes
(you edit a draft, not a blank page). See **[TRANSLATING.md](TRANSLATING.md)**. If a word
reads wrong in your language and you'd rather not touch code, just
[open an issue](https://github.com/goproslowyo/RaidTrainOverlay/issues/new) and say so —
no account or translation platform to sign up for.

## Author a theme

Themes are self-contained modules — copy [`src/themes/starter/`](src/themes/starter/index.js),
reshape the art, register it. Full walkthrough (the contract, the three media, bringing your
own image assets, verifying, registering): **[docs/authoring-a-theme.md](docs/authoring-a-theme.md)**.

## How it's built

Plain ES modules and the DOM — no framework, no bundler. `overlay.html` wires
config → a resilient RaidPal feed → the lineup model → the theme renderer. The domain
vocabulary and core concepts are in [`CONTEXT.md`](CONTEXT.md).

The tests need one dev dependency — `linkedom`, which gives the DOM-touching modules a
Document to mount into. Nothing ships: it is a test-only install, and the Overlay still
loads as bare files. Install it once, then run the tests with Node's built-in runner:

```
npm ci
node --test
```

That covers the pure logic (config, the RaidPal client, the lineup engine) and the
structure of the DOM modules — which rows render, how a Page turns, how a mount is
retired. It does not cover anything measured: no DOM implementation has a layout engine,
so `offsetWidth` and `getBoundingClientRect()` read 0. The Cell rule and the Train's art
are browser questions, and a green suite is not evidence about either.

The renderer's art is verified visually via the manual harness at
[`test/manual/harness.html`](test/manual/harness.html) (e.g. `#theme=tron&now=…&bg=checker`).

## License

[MIT](LICENSE) © goproslowyo. Not affiliated with RaidPal.
