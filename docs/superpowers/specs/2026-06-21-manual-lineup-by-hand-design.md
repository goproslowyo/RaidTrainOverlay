# Build a lineup by hand (no RaidPal) — design spec

**Date:** 2026-06-21 · **Status:** approved direction, pending spec review

## Context

Real-user feedback drove this: *"this train today does not have a raidpal for me to plug in. If there was a way to type in the artists handles it would really help those of us who are technology deficient."* Today the overlay can only be driven by a RaidPal event (`?event=<slug>`). Many small/casual raid trains have **no RaidPal event at all**. We want a non-technical streamer to build an overlay by typing their DJs in by hand — and get the **exact same overlay experience** a RaidPal user gets (every theme and motion/display option, the live preview, the copy-to-OBS flow), differing only in where the lineup comes from.

The guiding principle: **a streamer types names and how long each plays, watches their train appear, and copies one link into OBS — never meeting the words *slug*, *slot*, *broadcaster*, or *RaidPal*.**

## The load-bearing insight

The **normalized Event shape is already the interface.** [`buildTrain`](../../../src/lineup-engine.js) consumes one shape produced today by two sources — [`normalizeEvent`](../../../src/raidpal-client.js) (async RaidPal fetch) and [`makeDemoEvent`](../../../src/demo-event.js) (synchronous, no fetch). The overlay's `event === DEMO_SLUG` branch in [`overlay-shell.js`](../../../src/overlay-shell.js) already proves the synchronous, no-fetch render path. A hand-built lineup is simply a **third source** (`makeManualEvent`) emitting the same shape — which is *why* it inherits every downstream feature (themes, marquee/pass, tz multi-zone, spotlight, openslots, hidefinished, enginedim, shuffle, the 30s tick) for free.

## Goals / non-goals

**Goals**
- Drive the overlay from a hand-built lineup carried entirely in the URL (`?lineup=…`) — no backend, works as an OBS browser source.
- Full option parity with RaidPal lineups via one shared settings/preview/copy/OBS surface.
- Timezone-correct: a wall-clock start in a chosen zone → an absolute instant, so relative + multi-zone display are right for every viewer.
- Easy for non-savvy users: per-DJ "plays for" durations, a visual timeline, paste-a-list, handle cleanup, the link doubles as a re-editable save file, auto-save.

**Non-goals (v1)**
- Per-DJ *arbitrary* durations beyond a friendly preset list, or true variable-length slots (the engine is uniform-slot by design; we map durations onto a GCD base slot).
- A server, accounts, or stored lineups beyond the URL + browser localStorage.
- Twitch API avatar auto-fetch (organiser avatar is an optional manual URL).

## Resolved product decisions

| Decision | Choice |
|---|---|
| Authoring surface | **Toggle in the existing configurator** ("RaidPal event ⇄ Build by hand") — one page, full option parity, zero duplicated knob logic |
| Duration entry | **Per-DJ "plays for" dropdown** (30m/1h/1h30/2h/3h/4h); start time + auto-sequenced clock times shown |
| Organiser | **Handle + optional avatar image URL** |
| Presets (manual mode) | **Save the full lineup + source + knobs** (so a recurring roster reloads) |
| DST gap/ambiguous start | Resolve to the **earlier valid instant** (documented default; raid trains effectively never start on a clock-change boundary) |
| Size guard | Editor **warns past ~40 DJs**; `decodeLineup` rejects oversized blobs |

## Architecture

A single branch point in `overlay-shell` over the parsed config; all branches converge on `render(buildTrain(event, now, cfg))`:

- `config.lineup` present → `decodeLineup` → `makeManualEvent(model, new Date())` → synchronous render, **no fetch/feed/storage** (mirrors the existing demo path).
- `config.event === DEMO_SLUG` → `makeDemoEvent`.
- `config.event` (slug) → `startEventFeed` (RaidPal).
- neither → the existing missing-source console error.

`event` and `lineup` are **mutually exclusive**, with explicit precedence (event wins if both somehow appear), pinned by a test. Everything downstream is source-blind. The two authoring modes inject a `buildQuery` into the shared form controller, so the only code that knows `event=` vs `lineup=` is each mode's small adapter.

### Module map

