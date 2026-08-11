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

`node --test` has no layout engine: `offsetWidth`, `offsetHeight` and
`getBoundingClientRect()` all return `0`. The **Cell** rule as painted, the geometry
lock and every measured **Footprint** stay browser-only. Never report a green suite as
covering them.

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
