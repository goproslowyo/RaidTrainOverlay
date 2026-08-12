/**
 * stage-clock: the clock every generated keyframe on the Stage is phased
 * against, taken from the Document that Stage was built into.
 *
 * One argument, one decision hidden behind it — which clock, from which window,
 * and why not the three obvious alternatives. That decision has cost two bugs
 * already (#88, and the **Upcoming card**'s half of the same thing), so it is
 * stated once here rather than argued twice. Two exports carry it: the clock
 * itself, plus `stageClockIsMonotonic`, the predicate a test asks which branch a
 * Document took. They are one branch read twice, not two — `stageClock` calls
 * the predicate, so the two cannot drift into disagreeing about the same
 * Document.
 *
 * WHERE THIS LIVES, and the two homes it was not given. Neither rejection is a
 * seam that would break: measured, routing the clock through
 * `train-renderer.js` leaves all 32 of `test/gap-card.test.js` green, and so
 * does putting it in `gap-choreography.js` and threading a Document through —
 * the whole suite stays green there too. The commit that created this module
 * said the renderer route "would break the stub-handle seam"; that claim was
 * never true and is corrected here rather than repeated.
 *
 * The real argument is the module graph. `gap-card.js` reaches 6 modules and
 * ~68 KB; `train-renderer.js` reaches 22 and ~414 KB, because it pulls the
 * Theme registry and every **Theme**'s art in behind it. Exporting the clock
 * from the renderer would make the choreographer depend on the thing it
 * choreographs, and drag all of that art along for one property read. And
 * `gap-choreography.js` opens by declaring "no DOM, no layout, no clock" — a
 * function taking a Document falsifies that contract in its first line, which
 * is the whole of its depth. Both doors are shut for reasons that hold; only
 * the reason first written down was wrong.
 *
 * WHY NOT THE WALL CLOCK. `rt-breather` and `rt-gap-card` are both timed by the
 * **document timeline**, which is monotonic and anchored at its window's
 * `timeOrigin`. `Date.now()` is a different clock altogether, and the two
 * diverge on exactly the machines these fixes exist for: an OBS source runs for
 * days, Windows STEPS rather than slews once NTP is more than 128 ms out, and a
 * resume from suspend or a manual clock change does the same.
 *
 * Measured in headless Chrome against the wall-clock build. The Breather, skew
 * driven at the moment the switch is thrown (trackfadeout:45 trackfadein:12
 * upcycle:60, the Stage painting 0.3326): -20s stepped the Stage 0.44416 in one
 * frame, +20s blinked it to black by 0.33259, and -100s reproduced #88 exactly
 * at 0.6674 — the same reading, to four places, as ripping the class off
 * (0.66742). The card, skew driven at the moment the **Horizon** refills, at
 * the shipped defaults (a 900s Pass, the Train on stage across [885,900) and
 * [0,60)), as the share of the Train's time on stage the card is painted over:
 * in phase 0.0%, -100s step 18.0%, a suspend-resume -1h 50.7%, +140s 50.3% —
 * and on a 60s Pass, a -30s step over 20s elapsed put the card over the Train
 * for 100% of its traversal, at full opacity.
 *
 * `performance.now()` shares `timeOrigin` with `document.timeline`, so it IS
 * that timeline read as a number.
 *
 * WHY FROM THE DOCUMENT, never the ambient global. The same rule `applyMode`
 * and the Theme contract already follow, because a Train mounts anywhere: hand
 * `renderTrain` a container from an iframe or a constructed Document and the
 * whole Stage is built there. Stated honestly, this is correctness by
 * construction rather than a bug fixed — every window has its own `timeOrigin`,
 * but only DIFFERENCES of this clock are ever taken and an origin cancels out
 * of a difference, so the parent page's `performance.now()` would currently give
 * the same elapsed. What it would not survive is comparing the epoch against a
 * TIME rather than another epoch, which is counted from the mount Document's
 * window and no other. Taking the clock from the Document costs one property
 * read and closes that off.
 *
 * WHY NOT THE ANIMATION'S OWN `currentTime`, which would be truer still and
 * would delete the epoch entirely: `getAnimations()` does not exist under
 * `linkedom`, so it would put every phase case beyond the seam these rules are
 * tested at. That is the whole of the reason. An earlier note here also claimed
 * it "reads null until the first flush"; measured at the instant a class lands,
 * before any flush, `getAnimations()` returns one animation with playState
 * "running" and `currentTime` 0 — it is `startTime` that reads null. The claim
 * was wrong and is not why the door is shut.
 *
 * WHY NOT `doc.timeline.currentTime`, which an earlier note called the obvious
 * next step: `linkedom` has no `document.timeline` at all, while it DOES expose
 * `defaultView.performance.now`. Switching would leave this permanently on its
 * `Date.now` fallback under test, so every phase case in the suite would
 * exercise the branch that does not ship — the same objection that shuts the
 * `getAnimations()` door, and a stronger one.
 *
 * The fallback is deliberate, and only reachable where nothing paints: a
 * constructed Document has no `defaultView`, and its animations never tick, so
 * there is no timeline for `Date.now` to disagree with. It is never a browser's
 * answer, and `stageClockIsMonotonic` is how a test says which branch it got
 * rather than pretending the fallback is covered.
 */

/**
 * Whether `doc` gives the monotonic clock or the `Date.now` fallback. The
 * branch itself, written once: `stageClock` asks it rather than re-deciding,
 * so the answer a test gets is the answer the clock acted on. Exported because
 * a test has to be able to assert WHICH branch a Document takes — a suite that
 * only ever exercised the fallback would be green about a clock the browser
 * never uses.
 */
export function stageClockIsMonotonic(doc) {
  return typeof doc?.defaultView?.performance?.now === 'function';
}

/** The clock `doc`'s generated keyframes run on, as a function of no arguments. */
export function stageClock(doc) {
  const view = doc?.defaultView;
  return stageClockIsMonotonic(doc) ? () => view.performance.now() : () => Date.now();
}
