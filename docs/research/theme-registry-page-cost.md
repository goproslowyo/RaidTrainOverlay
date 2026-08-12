# What the Theme roster costs the landing page and the Configurator

Measurement record for [#76](https://github.com/goproslowyo/RaidTrainOverlay/issues/76). [#70](https://github.com/goproslowyo/RaidTrainOverlay/issues/70) made `src/config.js` and `src/settings-schema.js` import `src/themes/registry.js`, which statically imports all 16 **Theme** modules. `overlay.html` already paid for that art because it paints **Train**s; `index.html` and `configurator.html` want the roster's keys and labels and now parse the art to reach them. That is exactly what #70 specified, so this is not a defect report. It is the number nobody had.

Run 2026-08-11 against the Pages deployment at `8227b06`. `index.html`, `configurator.html`, `src/config.js` and `src/themes/registry.js` were fetched from Pages and are byte-identical (`shasum`) to the tree measured, so the deployment is the tree.

## The threshold, stated before the numbers

Assumed, not derived — it is the bar this record is judged against and it belongs in the open:

- **noticeable in time** = the roster adds more than ~100 ms to the Configurator's time-to-interactive on a cold load;
- **noticeable in weight** = more than ~50 KB actually crosses the wire that otherwise would not.

Either one crossed means it costs.

## What the roster import actually is

`config.js` and `settings-schema.js` → `registry.js` → 15 single-file **Theme**s + `starter/index.js` → `shared-svg.js` and `shared-html.js`. **19 modules, three waterfall levels below the page**, 372,579 bytes decoded, **131,799 bytes transferred** under Pages' gzip. Nothing else on either page reaches the art: with the roster taken out, exactly one file under `src/themes/` is still requested, and it is the keys-and-labels module itself.

## Surfaces, and why each answers its own question

| Question | Surface | Why |
|---|---|---|
| Bytes, and whether they'd be spent anyway | **Pages** | The answer is decided by `cache-control: max-age=600`, which only the deployment sends. The dev server sends `no-store` on purpose (`.claude/launch.json`), which would have answered the opposite. |
| Does the iframe dedupe | **Pages** | Same reason, and it is the whole trap in the ticket. |
| Cold time-to-interactive | **Pages**, treatment vs control | Real headers, real CDN, real RTT. |
| Parse/evaluate alone | **loopback** | The only way to see compile cost with the network taken out of it. |

## Instrument

Headless Chrome 151 (`--headless=new`), driven over the DevTools Protocol from a small client (`node:WebSocket` → the browser endpoint; no Puppeteer, no dependency added to the repo). **Every timed run is a brand-new `--user-data-dir`**, so the HTTP cache, the V8 code cache and the profile are all genuinely cold. Per run:

- `Network.*` events for the ledger — one record per request with its frame, its `encodedDataLength`, and whether it was answered from the memory or disk cache. This is the browser's own accounting, not the page's, so it sees iframe traffic the parent's `performance` timeline cannot.
- `performance.getEntriesByType('resource'|'navigation'|'paint')` for per-module transfer sizes and the waterfall.
- A `MutationObserver` injected with `Page.addScriptToEvaluateOnNewDocument`, recording the instant the Configurator first fills `#main` (its UI painted — the closest honest proxy for "the streamer can start") and the instant the landing page sets its example iframe's `src`. Injected identically in both arms; it changes no source.

Arms are **interleaved and their order reversed on alternate repetitions**, and every timing figure below is a **paired** delta within a repetition, which cancels drift. Medians and interquartile ranges throughout; a single sample is not a reading.

## The negative control

The counterfactual is the split the ticket describes, built and measured rather than imagined: a keys-and-labels module with no imports, exporting `SHIPPED_THEMES`, `THEME_KEYS` and `optionKeyFor`.

On Pages it is applied **at the wire**: `Fetch.requestPaused` on `*/src/themes/registry.js`, fulfilled with that module's text. Same deployment, same headers, same CDN, same everything else — one response body differs. Interception is armed in both arms (the treatment continues the request) so the interception itself is not one of the differences. The control's validity check is that the page comes out the same: **`document.body.innerHTML.length` is 143,948 in both arms, every run**, and the Theme option map has 16 entries in both.

A control that removes something is only half a control, so a third arm inflates instead: **x3**, the same tree with every **Theme** module copied twice more — 48 art modules, 1.1 MB — and the offered roster held at 15 so the pages render identically. If the probe cannot see three times the art, it has no standing to report one times the art as free.

## Bytes — the Configurator, on Pages

Cold first visit. n=18 paired runs.

| | control (roster only) | as shipped | delta |
|---|---|---|---|
| Requests under `src/themes/` | 1 | 19 | **+18** |
| Bytes for those | 615 | 131,799 | **+131,184** |
| **Whole page, everything, on the wire** | **198,204** | **327,948** | **+129,744 (+127 KB)** |
| Rendered DOM length | 143,948 | 143,948 | 0 |

Deterministic — every run of each arm landed within ~100 bytes. The art is **57% of what the Configurator pulls on a cold load**, and on a first visit there is no iframe to have pulled it anyway: the Configurator with no Profile opens in the setup stage, which mounts no **Preview**. Those 127 KB are added, not moved.

## Time — the Configurator, on Pages

Same 18 pairs.

| Metric | control | as shipped | paired delta (median [p25 – p75]) |
|---|---|---|---|
| First contentful paint | 492 [426 – 534] | 456 [418 – 502] | **−20.0** [−101 – +18] |
| DOMContentLoaded | 461 [391 – 489] | 480 [450 – 517] | **+13.9** [−5.6 – +99.5] |
| **UI painted (`#main` filled)** | 505 [450 – 541] | 531 [504 – 570] | **+12.9** [−28.9 – +95.6] |
| Load | 577 [540 – 636] | 572 [504 – 638] | −18.1 [−105 – +38] |

**+13 ms at the median on the metric a streamer would feel**, with three quarters of pairs under +100 ms and the upper quartile brushing that line. FCP is untouched because the paint happens before the module graph completes either way.

This is much less than the waterfall's shape suggests, and the discrepancy is worth recording rather than hiding. Measured within single treatment runs against a warm CDN (n=5), the roster subtree is the **last thing to land before DOMContentLoaded in 4 of 5 runs**, extending the pre-DCL tail by 50, −78, 74, 182 and 149 ms. But removing it recovers only ~14 ms of that, because the tail metric assumes the rest of the load stays where it is and it does not — other boot work slides into the gap and becomes the new tail. The paired A/B is the answer to the question; the tail is the reason the guess was that it would be worse.

## Parse and evaluate, on their own

A fresh iframe document per sample (fresh module map) importing `config.js` and `settings-schema.js` with the bytes already in cache — so this is fetch-from-memory + compile + evaluate, and nothing else. n=30 per arm per rate.

| Arm | modules | 1× CPU (ms) | 4× CPU throttle (ms) |
|---|---|---|---|
| control (roster only) | 4 | 0.40 [0.40 – 0.48] | 1.95 [1.63 – 2.55] |
| as shipped (16 **Theme**s) | 22 | 0.80 [0.73 – 0.90] | 3.60 [3.40 – 3.97] |
| x3 (48 **Theme**s) | 54 | 1.50 [1.40 – 1.50] | 6.75 [6.50 – 7.47] |
| **delta, as shipped − control** | +18 | **+0.40** | **+1.65** |
| delta, x3 − control | +50 | +1.10 | +4.80 |

The x3 delta is 2.75× the shipped delta at 1× and 2.9× at 4× against 3× the art, so the probe scales with the payload and the small number is a reading. **Parsing the art is not the cost.** V8 pre-parses lazily and never runs the drawing functions on these pages: 368 KB of **Theme** modules compile in well under two milliseconds even on a four-times-slower CPU. What the roster costs is 18 requests and 127 KB, not compile time.

*Caveat:* V8's compilation cache is warm across samples here, so a first-ever compile is somewhat dearer than this. The cold page-level A/B bounds the whole cost — network, compile and evaluate together — at +13 ms, so the understatement cannot be large.

## Does the iframe dedupe? Yes, and it is the parent that pays now

Measured on Pages, where `cache-control: max-age=600` is real.

| Page | Frame | Requests under `src/themes/` | Bytes | Served from |
|---|---|---|---|---|
| `index.html` | landing page | 19 | 130,179 | network |
| | `overlay.html` iframe | 19 | **0** | memory cache, all 19 |
| `configurator.html`, returning streamer | Configurator | 19 | ~130,200 | network |
| | `overlay.html` iframe #1 | 19 | **0** | memory cache, all 19 |
| | `overlay.html` iframe #2 | 19 | **0** | memory cache, all 19 |

Three runs of the returning-streamer case, identical every time: 57 requests for 19 modules, one payment. So the ticket's guess was right about the mechanism — and it also inverts who pays. Before #70 the first iframe paid and the parent fetched nothing; now the parent pays and every iframe rides free, because the parent's module graph must finish evaluating before it can set an iframe's `src` at all.

The consequence for the landing page is that **its weight did not change**. In a local A/B where both arms keep a working **Overlay** in the iframe (n=15), total bytes over the wire were 377,403 (control) against 376,795 (as shipped) — a 608-byte *saving*, which is the stub against the real `registry.js` and nothing more. The art was always going to be fetched by that page; #70 only moved which frame asks.

For the Configurator it depends on the view. Setup, and the Everything home view, mount no **Preview** — those 127 KB are pure addition. The Simple home view does mount one, and there the art would have been fetched a moment later anyway.

## What failed, and is reported as failure

**The loopback page-level A/B could not resolve the effect and its own sensitivity control proved it.** Three arms × two pages × {1×, 4× CPU}, 15 and 9 repetitions, served on 8376 with Pages-like `max-age=600`: the x3 arm — carrying 1.1 MB and 51 extra modules — came out **faster** than the control in three of the four sweeps (configurator 4×: −72 ms; index 1×: +2 ms; index 4×: −45 ms). Load average on the measuring machine was ~6. Over loopback there is no round trip to pay for and the noise floor (±70 ms interquartile, ±300 ms range) sits far above the effect, so these runs are blind, not zero. They are recorded here so nobody re-runs them expecting an answer.

**The landing page's Pages A/B failed its plausibility check.** At n=7 the treatment came out faster than the control on every metric (FCP −108 ms, iframe-src −75 ms, DCL −64 ms), which 130 KB of extra download cannot buy. The arms also differed by 25 ms at `domInteractive`, before any module is evaluated, which is the signature of network drift rather than of the thing under test. The landing page's **weight** question is answered above and stands on a deterministic byte ledger; its **timing** question is not answered by this run.

## Verdict

**It costs — in bytes, on the Configurator, and not in milliseconds anywhere.**

- Weight: **+129,744 bytes (+127 KB) on a cold Configurator load**, 2.6× the 50 KB bar, and genuinely additional on any visit that mounts no **Preview** — which includes every streamer's first one. Crossed.
- Time: **+13 ms median to the Configurator's UI, +14 ms to DOMContentLoaded**, upper quartile ~+96 ms. Not crossed, and not close at the median. Parse/evaluate alone is +0.4 ms, or +1.7 ms on a four-times-slower CPU.
- Landing page: **no change in bytes at all** (−608 B) and no trustworthy timing reading. Nothing to answer for.

Both halves belong in the summary, because a follow-up justified on weight and sold on speed would be sold on a number that is not there. Nobody will *feel* the roster on the Configurator. They will pay 127 KB for it on a first visit, on a phone tether as easily as on fibre.

Whether 127 KB of art a page does not paint is worth reintroducing a second list to avoid is a judgement about the drift #70 closed, not a further measurement — and it is worth noting that the same 127 KB is paid by the **Overlay** itself, in OBS, to paint exactly one **Theme**. A fix that makes the art map lazy would settle both, and would keep one list.

## Not measured

Stated rather than inferred.

- **Any browser but Chrome 151.** Memory-cache dedupe across frames is browser policy, not a standard.
- **A repeat visit.** Everything here is cold. With `max-age=600` a streamer returning inside ten minutes pays nothing either way; after it, a conditional request per module.
- **The `starter` Theme's `badge.svg`.** It is resolved through `import.meta.url` at render, so it never appears on a page that does not paint.
- **A real slow link.** CPU was throttled 4×; the network was not shaped. The byte figure is the one that matters on a slow link and it is exact.
- **Whether either page's time-to-interactive is *good*.** This measured a delta, deliberately. The absolutes above are one machine's, on one afternoon.

## Reproducing

Everything ran from a scratch directory; nothing here was added to the repo, and the harnesses are described precisely enough to rebuild:

1. **A CDP client** — Node ≥ 22 for the global `WebSocket`; connect to `/json/version`'s `webSocketDebuggerUrl`, attach flat to a fresh target, and enable `Network`, `Page`, `Runtime` and `Fetch`. A fresh `--user-data-dir` per run is what makes a run cold.
2. **The Pages A/B** — `Fetch.enable` on `*/src/themes/registry.js`; `Fetch.fulfillRequest` with the keys-and-labels module in the control arm and `Fetch.continueRequest` in the treatment. Alternate the arms, reverse the order each repetition, pair the deltas. Check `document.body.innerHTML.length` matches across arms or the control is not one.
3. **The parse/evaluate bench** — one page that creates an iframe per sample pointing at a two-line harness that times `Promise.all([import('./src/config.js'), import('./src/settings-schema.js')])` and posts the result back. A fresh iframe document is a fresh module map; the HTTP cache stays warm, so it times compile and evaluate.
4. **The three trees** — the tree as shipped; a control with `src/themes/roster.js` (no imports) taken by `config.js` and `settings-schema.js`, `registry.js` left holding the art for `train-renderer.js`; and x3, the control's registry with every **Theme** file copied twice more. Serve them from one static server on **8376** with `Cache-Control: max-age=600` and gzip — **not** the dev server on 8321, whose `no-store` answers the caching question wrongly by design.
