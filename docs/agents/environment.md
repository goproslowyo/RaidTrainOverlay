# Environment notes for agents

Operational facts about working on this repo that the code does not record and that
each session otherwise rediscovers the hard way. Not a style guide — `CONTEXT.md` is
the domain language and `docs/authoring-a-theme.md` is the Theme contract.

## Verifying anything visual

**The in-app browser pane reports a zero viewport and a frozen animation clock.**
`innerWidth` is `0`, so `vw`/`vh` resolve to nothing and any layout measured there is
garbage — a marquee duration computes as `NaN`, which mimics a regression that is not
real. Never diagnose layout or motion from that pane.

**The workaround that does work: same-origin iframes sized in explicit pixels.** An
iframe has a real viewport, so viewport units resolve correctly inside it.
`test/manual/anchor-cell-measure.html` carries the idiom, and
`docs/research/cell-rule-nine-anchor-sweep.md` is a worked example.

**For animation phase, use headless Chrome and await `ready`.** An animation's
`startTime` is `null` until the flush, so reading it earlier gives a false `0`. Measure
the zero-progress moment as `startTime + effect.getTiming().delay`, which folds in a
negative `animation-delay` correctly.

**Always include a negative control.** A zero offset from a probe that cannot detect
divergence is not evidence. Break the thing deliberately, confirm the probe sees it,
then trust the real reading.

## Running the app

Start the dev server from `.claude/launch.json` (`overlay`, port 8321). It sets
`Cache-Control: no-store` on purpose — module JS caches aggressively and a stale
Overlay will lie to you. Never start a dev server from a shell.

If another session already holds 8321, it may be serving a different working copy.
Confirm which tree you are talking to before trusting a result — fetch a file that only
exists on your branch.

## Tests

`npm test` is exactly `node --test`, no flags, no config. Keep it that way.

**Check the real exit status.** `npm test | tail` reports `tail`'s status, not the
suite's, so a failing run reads as success. Use `npm test > /tmp/x.log 2>&1; echo $?`.

**A fresh worktree needs `npm ci` (or `npm install`) first.** `linkedom` is a
devDependency — the repo is no longer dependency-free — and without it the DOM-seam
suites fail in a way that looks like a real regression.

`node --test` has no layout engine, and the two ways that shows are not the same.
Measured under `linkedom`: `offsetWidth` and `offsetHeight` are **`undefined`** — the
properties do not exist at all, so arithmetic on them is `NaN` rather than 0 — while
`getBoundingClientRect()` does return an object, of zeros. The **Cell** rule as
painted, the geometry lock and every measured **Footprint** stay browser-only. Never
report a green suite as covering them.

**`linkedom` does not parse CSSOM values, so it stores whatever you write.** Setting
`style.animationDelay = "-1s; background-image:url(//evil)"` keeps the whole string
verbatim and hands it back on read. A real browser refuses: a named-property setter
parses exactly one value and drops anything it cannot, and only `cssText` parses a
declaration list. So the safety of every CSSOM property write in this repo rests on
real-browser behaviour that `node --test` cannot model — a test that asserts a
property write is clean has asserted nothing about a browser.

Serialization differs the same way, which bites when a browser harness is written
against a suite's expectations. `linkedom` returns the literal you wrote; Chrome
returns the CSS serialization of the parsed value — measured, `-3.989s` survives but
`-0.000s` comes back as `0s`. Assertions on exact delay strings are seam-shaped and do
not port.

**A generated base rule that outranks a presence keyframe kills the feature, and
the suite reads green either way.** Presence in this repo is a CSS animation, and
an animation outranks any normal author declaration whatever its specificity —
which is the only reason `#gap-card { opacity: 0; }` can sit under
`.rt-gap-card--on`'s keyframe. Add `!important` to that base and it outranks the
animation instead: the layer is pinned at 0 forever and the **Upcoming card**
never appears again. Measured, Chrome reads the card's mid-window opacity down
from 1.000 to 0, and the suite that was guarding the rule stayed green
throughout. `node --test` has no cascade, so a substring match on a stylesheet
cannot tell a rule that works from one that silently wins too hard, nor which
block it landed in. Assert the exact declaration, assert it is **outside every
at-rule** rather than outside one named one, and strip CSS comments first, since
a comment quoting a rule matches like the rule. `src/gap-card.js`'s sheet is
guarded that way now; the lesson generalises to every generated stylesheet in
this repo, none of which is.

**Three ways that guard went vacuous, all of them green, all worth copying as a
checklist.** *(1) A split the test does not insist on.* It was
`indexOf('@media (prefers-reduced-motion: reduce)')` with an `at === -1`
fallback — a literal string. Drop the space after the colon (legal CSS, and what
any reformat produces) and the search misses, the "base" half silently becomes
the whole sheet, the "reduced" half becomes empty, and every assertion
downstream passes against the very mutant it was written for. Find the block by
pattern, and fail if the split did not happen. *(2) The wrong property.* "Not in
the reduced-motion block" is not the rule; "not behind any condition" is —
wrapping the base in `@media print { … }` clears the first bar and still hands a
normal viewer no base. Brace-match the at-rules out and assert on what is left.
*(3) A guard bound to one spelling.* `/#gap-card \{[^}]*!important/` needs the
literal space, so the minifier spelling `#gap-card{opacity:0!important}` walks
straight past it. Assert the rule (`/!\s*important/` anywhere in the sheet), not
one hand-written way of breaking it.

**A guard that only says what must NOT be in a block never says the block must
exist.** Every assertion on gap-card's reduced-motion block was a
`doesNotMatch`, so deleting the whole block was green — and with
`--force-prefers-reduced-motion` Chrome then reads the card at 1.000 where the
shipped build reads 0.000: the accommodation silently gone, the card pulsing
over a live stream for the one viewer who asked it not to. Pair every "must not
be here" with a "must be here, and must say this".

**`linkedom` cannot see a class coming off an element as a painted change.** There is
no animation engine and no layout, so a presence class whose removal snaps opacity in
one frame is structurally invisible: the suite can assert which classes are on the
element and what was written to `style`, and nothing at all about what that does to the
picture. #88 — a **Breather** cut short snapping the **Stage** back to full opacity —
was a green-suite bug for exactly this reason. Anything of that shape needs headless
Chrome and a one-frame opacity sweep with the un-fixed build kept as the control.

## Git and GitHub

`gh` must run as **goproslowyo** — two accounts may be authenticated. Check
`gh auth status` if anything 404s unexpectedly.

`origin` is an SSH URL and SSH auth does not work here. Push over HTTPS with the `gh`
credential helper:

```
git -c credential.helper='!gh auth git-credential' push https://github.com/goproslowyo/RaidTrainOverlay.git main:main
```

Releases are **tag-only**. Do not create GitHub Release objects; Pages serves from
`main`.

`main` is published. Reconcile additively — merge or cherry-pick, never force-push.

## Writing commit messages from a shell

Backticks inside a double-quoted `git commit -m` are command substitution: zsh will
silently eat the quoted span. Write the message to a file and use `git commit -F`.