| File | Kind | Responsibility |
|---|---|---|
| `src/lineup-codec.js` | new | `encodeLineup(model)→base64url(JSON)` / `decodeLineup(str)→model\|null`. Versioned, compact short keys, **defensive — never throws, returns `null`** on bad/oversized/unknown-version input (a bad blob renders nothing, never broken UI). No DOM. Conceptually paired with `config.js` serialize/parse. |
| `src/manual-lineup.js` | new | Pure domain core lifted from the prototype: `normalizeHandle`, `parseLine`, `makeManualEvent(model, now)→Event`. **Emits NO `broadcaster.id`** so [`mergeRuns`](../../../src/lineup-engine.js) (id-authoritative) collapses back-to-back same-handle slots by name. GCD base-slot expansion. Owns the wall-clock-in-zone→absolute-instant helper (via `resolveZone`). Paired with `demo-event.js`. |
| `src/config.js` | modified | `parseConfig` adds `lineup` = raw `?lineup=` string or null (**no decode here** — keeps config codec-free; the shell decodes). `serializeConfig` emits `lineup=` in a fixed canonical position (right after `event`). event/lineup mutual exclusion. `resolveZone` reused unchanged. |
| `src/overlay-shell.js` | modified | The 3-way source resolve above. The `rto-preview` postMessage handler re-runs the resolve so a manual preview updates in place. |
| `src/configurator.js` | modified | `buildOverlayQuery` gains a source branch: a manual lineup → `params.set('lineup', encodeLineup(model))`; otherwise the existing `extractSlug`→`event` path verbatim. Still round-trips through `serializeConfig(parseConfig(draft))` so all other knobs validate identically. |
| `src/preview-frame.js` | extracted/extended | Generalize `createPreviewFrame`'s slug identity arg to a generic `sourceKey` (slug for RaidPal; a short hash of the encoded lineup for manual) so an event⇄lineup switch *or* a lineup edit triggers iframe-reload-vs-postMessage correctly. Then **delete `configurator.html`'s inline duplicate** and consume this (closes the divergence its own header documents). |
| `src/configurator-form.js` | extracted | Lift `readForm`/`writeForm`/`updateMisc` out of the inline script into a tested module taking an `els` map. Both source modes share it; only the lineup-source widget differs. Behavior-preserving move. |
| `src/lineup-source.js` | new (optional, Phase 2) | `resolveLineupSource(config)→{kind:'static',event}\|{kind:'feed',start()}`. Pure refactor of the proven shell branch for its own focused test. Ship or skip without behavior change. |
| `configurator.html` | modified | Source toggle in the hero; absorbs the prototype's timeline+table+paste editor + event-title/organiser/avatar/start + **event-timezone selector**. Copy-gate widens to `has('event')||has('lineup')`; `refreshPreview` gates slug-validation behind `source==='raidpal'` and short-circuits manual mode to `loadPreview`. Settings tabs, presets, OBS section reused untouched. |
| `index.html` | modified | A clear second door: "No RaidPal? Build a lineup by hand" alongside the RaidPal path; plain-language framing. |
| `manual-prototype.html` | delete | Absorbed into `configurator.html` + `src/manual-lineup.js`. |

## `?lineup=` wire format

`?lineup=<base64url(JSON)>`, mutually exclusive with `?event=`. Compact, editor-friendly (durations, not expanded slots), **versioned**:

```json
{ "v": 1,
  "t": "Saturday Bass Train",
  "o": { "n": "djhost", "i": "https://…/avatar.png" },
  "z": "America/New_York",
  "s": "2026-06-27T00:00:00.000Z",
  "d": [ { "h": "nikkid", "d": 120 }, { "h": "basslines", "d": 60 } ] }
```

- `t` title · `o` organiser `{n: handle, i: optional avatar URL}` · `z` authoring IANA zone (round-trip fidelity for re-editing; the overlay needs only `s`) · `s` absolute ISO instant of the first set · `d[]` per-DJ `{h: handle, d: durationMins}`.
- `base64url` (url-safe, no padding) survives a query value unescaped and pastes cleanly into OBS.
- `makeManualEvent` computes `baseSlotMins = gcd(all durations)` (always a 30-multiple given the duration presets), sets `event.slotDurationMins = baseSlotMins`, and emits `durationMins/baseSlotMins` consecutive **id-less** same-handle slots per DJ.

