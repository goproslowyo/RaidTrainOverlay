# Changelog

All notable changes to RaidTrainOverlay are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project follows
[Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/goproslowyo/RaidTrainOverlay/releases/tag/v0.1.0
