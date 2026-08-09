# PRODUCT.md — RaidTrainOverlay

## What this is

A stream overlay that turns a RaidPal raid train into an animated train of
streamer cars for OBS, plus the Configurator that builds its URL. Static pages,
no build step, no backend, no accounts: everything a streamer configures lives
in their browser's localStorage, and **the URL is the save file** — the Overlay
consumes only its query string.

## Who it serves

Twitch streamers who run or join raid trains (relay events booked on RaidPal),
setting up an OBS browser source — usually once, often mid-preparation for a
stream, on a desktop with OBS on the other monitor. Their viewers see the
Overlay; the streamer sees the Configurator.

## Product truths (constraints that outrank any design)

- **Settings are the URL.** Any settings change changes the Live Link, and the
  streamer must re-copy it into OBS. The only thing that never needs a re-copy
  is a new raid train — the Overlay resolves trains from RaidPal at load.
- **The app cannot observe OBS.** There is no channel back from a browser
  source, so no copy may claim "we can see it loading" — reassurance the app
  cannot verify is worse than none.
- **OBS performance is a mandate.** The Overlay runs inside OBS's compositor:
  no per-frame JS, no per-frame SVG filters; slow timers and transform-only CSS
  animation.
- **RaidPal has no stable event id.** A renamed event is indistinguishable from
  a deleted one; every cleanup/prune decision is built around that.
- **Per-Profile vs per-train.** Presets and per-train overrides style trains;
  the Live Link's idle state (the between-trains card) exists outside any
  single train, so its settings are per-Profile, never per-train.
- **The repo's English is mixed on purpose** ("Behavior" but "Organiser");
  match the specific shipped string, never normalise.

## Brand commitments

- **Sodium design system** (from the "App redesign for simplicity" Claude
  Design project): the `--rt-*` token block in `assets/app.css` — warm sodium
  accent (#FF9D2E) on deep slate, Public Sans + DM Mono. Adopted app-wide
  (Configurator + landing) with the v2 shell; `preview.html` deliberately keeps
  its own older palette.
- The train metaphor is load-bearing across code, copy, and art — see
  CONTEXT.md for the canonical vocabulary (Engine, Car, Caboose, Pass,
  Marquee, Baseline…).

## Platform

Web, static hosting (GitHub Pages). Two ages of the Configurator: a three-stop
first-run journey, then a Simple / Everything home. Tests are `node --test`
over pure modules; layout truth is verified in a browser, never in node.
