/**
 * English — the base catalog and source of truth. Every key the app uses lives
 * here; other locales are checked against this set by the catalog-completeness
 * test, and loadMessages merges every locale OVER this so a missing translation
 * falls back to English.
 *
 * Key namespaces:
 *   overlay.*    viewer-facing words painted into the on-stream train art
 *   status.*     departures-board status lamps
 *   departures.* departures-board captions
 *   time.*       relative-time assembly ("in {v}" + compact unit tokens)
 *   configurator.* / landing.*   streamer-facing UI (HTML pages)
 *
 * Overlay words are compact badges stamped onto fixed-width cars — keep
 * translations short so they don't overflow the art.
 */
export default {
  // ── Overlay (viewer-facing, painted into the train) ──────────────────────
  'overlay.now': 'NOW',
  'overlay.open': 'OPEN',
  'overlay.signUp': 'sign up!',
  'overlay.played': 'PLAYED',
  'overlay.conductor': 'CONDUCTOR',
  'overlay.organisedBy': 'ORGANISED BY',
  'overlay.staff': 'STAFF',

  // ── Departures-board status lamps + captions ─────────────────────────────
  'status.onTime': 'ON TIME',
  'status.boarding': 'BOARDING',
  'status.departed': 'DEPARTED',
  'status.lead': 'LEAD',
  'departures.header': 'DEPARTURES',

  // ── Relative time: "in {v}", where {v} = compact units like "2h30m" ──────
  // Unit tokens are single-letter for the fixed-width car; {v} is assembled
  // from them before being dropped into time.in.
  'time.in': 'in {v}',
  'time.d': 'd',
  'time.h': 'h',
  'time.m': 'm',

  // ── Configurator (streamer-facing) ───────────────────────────────────────
  'configurator.title': 'RaidTrainOverlay — Configurator',
  'configurator.sub': 'Enter your event, preview it, then copy the link into an OBS browser source.',
  'configurator.eventLabel': 'RaidPal event',
  'configurator.eventPlaceholder': 'your-event  (or paste the RaidPal link)',
  'configurator.eventHint': "Paste your event's RaidPal link or just type the slug.",
  'configurator.previewTitle': 'Overlay preview',
  'configurator.previewPlaceholder': 'Your live preview appears here once you enter an event.',
  'configurator.previewEnterValid': 'Enter a valid event to see the preview.',
  'configurator.rollTitle': 'Roll the train across — freeze it in place to study (wheels keep turning), resume anytime',
  'configurator.rollIt': 'Roll it',
  'configurator.freeze': 'Freeze',
  'configurator.resume': 'Resume',
  'configurator.stillTitle': 'Back to the centered still preview',
  'configurator.recenter': 'Recenter',
  'configurator.captionPass': 'A still preview so you can study your train. Your overlay uses Pass display — it rolls across every {mins} min.',
  'configurator.captionMarquee': 'A still preview so you can study your train; your overlay scrolls continuously.',
  'configurator.urlPlaceholder': 'Enter an event above to generate your URL',
  'configurator.copy': 'Copy',
  'configurator.copied': 'Copied!',

  'configurator.presets': 'Presets',
  'configurator.presetNamePlaceholder': 'Preset name',
  'configurator.save': 'Save',
  'configurator.load': 'Load',
  'configurator.delete': 'Delete',
  'configurator.noPresets': 'No saved presets yet',

  'configurator.settings': 'Settings',
  'configurator.tabLook': 'Look',
  'configurator.tabMotion': 'Motion',
  'configurator.tabLineup': 'Lineup',

  'configurator.languageLabel': 'Overlay language',
  'configurator.languageHint': 'The language the on-stream overlay shows (NOW, OPEN, times…). Bakes into the URL.',

  'configurator.themeLabel': 'Theme',
  'configurator.theme.classic': 'Classic Americana',
  'configurator.theme.flat': 'Flat cartoon',
  'configurator.theme.synthwave': 'Synthwave',
  'configurator.theme.ticket': 'Vintage ticket',
  'configurator.theme.wood': 'Wooden toy train',
  'configurator.theme.comic': 'Comic / halftone',
  'configurator.theme.departures': 'Departures board',
  'configurator.theme.paper': 'Paper cutout',
  'configurator.theme.tron': 'Tron lightcycle',
  'configurator.theme.pixel': '16-bit pixel',
  'configurator.theme.shuffle': '🔀 Shuffle — cycle every theme',
  'configurator.themeHint': 'The art style that paints your train. <strong>Shuffle</strong> rotates the whole roster — a fresh theme each pass (or every few minutes in marquee).',

  'configurator.scaleLabel': 'Train size',
  'configurator.scaleHint': 'How big the train is in your broadcast. 1 is the default; lower is smaller, higher is bigger. Watch the preview.',
  'configurator.heightLabel': 'Vertical position',
  'configurator.heightHint': '0 = top, 100 = bottom, 50 = centered. The default sits it on the bottom edge, and the train always stays fully on screen — even when you resize it.',

  'configurator.modeLabel': 'Display style',
  'configurator.modePass': 'Pass — rolls across every few minutes, then leaves',
  'configurator.modeMarquee': 'Marquee — scrolls continuously, always on screen',
  'configurator.intervalLabel': 'Minutes between passes',
  'configurator.intervalNotePassShuffle': 'How often the train rolls across — each pass brings a new theme.',
  'configurator.intervalNotePass': 'How often the train rolls across.',
  'configurator.intervalNoteShuffle': 'How often the theme changes (marquee stays on screen).',
  'configurator.intervalNoteOff': 'Only applies to the Pass display style.',
  'configurator.trackLabel': 'Track between passes',
  'configurator.trackAlways': 'Always show the track',
  'configurator.trackPeriodic': 'Fade it out between passes',
  'configurator.trackHint': 'With the train gone between passes, fade the rails out too so the overlay is completely empty until the next pass rolls in.',
  'configurator.trackFadeLabel': 'Track fade timing (seconds)',
  'configurator.trackFadeInLabel': 'In',
  'configurator.trackFadeOutLabel': 'Out',
  'configurator.trackFadeHint': 'How long the rails take to fade in before each pass, and out after it leaves. Long values are trimmed to fit short intervals.',
  'configurator.speedLabel': 'Animation speed',
  'configurator.speedHint': 'Higher is faster. 1 is the default pace.',
  'configurator.refreshLabel': 'Auto-refresh (minutes)',
  'configurator.refreshPlaceholder': 'off',
  'configurator.refreshHint': 'How often to re-check RaidPal for lineup changes. Blank or 0 = check once on load. Minimum 15 to stay easy on RaidPal.',

  'configurator.openslotsLabel': 'Show open slots',
  'configurator.openslotsHint': 'Display unfilled slots as <strong>OPEN</strong> cars so viewers can sign up.',
  'configurator.hidefinishedLabel': 'Hide finished cars',
  'configurator.hidefinishedHint': 'Remove cars that have already played, instead of dimming them.',
  'configurator.spotlightLabel': 'Spotlight broadcasters',
  'configurator.spotlightPlaceholder': 'DJ Alpha, DJ Charlie',
  'configurator.spotlightHint': "Comma-separated names to highlight with a glow. Capitalization doesn't matter.",
  'configurator.enginedimLabel': 'When the event ends',
  'configurator.enginedimOver': 'Dim the engine',
  'configurator.enginedimFinished': 'Hide it (when hiding finished cars)',
  'configurator.enginedimNever': 'Keep the engine bright',
  'configurator.enginedimHint': 'How the lead engine reacts once the whole event is over.',
  'configurator.tzLabel': 'Show clock times in these zones',
  'configurator.tzPlaceholder': 'PT, ET, GMT',
  'configurator.tzHint': 'Up to 3 zones to show absolute times instead of "in 2h". Leave blank for relative times.<br>\n            Known: <code>PT MT CT ET GMT UTC CET BST JST AEST</code> (or any IANA name).',
  'configurator.tzShowing': 'Showing: {zones}',
  'configurator.tzIgnored': 'Ignored: {zones}',

  'configurator.obsTitle': 'Add this to OBS',
  'configurator.obs1': '<strong>Copy your overlay URL</strong> with the Copy button above.',
  'configurator.obs2': 'In OBS, under <strong>Sources</strong> click <strong>+</strong> and choose <strong>Browser</strong>. Name it (e.g. "Raid Train").',
  'configurator.obs3': '<strong>Paste your URL</strong> into the URL field.',
  'configurator.obs4': 'Set <strong>Width 1920</strong> and <strong>Height 1080</strong> (a standard 1080p canvas).',
  'configurator.obs5': "Leave the background transparent — the overlay is already see-through, so don't add a color.",
  'configurator.obs6': 'Click <strong>OK</strong>. Your train appears.',
  'configurator.obs7': "<strong>Leave the source at full size, positioned at 0, 0</strong> — don't drag or scale it in OBS. Set the train's <strong>Train size</strong> and <strong>Vertical position</strong> (both under <strong>Look</strong>) with the sliders here instead. They bake into the overlay and travel with the URL across scenes and machines, and the train always stays fully on screen.",
  'configurator.obsChanged': "Changed something? Copy the new URL and paste it back into the same Browser source's URL field.",
  'configurator.footer': 'The overlay link is the single source of truth — anyone with it gets the same overlay. <a href="overlay.html" target="_blank" rel="noopener">Open a blank overlay</a>.',

  // Configurator runtime status strings (interpolated)
  'configurator.slugDemo': '✓ Built-in demo lineup — paste your own event slug to go live',
  'configurator.slugChecking': 'Checking…',
  'configurator.slugFound': '✓ Found event "{slug}"',
  'configurator.slugNotFound': '✗ No RaidPal event "{slug}" — double-check the slug or link.',
  'configurator.presetNameFirst': 'Name your preset first.',
  'configurator.presetReplace': 'A preset named "{name}" already exists — replace it?',
  'configurator.presetSaved': 'Saved "{name}".',
  'configurator.presetLoaded': 'Loaded "{name}".',
  'configurator.presetDeleteConfirm': 'Delete preset "{name}"?',
  'configurator.presetDeleted': 'Deleted "{name}".',

  // ── Landing page ─────────────────────────────────────────────────────────
  'landing.tagline': 'Your <a href="https://raidpal.com">RaidPal</a> raid train, as an animated train of streamer cars — for OBS.',
  'landing.build': 'Build your overlay',
  'landing.preview': 'Preview the overlay',
  'landing.demoNote': 'A built-in demo lineup — no event needed. Build yours with your own slug.',
  'landing.howTitle': 'How it works',
  'landing.how1': "<strong>Open the <a href=\"./configurator.html\">Configurator</a>.</strong> Paste your event's RaidPal link — the whole URL is fine, it grabs the event for you — then pick a theme and options and copy the overlay URL.",
  'landing.how2': '<strong>Add it to OBS.</strong> In OBS: <em>Sources → + → Browser</em>, paste the URL, and size the source to your canvas. The overlay background is transparent.',
  'landing.themesTitle': 'Ten themes',
  'landing.themesIntro': 'Click a theme to drop it into your overlay URL (Shuffle cycles them all):',
  'landing.theme.classic': 'Classic Americana',
  'landing.theme.flat': 'Flat',
  'landing.theme.synthwave': 'Synthwave',
  'landing.theme.ticket': 'Vintage Ticket',
  'landing.theme.wood': 'Wooden Toy',
  'landing.theme.comic': 'Comic',
  'landing.theme.departures': 'Departures Board',
  'landing.theme.paper': 'Construction Paper',
  'landing.theme.tron': 'Tron',
  'landing.theme.pixel': '16-bit Pixel',
  'landing.theme.shuffle': '🔀 Shuffle',
  'landing.urlAria': 'Overlay URL for the selected theme',
  'landing.copy': 'Copy',
  'landing.urlNote': 'Swap <code>your-event-slug</code> for your event — everything else has a sensible default. Or build the full link in the <a href="./configurator.html">Configurator</a>.',
  'landing.readme': 'README',
  'landing.authorTheme': 'Author a theme',
  'landing.source': 'Source',
  'landing.license': 'MIT licensed',
  'landing.credit': 'Built with ❤️ by a streamer, for streamers',
  'landing.creditBy': 'by',
};
