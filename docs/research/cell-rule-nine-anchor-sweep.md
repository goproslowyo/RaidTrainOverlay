# The Cell rule, measured as painted — nine anchors, both Footprints

> **The rule this measures was relaxed on 2026-08-12 — the numbers below are a record, not the current contract.** The owner restated the 3×3 grid as a *suggested anchor point*: a card may overflow into the neighbours it sits next to, so the ceiling is now the anchor's own **Cell** plus every neighbour it can grow toward on that axis (three for a centre position, two for an edge). The **card view** uses that room, because the **Upcoming card**'s type was raised for legibility at stream distance and three titles no longer fit a third of a 1080p scene. The **scrolling view** still keeps a single Cell — see `oneCellWidth` in `src/upcoming-card.js` for why. What is still true here, and was the point of the sweep: the ceiling is real, it is anchor-dependent, and the pad comes out of it rather than adding to it.

Measurement record for [#79](https://github.com/goproslowyo/RaidTrainOverlay/issues/79)'s browser-sweep criterion: *"both **Footprint**s land in the same **Cell** as before, at every anchor"*. That criterion cannot be reached by `node --test` — no DOM implementation has a layout engine — so it lived unticked until this sweep.

Run 2026-08-10, against the tree that landed #78–#84.

## What the Cell rule is

`CONTEXT.md`: a **Cell** is one ninth of the **Stage**, three columns by three rows, and all the room an **Upcoming card** at one of the nine `uppos` anchors may take. An item at one anchor must not bleed into another column or row, whichever **Footprint** it wears and whatever size the scene is.

The `pad` that holds the panel off the screen edge comes **out** of the cell rather than adding to it, so the panel's real budget is the cell minus twice the pad. Both boundaries were checked separately.

## Method

Headless Chrome. Every measurement taken inside a **same-origin iframe sized in explicit pixels** — the in-app browser pane reports `innerWidth === 0`, so anything measured there is garbage. The real card was mounted through the real module (`renderUpcomingCard`), not a stand-in.

Three source trees were measured side by side, each served from its own `git archive` of the whole `src/` tree, so row-building differences count too and not just the card:

- **base** — the merge-base, `d28bb94`, the true "before"
- **main** — `main`'s own implementation of #79 (`5ad3f3e`)
- **new** — the parallel branch's implementation

The third is worth explaining: two sessions implemented #79 independently, so `main` is a *sibling* of the branch rather than its ancestor. Comparing against only one of them would have answered the wrong question.

## Matrix

9 anchors × 2 **Footprint**s × 3 scene sizes × 2 title sets = **108 rows per tree, 324 measured rows.**

| Scene | Cell | Budget box (cell − 2×pad) | Painted panel, every anchor | Bleed |
|---|---|---|---|---|
| 1920×1080 | 640.0 × 360.0 | 592 × 312 | card 591.98 × 149, ticker 591.98 × 42 | **0** |
| 1280×720 | 426.7 × 240.0 | 378.7 × 192 | card 378.66 × 149, ticker 378.66 × 42 | **0** |
| 960×540 | 320.0 × 180.0 | 272 × 132 | card 271.98 × 131.98, ticker 271.98 × 42 | **0** |

Every one of the 108 rects sits inside both the strict third boundary and the tighter cell-minus-pad budget. Sample edges: `tl` → left 24; `tc` @1920 → 664.01–1255.99 against a column of 640–1280; `br` @960 → 664.02–936 against a column of 640–960 and a row of 360–540. The pad reads exactly as `anchorStyle` documents it.

## Same Cell as before

| Comparison | Rows differing > 0.5px on any edge | Max edge delta |
|---|---|---|
| new vs merge-base `d28bb94` | **0 / 108** | **0.00 px** |
| new vs `main`'s #79 | **0 / 108** | **0.00 px** |

Not merely "it fits" — byte-identical geometry across all three trees. `anchorStyle`'s source is identical in all three; the #79 change is confined to how `BUDGET.cell` is *constructed*, and every construction emits `33.3333vw` / `33.3333vh`.

## Two cases worth keeping

**960×540 is the only size where either guard does work.** A third of 960 is 320, narrower than the 340px `floor`, so the `min()` makes the floor yield to 272. The card's height also clips at 131.98 — the `max-height` is genuinely binding there, not nominal. Holds in all three trees.

**A long title changes nothing.** A ~130-character train name produced rects identical to the normal fixture at every anchor and size: `max-width` binds first, and the ellipsis plus `min-width: 0` absorb the rest. The case most likely to burst a **Cell** does not.

## Negative control

A zero result is worthless if the probe cannot see a failure. A deliberately broken variant — pad restored *into* the cell, and a hard 340px floor instead of the `min()` — was run through the identical matrix:

**84 of 108 rows bleed, worst overflow 44.00 px** (960×540, card, `tl`: right edge 364 against a column ending at 320).

The probe detects bleed when bleed exists. That is what makes the zeros above readings rather than silence.

## Not measured

Stated rather than inferred:

- **The Configurator's Preview pane.** #79's other browser-sweep clause. This sweep measured the **Stage** only.
- **Any locale but English.** The `@media (max-width: 1709px)` rule that hides the eyebrow is tuned to the English label; a longer locale above 1710px falls back to the 40% cap, which this sweep did not exercise.

## Reproducing

`test/manual/anchor-cell-measure.html` is the in-repo harness for this measurement. It carries the same-origin-iframe idiom; the tolerance note in it explains why an exact third is a rounding hair away.
