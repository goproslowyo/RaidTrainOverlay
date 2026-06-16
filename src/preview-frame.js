/**
 * createPreviewFrame — a reusable, framed Overlay preview controller.
 *
 * It drives an <iframe> that shows overlay.html?…&preview=1 (a still, centred
 * showcase of the whole Train) and wires the Roll → Freeze → Resume + Recenter
 * controls over the Overlay's `rto-preview` / `rto-preview-pause` postMessage
 * protocol. The host page owns the markup + styling (one <iframe> and two
 * <button>s); this owns the behaviour. Used by the standalone preview page; it
 * mirrors the Configurator's hero preview (which keeps its own inline copy).
 *
 *   render(query, slug) — show this Overlay query. A new slug (or the first call)
 *     (re)loads the iframe — the ONLY path that fetches RaidPal; a same-slug knob
 *     change re-renders in place via postMessage (no reload, no refetch, no flicker,
 *     and nothing that nudges a browser's auto-hidden chrome, e.g. Zen's sidebar).
 *   reset()             — drop back to the empty/placeholder state (clears the iframe).
 *
 * Roll states: 'still' (centred showcase) | 'rolling' (sweeping across) | 'frozen'
 * (sweep paused IN PLACE — wheels + undulation keep going, "running on the spot").
 * A re-render restarts the sweep, so a frozen preview returns to rolling on any knob
 * change — mirroring the live Overlay.
 */
export function createPreviewFrame({ iframe, rollBtn, stillBtn, overlayBase, origin = window.location.origin }) {
  let rollState = 'still';
  let loadedSlug = null; // event currently (re)loaded in the iframe (null = placeholder)
  let baseQuery = '';    // overlay query baked into the iframe's current src
  let lastQuery = '';    // latest overlay query the frame represents

  const post = (msg) => iframe.contentWindow?.postMessage(msg, origin);

  function updateButtons() {
    rollBtn.innerHTML = rollState === 'rolling' ? '⏸&nbsp;Freeze'
      : rollState === 'frozen' ? '▶&nbsp;Resume' : '▶&nbsp;Roll it';
    rollBtn.classList.toggle('is-rolling', rollState !== 'still');
    if (stillBtn) stillBtn.hidden = rollState === 'still';
  }

  function render(query, slug) {
    if (slug !== loadedSlug || !iframe.getAttribute('src')) {
      // Event changed (or first load): (re)load the iframe.
      iframe.src = `${overlayBase}?${query}&preview=1`;
      loadedSlug = slug; baseQuery = query; lastQuery = query;
      return;
    }
    if (query !== lastQuery) {
      // Same event, a knob moved (theme/scale/mode/…): re-render in the SAME document.
      if (rollState === 'frozen') { rollState = 'rolling'; updateButtons(); }
      post({ type: 'rto-preview', query, roll: rollState !== 'still' });
    }
    lastQuery = query;
  }

  function reset() {
    rollState = 'still'; loadedSlug = null; baseQuery = ''; lastQuery = '';
    if (iframe.getAttribute('src')) iframe.removeAttribute('src');
    updateButtons();
  }

  // When the iframe finishes (re)loading its Event, re-apply the roll state and any
  // config that moved on while it was loading — a fresh iframe always (re)loads as a
  // still showcase, so a rolling preview must be re-asserted here; this also covers a
  // postMessage that arrived before the Overlay was listening.
  iframe.addEventListener('load', () => {
    if (rollState === 'frozen') { rollState = 'rolling'; updateButtons(); }
    if (rollState === 'rolling' || (lastQuery && lastQuery !== baseQuery)) {
      post({ type: 'rto-preview', query: lastQuery, roll: rollState === 'rolling' });
      baseQuery = lastQuery;
    }
  });

  // Roll it → Freeze → Resume (one button), plus Recenter. Roll sweeps the whole train
  // across; Freeze pauses that sweep IN PLACE (wheels + undulation keep going) so you can
  // study it; Resume continues from there; Recenter drops back to the still showcase.
  rollBtn.addEventListener('click', () => {
    if (!loadedSlug) return;
    if (rollState === 'still') { rollState = 'rolling'; post({ type: 'rto-preview', query: lastQuery, roll: true }); }
    else if (rollState === 'rolling') { rollState = 'frozen'; post({ type: 'rto-preview-pause', paused: true }); }
    else { rollState = 'rolling'; post({ type: 'rto-preview-pause', paused: false }); }
    updateButtons();
  });
  if (stillBtn) {
    stillBtn.addEventListener('click', () => {
      if (!loadedSlug) return;
      rollState = 'still';
      post({ type: 'rto-preview', query: lastQuery, roll: false });
      updateButtons();
    });
  }

  updateButtons();
  return { render, reset };
}