## Timezone handling

The editor adds an **event-timezone selector** defaulting to the browser zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), canonicalized via the existing `resolveZone`. Wall-clock start + zone → a single absolute instant using a small, unit-tested helper (format a candidate UTC date in zone `Z` with `Intl`, read the observed offset, correct it). Storing **absolute** instants (not deferred wall-clock) is load-bearing: relative times (`"in 2h"`) are correct for any viewer's machine clock, and the viewer-facing `tz=` multi-zone display formats the stored instant with no change. Authoring zone (a property of the lineup) and display zones (the viewer's `tz=` knob) never conflict because the wire format is absolute. DST gap/ambiguous starts resolve to the earlier valid instant.

## Manual editor UX (in the configurator, "Build by hand")

Absorbed from the prototype's locked B1+B3 direction:
- **Timeline strip** (proportional blocks, NOW marker, drag-to-reorder) over a **refined table** (drag rows, per-DJ "plays for" dropdown, auto-computed clock times in the event zone, `@`/`twitch.tv` handle cleanup, duplicate/empty warnings, totals).
- **Paste a list** secondary add-tool (one handle per line, `×2` shorthand → appends).
- Event title, organiser handle + optional **avatar URL**, start time, **timezone**.
- **Live preview** (the shared iframe) + the shared theme/motion/etc. settings tabs.
- **The overlay link is the save file**: opening the configurator with a `?lineup=…` rehydrates the editor for editing and re-copy. Plus **localStorage auto-save** so a refresh never loses work, and presets that capture the full lineup.

## Migration phases (each keeps `node --test` green)

- **Phase 0** — baseline: confirm 126 green; snapshot configurator behavior for the Phase-3 side-by-side.
- **Phase 1** — overlay capability (pure, fully testable, **zero `configurator.html` edits**): `lineup-codec.js` + `manual-lineup.js`; `lineup` field in `parseConfig`/`serializeConfig` (+ mutual exclusion); the `config.lineup` branch in `overlay-shell.js`. **After Phase 1 a hand-crafted `?lineup=` URL renders a fully-themed overlay.**
- **Phase 2** — optional `lineup-source.js` seam (ship or skip).
- **Phase 3** — extract `configurator-form.js`; de-duplicate the inline preview to the generalized `preview-frame.js`; `buildOverlayQuery` source branch (still defaults to RaidPal → identical behavior). Pure moves.
- **Phase 4** — the Source toggle + manual editor + timezone selector; widen Copy-gate; gate slug-validation; landing-page link; **delete `manual-prototype.html`**.
- **Phase 5** — i18n (new manual/timezone keys across all 10 locales — machine-translated drafts flagged for native review, guarded by the completeness test + `i18n-lint`); update `CONTEXT.md` for the `?lineup=` schema.

## Testing strategy

- `test/lineup-codec.test.js` — round-trip idempotency, `decode→null` on bad/oversized/unknown-version input.
- `test/manual-lineup.test.js` — Event-shape parity with `normalizeEvent`; GCD expansion; **back-to-back merge via `buildTrain` with NO id**; spring-forward + fall-back DST instant math; clock-zone-independent relative times.
- `test/config.test.js` — `lineup` round-trip + event/lineup mutual exclusion + serialize position idempotency.
- Phase 3 extractions guarded by existing `configurator.test.js` + a manual side-by-side (pure moves, no logic edits).

## Top risks

- **`broadcaster.id` regression** — `makeManualEvent` must emit no id (else merge logic changes); pinned by a "no id → merges by handle" test.
- **DST wall-clock→instant** — highest-correctness-risk; the `resolveZone`-backed offset helper with explicit gap/ambiguous tests.
- **URL length** — compact durations model + short keys + ~40-DJ warning + oversize `decode→null`.
- **Phase 3 extraction drift** — the roll/freeze state machine, `history.replaceState`, debounce, the empty-field demo fallback, locale rebinding; mitigate with pure moves + side-by-side.
- **Preview iframe identity on source switch** — event⇄lineup (and lineup edits) must force iframe reload via `sourceKey`, not postMessage.
- **Codec versioning** — `v:1` is frozen into shareable OBS URLs; unknown versions decode to null; a future `v:2` must read or gracefully reject `v:1`.
