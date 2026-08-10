---
name: RaidTrainOverlay — Sodium
description: Warm sodium light on deep slate — the Configurator and landing page's shared design system.
colors:
  void: "#07090D"
  base: "#0C1016"
  well: "#080B10"
  surface: "#141A22"
  surface-2: "#1C2430"
  surface-3: "#28323F"
  line: "#242D39"
  line-strong: "#38424F"
  ink: "#EDF1F7"
  ink-2: "#9BA7B8"
  ink-3: "#697686"
  sodium-100: "#FFE7C6"
  sodium-300: "#FFC578"
  sodium-500: "#FF9D2E"
  sodium-600: "#EF7C12"
  sodium-700: "#A9530B"
  sodium-tint: "rgba(255, 157, 46, .10)"
  sodium-edge: "rgba(255, 157, 46, .34)"
  on-sodium: "#180D01"
  live: "#FF4D63"
  ok: "#43D48D"
  warn: "#FFD166"
  danger: "#FF6B6B"
  override: "#A78BFA"
  info: "#7FB6FF"
typography:
  display:
    fontFamily: "Public Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "46px"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-1.4px"
  headline:
    fontFamily: "Public Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 700
    lineHeight: 1.18
    letterSpacing: "-.6px"
  title:
    fontFamily: "Public Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-.3px"
  body:
    fontFamily: "Public Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Public Sans, Helvetica Neue, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: ".09em"
  meter:
    fontFamily: "DM Mono, ui-monospace, SF Mono, Menlo, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: ".14em"
rounded:
  xs: "4px"
  sm: "7px"
  md: "10px"
  lg: "14px"
  xl: "20px"
  pill: "999px"
spacing:
  gutter: "28px"
  shell-max: "1240px"
  side-width: "224px"
  control-h: "38px"
  control-h-sm: "30px"
components:
  button-primary:
    backgroundColor: "{colors.sodium-500}"
    textColor: "{colors.on-sodium}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-h}"
    padding: "0 15px"
  button-primary-hover:
    backgroundColor: "{colors.sodium-300}"
    textColor: "{colors.on-sodium}"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-h}"
    padding: "0 15px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-h}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "18px 20px"
  input:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "{spacing.control-h}"
    padding: "0 11px"
  chip-status:
    backgroundColor: "{colors.sodium-tint}"
    textColor: "{colors.sodium-300}"
    rounded: "{rounded.pill}"
    padding: "2px 9px"
---

# Design System: RaidTrainOverlay — Sodium

## Overview

**Creative North Star: "The Sodium Yard at Night"**

