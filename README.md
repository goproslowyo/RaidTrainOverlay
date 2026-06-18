# RaidTrainOverlay

A stream overlay that turns a [RaidPal](https://raidpal.com) **raid train** into an
animated train of streamer cars rolling across your scene — built for OBS, hosted on
GitHub Pages, no build step.

The locomotive is the **organiser** — the conductor of the raid train; every booked slot is
a coach with its broadcaster's avatar and name (the streamer who kicks things off rides the
first coach), the **NOW** marker rides whoever's live, and departed slots get a **PLAYED**
stamp. Ten themes, from Classic Americana to Tron to 16-bit pixel art.

**▶ [Open the app](https://goproslowyo.github.io/RaidTrainOverlay/)** &nbsp;·&nbsp;
[Preview it](https://goproslowyo.github.io/RaidTrainOverlay/preview.html) &nbsp;·&nbsp;
[Build an overlay URL](https://goproslowyo.github.io/RaidTrainOverlay/configurator.html)
&nbsp;·&nbsp; [Author a theme](docs/authoring-a-theme.md)

## Quick start (OBS)

1. **Get your event slug** — the last part of your RaidPal event link:
   `raidpal.com/event/`**`your-event`** → `your-event`.
2. **Build your URL** in the [Configurator](https://goproslowyo.github.io/RaidTrainOverlay/configurator.html):
   pick a theme, motion, size and position, and copy the generated link. The minimal form is:
   ```
   https://goproslowyo.github.io/RaidTrainOverlay/overlay.html?event=your-event
   ```
3. **Add it to OBS** — *Sources → + → Browser*, paste the URL, set the width/height to your
   canvas (e.g. 1920×1080). The overlay background is transparent, so it composites over
   your scene.

## Options

All optional, set as query params (the Configurator writes these for you):

| Param | Meaning |
|---|---|
| `event` | **Required.** RaidPal event slug. |
| `lang` | Overlay language: `en` (default), `es-ES`, `es-MX`, `pt-BR`, `it`, `de`, `nl`, `da`, `lt`, `fr`. Localizes the on-screen words (NOW, OPEN, PLAYED, statuses) and uses a locale-aware clock; absent, it follows the browser. |
| `theme` | `classic` (default), `flat`, `synthwave`, `ticket`, `wood`, `comic`, `departures`, `paper`, `tron`, `pixel`. |
| `mode` | `pass` (one pass every `interval`) or `marquee` (continuous loop). |
| `speed`, `interval` | Traversal speed; minutes between passes. |
| `track` | `always` (default) keeps the rails on screen; `periodic` fades them out between passes so the overlay goes fully empty until the next one (Pass mode only). |
| `trackfadein`, `trackfadeout` | Fade durations in seconds for `track=periodic` (default `15` / `10`; `0` = instant; long values are trimmed to fit short intervals). |
| `scale`, `height` | Size multiplier (`0.5`–`2`); vertical position (`0`–`100`). |
| `spotlight` | Comma-separated names to highlight. |
| `openslots` | Show unbooked slots as **OPEN** sign-ups. |
| `tz` | Up to three zones (e.g. `PT,ET,GMT`) for absolute times. |
| `refresh` | Auto-refresh cadence in minutes (`0` = on load only). |
| `hidefinished`, `enginedim` | Drop departed cars; how the loco behaves post-event. |

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
Brazilian Portuguese, Italian, German, Dutch, Danish, Lithuanian, and French — set with
the `lang` param or the configurator's language picker (it follows the browser otherwise).

The non-English catalogs are machine translations hardened by an automated review pass but
**not yet confirmed by native speakers** — corrections are very welcome and take ~2 minutes
(you edit a draft, not a blank page). See **[TRANSLATING.md](TRANSLATING.md)**.

## Author a theme

Themes are self-contained modules — copy [`src/themes/starter/`](src/themes/starter/index.js),
reshape the art, register it. Full walkthrough (the contract, the three media, bringing your
own image assets, verifying, registering): **[docs/authoring-a-theme.md](docs/authoring-a-theme.md)**.

## How it's built

Plain ES modules and the DOM — no framework, no bundler. `overlay.html` wires
config → a resilient RaidPal feed → the lineup model → the theme renderer. The domain
vocabulary and core concepts are in [`CONTEXT.md`](CONTEXT.md).

Run the unit tests (the DOM-free logic — config, the RaidPal client, the lineup engine)
with Node's built-in runner:

```
node --test
```

The renderer's art is verified visually via the manual harness at
[`test/manual/harness.html`](test/manual/harness.html) (e.g. `#theme=tron&now=…&bg=checker`).

## License

[MIT](LICENSE) © goproslowyo. Not affiliated with RaidPal.