A rail yard after dark: deep slate surfaces stacked like night air, and one warm
sodium-vapor lamp (#FF9D2E) doing all the pointing. The system is dark by
construction, not by inversion — five slate steps (`void` → `base` → `well` →
`surface` → `surface-2` → `surface-3`) build depth tonally, hairline borders do
the structure, and the sodium accent appears only where the product wants your
hand: the primary button, the Live Link, the selected state. Everything
operational — times, counts, URLs, stage labels — switches to DM Mono, like
departure boards in a station.

This system governs exactly two pages: **configurator.html** and **index.html**,
which share the `--rt-*` token block in `assets/app.css` (tokens only,
deliberately; each page keeps its own inline `<style>` for layout).
**Outside this system on purpose:** `preview.html` keeps its older, dimmer
palette (`--accent: #9ad`) — pulling it in would restyle a page nobody asked to
restyle — and the Overlay's Theme art is per-Theme, governed by
`docs/authoring-a-theme.md`, never by these tokens. The legacy aliases
(`--bg`, `--panel`, `--accent`, `--gold`, …) exist so old markup reskins instead
of drifting; new styling uses the `--rt-*` names.

**Key Characteristics:**
- One warm accent (sodium orange) on tonal deep slate; every other hue is a status voice.
- Public Sans for prose and UI; DM Mono for anything a machine would print.
- Pill controls and pill badges; softly rounded cards (14px); hairline borders everywhere.
- Checkerboard stages wherever OBS transparency is being depicted.
- Transform-only, slow motion — the OBS performance mandate reaches the app's own chrome.

## Colors

A single warm accent over a five-step slate ramp, with six status hues that each
ship as a solid + tint + edge trio.

### Primary
- **Sodium Lamp** (`sodium-500`, #FF9D2E): the one voice of action and selection — primary buttons, the active stop, `aria-pressed` states, the selected theme swatch. Hover lightens to **Sodium Glow** (`sodium-300`, #FFC578); press darkens to `sodium-600` (#EF7C12). Text set *on* sodium is **Scorched** (`on-sodium`, #180D01), never white.
- **Sodium Glow** (`sodium-300`, #FFC578) also serves as ink: eyebrows, card headers, mono values in wells, the focus ring (`--rt-focus`), and link hover.
- **Sodium Tint / Edge** (rgba(255,157,46,.10) / .34): the wash-and-border pair for selected surfaces (radio cards, accent icon buttons, the Live Link hero's border).

### Neutral
- **Slate ramp** — `void` #07090D (page-edge dark), `base` #0C1016 (the page), `well` #080B10 (sunken: seg-control tracks, URL fields, chips' ground), `surface` #141A22 (cards, top bar), `surface-2` #1C2430 (controls, hover fills), `surface-3` #28323F (pressed/raised: toasts, badges). Depth = which step you're on.
- **Lines** — `line` #242D39 (default hairline everywhere), `line-strong` #38424F (interactive edges: inputs, secondary buttons).
- **Ink ramp** — `ink` #EDF1F7 (primary text), `ink-2` #9BA7B8 (secondary text and all small helper copy), `ink-3` #697686 (faint marks only: stage labels, counts, swatch subtitles).

### Status (each is solid + `-tint` ~10% + `-edge` ~30-34%)
- **Live** (#FF4D63): on-air. Pulsing dot chips, live event cards, `glow-live`.
- **OK** (#43D48D): done/confirmed. Completed stops, the graduation ribbon, ok-dots, the finish bar's ready state.
- **Warn** (#FFD166): the re-copy note and other cautions that must inform without alarming.
- **Danger** (#FF6B6B): destructive actions; the outline `destructive` button offers, the modal's `danger-solid` confirms.
- **Override** (#A78BFA): the per-train override vocabulary — badges, revert buttons, "reset all".
- **Info** (#7FB6FF): links inside prose and informational notices (cleanup, not warnings).

### Named Rules
**The One Lamp Rule.** Sodium is the only hue that means "act here" or "this is chosen." Every other color is a status report, never a call to action.

**The Tint-and-Edge Rule.** A colored surface is never a solid flood: it is the hue's `-tint` fill paired with its `-edge` border (chips, notes, radio cards, ok/danger buttons). Solid status color is reserved for dots, text, and the accent button itself.

**The Ink Floor Rule.** Helper copy below 14px reads in `ink-2` — `ink-3` sits under the 4.5:1 contrast floor at that size and is reserved for large or non-essential marks (stage labels, counts, swatch subtitles).

## Typography

**UI Font:** Public Sans (Helvetica Neue, system-ui fallback) — Google Fonts, weights 300–800
**Mono Font:** DM Mono (ui-monospace fallback) — weights 300/400/500

**Character:** A plainspoken grotesque doing the talking, with a typewriter
doing the timetables. Headings tighten their tracking as they grow
(-.3px → -1.4px); micro-labels spread theirs (up to .26em) and go uppercase.

### Hierarchy
- **Display** (800, 46px/1.08, -1.4px; 33px below 820px): the landing hero only. Its key phrase is colored sodium.
- **Headline** (700, 26px/1.18, -.6px): the `.t1` stop question — one per setup screen.
- **Title** (700, 19–20px, -.3/-.4px): view titles, the Live Link heading, editor heads.
- **Body** (400, 15px/1.55; small variants 13.5px/1.5 and 12.5px/1.45): all prose. Bold-in-body is 600 `ink`, used to lift a name or value out of a dim sentence.
- **Label / Eyebrow** (700, 11.5px/1, .09em, UPPERCASE, `sodium-300`): the section voice — eyebrows over stop titles, card headers (`card-h` at 12.5px/.07em), group labels.
- **Meter** (DM Mono 500, 10–13px, .06–.26em tracked, UPPERCASE when a label): times, counts, URLs, stage labels ("YOUR OBS SCENE"), the top bar's stop meta, the landing's board and its kicker. Numbers take `tabular-nums`.

### Named Rules
**The Timetable Rule.** Anything a machine would print — a time, a count, a URL, a slug, a stage label — is DM Mono. Anything a person would say is Public Sans. No third font.

**The Sodium Eyebrow Rule.** Sections are introduced by the uppercase sodium micro-label (`.eyebrow` / `card-h` / the board kicker), not by big headings. The heading below it stays sentence-case and tight.

## Layout

Sticky top bar (surface, hairline bottom border, z-40), then a centered shell:
max-width 1240px (`shell-max`), 28px gutters (`gutter`), 26px column gaps. Home
adds a 224px sticky side rail (`side-width`); setup replaces it with a
full-width stop rail and centers a 620px reading column (`setup-narrow`).

Working views are a two-column `split` grid: `minmax(0, 1fr)` content plus a
fixed reference rail (430/400/320/300px variants), the rail sticky at top 92px.
Both pages open under the same warm haze: a radial sodium-tinted gradient
(`radial-gradient(1200px 500px at 70% -200px, #1d1710, transparent)`) over
`base`.

Breakpoints: **1100px** (rails narrow, theme grid 5→3), **860px** (all splits
collapse to one column, the side rail becomes a wrapping chip row, the stop rail
scrolls horizontally, seg control goes full-width), **600px** (top-bar meta
drops), **420px** (the brand's mini-train drops). The landing collapses at
**820px**. The page assumes a desktop (OBS on the other monitor) but must not
look broken on a phone.

**The minmax(0,1fr) Rule.** Every fluid grid track is `minmax(0, 1fr)` and
every flex/grid child that can carry text gets `min-width: 0` — the Live Link
URL and a Twitch login are single unbreakable words, and a bare `1fr` or
default flex item will refuse to shrink below them and shove the layout off
screen. Rail widths are modifier classes, never inline styles, so the phone
media query can win.

## Elevation & Depth

Depth is tonal first: the slate ramp (well sunken → surface resting →
surface-2/3 raised) plus hairline borders does the everyday work, and resting
cards cast no shadow. Real shadows are reserved for things that float over the
page, and glows are reserved for meaning.

### Shadow Vocabulary
- **shadow-sm** (`0 1px 2px rgba(0,0,0,.4)`): barely-there lift.
- **shadow-md** (`0 10px 28px rgba(0,0,0,.55)`): floating chrome — the profile menu, the toast.
- **shadow-lg** (`0 22px 60px rgba(0,0,0,.62)`): the modal.
- **glow-sodium** (`0 0 30px rgba(255,157,46,.22)`): the meaning-glow — primary buttons, the Live Link hero, the selected theme swatch; on the landing it rides `text-shadow` under the board's sodium times (same grammar, same token).
- **glow-live** (`0 0 26px rgba(255,77,99,.20)`): on-air emphasis.
- **ring** (`0 0 0 2px var(--rt-focus)`): focus, in sodium-300 (also as `outline: 2px solid` + 2px offset).

**The Earned Glow Rule.** The sodium glow marks the one thing a screen most
wants you to do or the thing you chose — never decoration. If two elements on a
screen glow sodium, one of them is lying.

## Shapes

Softly rounded, never round-cornered-to-mush: a six-step radius scale (4/7/10/
14/20/999). Cards and modals sit at `lg` (14px); controls, inputs, and buttons
at `sm` (7px); grouped panels at `md` (10px); inline value wells at `xs` (4px).
The pill (`999px`) is a first-class shape — profile switcher, every chip and
badge, nav counts, the toast, preview buttons, and the ticker variant of the
idle card are all pills. Borders are 1px hairlines with no exception worth
naming; dashed hairlines mark "collapsed/optional" seams (the past-trains
divider, the idle-state fold, open mini-train slots). The recurring silhouette
is the mini-train: small rounded rectangles in a row, engine slightly larger,
drawn in CSS.

**The Checkerboard Rule.** Anywhere the UI depicts what OBS will composite, the
stage is a dark checkerboard (~22–28px squares, near-invisible contrast) — the
universal "this part is transparent" — with a mono uppercase stage label in
`ink-3`.

## Components

### Buttons
- **Shape:** softly rounded (7px, `rounded.sm`), 38px tall (`control-h`), 600-weight 13.5px label; small variant 30px.
- **Primary** (`.btn.primary` / `.gold`): sodium-500 fill, scorched text, weight 700, sodium glow. Hover lightens to sodium-300.
- **Secondary** (`.btn`): surface-2 fill, line-strong border. Hover: surface-3 + ink-3 border.
- **Ghost:** transparent until hovered (surface-2 fill appears).
- **Ok-button** (`.okbtn`): ok-tint/edge — a *done* action reading as confirmation, not invitation.
- **Destructive:** outline danger (offers) vs. `danger-solid` tinted fill (confirms, lives in the modal only).
- **Icon buttons:** 30px squares, `sm` radius; accent and destructive tinted variants.
- **Focus (all controls):** 2px sodium-300 outline, 2px offset.

### Chips (pill badges)
- **Style:** pill, 10.5–11px, weight 800, uppercase, letter-spaced, in a hue's tint + edge + solid-text trio.
- **Voices:** LIVE (pulsing dot, live trio), ORGANISER (sodium trio), override/config (violet trio), DEFAULT (sodium trio), summary/spot chips (neutral: well fill, line border, ink-2).

### Cards / Containers
- **Corner:** 14px (`lg`); grouped `details.fgroup` panels 10px (`md`).
- **Background:** `surface` on `base`; hairline `line` border; 18px 20px padding; no resting shadow.
- **Header:** the sodium uppercase `card-h`.
- **Hero variant (Live Link):** sodium edge border, a sodium-tint radial washing in from the top-left corner, sodium glow, and a flash animation on re-copy.

### Inputs / Fields
- **Style:** surface-2 fill, line-strong hairline, 7px radius, 38px tall, dark `color-scheme`.
- **Focus:** 2px sodium-300 outline, offset 2.
- **Value wells:** mono, sodium-300 text on `well` (the URL field, range outputs, inline numbers).
- **Checks/ranges:** native, `accent-color` sodium.

### Navigation
- **Side rail:** 13.5px/600 items, ink-2 → ink on hover with surface-2 fill; active adds a line border; counts in mono pills. Collapses to a wrapping chip row at 860px.
- **Segmented control:** pill-adjacent track in `well`, pressed segment is solid sodium with scorched text.
- **Stop rail:** numbered circles (26px) — resting: surface-2/ink-3; done: ok trio; here: solid sodium + a 2px sodium underline on the stop.

### Icons
Inline stroke SVG, drawn in-page: 2px stroke at the 24 viewBox, 1.4px at the
compact 16 viewBox; `stroke-linecap/join: round`; `fill: none`;
`currentColor` so icons inherit the button's ink. Never icon fonts, never
emoji-as-icon. The character marks that remain (● pulse dots, • ticker
separators) are typographic, not icons.

### The Idle Slab (signature, overlay-side)
The Live Link's idle panel (`src/upcoming-card.js`) and its mock in the
Configurator share one design, at two scales: a translucent dark slab —
`rgba(9,12,17, .88)` (opacity is the streamer's `upop` knob), 1px
`rgba(255,255,255,.09)` border, 9–12px radius, `backdrop-filter: blur(8px)`,
deep soft shadow — opening with a tracked amber mono eyebrow
(`overlay.upcoming`, #FFC578, `.2em`), a `1 / N` mono page counter, and rows
of amber mono local time → bold name (ellipsising) → dim mono UTC anchor
(every row carries UTC — viewers are worldwide). Built to sit on *any* scene.
The Overlay side renders through local font stacks only (`'DM Mono',
ui-monospace, …` / `'Public Sans', system-ui, …` — an OBS source must never
block on a webfont); the Configurator's mock is a legible miniature of the
same design over a stand-in stream scene. Ticker variant is a full pill with
mask-faded edges and a seamless −50% transform loop (two identical lap
spans, gap inside the lap).

## Do's and Don'ts

### Do:
- **Do** style with `--rt-*` tokens; the legacy aliases (`--bg`, `--gold`, …) exist only so old markup reskins.
- **Do** ship every new status color as the full trio: solid + `-tint` (~10%) + `-edge` (~30%).
- **Do** set anything machine-printed in DM Mono with `tabular-nums`, uppercase and letter-spaced when it labels.
- **Do** wrap fluid columns in `minmax(0, 1fr)` and give their children `min-width: 0` — assume every string might be one unbreakable word.
- **Do** animate with transform/opacity only, on slow timers, and honor `prefers-reduced-motion` on every animation.
- **Do** keep new-page layout in that page's own inline `<style>`; `assets/app.css` is a shared vocabulary, not a framework.

### Don't:
- **Don't** put white text on sodium — text on the accent is `on-sodium` (#180D01).
- **Don't** glow more than one sodium element per screen, or glow anything that isn't the primary action or the chosen thing.
- **Don't** use `ink-3` for helper copy under 14px (contrast floor); it is for large or non-essential marks only.
- **Don't** add Unicode-glyph or icon-font icons; draw them as inline stroke SVG in `currentColor`.
- **Don't** extend these tokens into `preview.html` (its palette diverges on purpose) or into Theme art (per-Theme, see `docs/authoring-a-theme.md`).
- **Don't** revive the pre-v2 blue/gold (`#57b6ff` / `#f4c430`); the sodium system replaced it app-wide.
