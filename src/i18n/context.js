/**
 * Translation metadata — NOT loaded at runtime. It exists so that whoever (or
 * whatever) translates a catalog has the context machine translation usually
 * lacks: what each string means, where it appears, its part of speech, and how
 * short it must stay. Consumed by the translation-QA tooling and surfaced to
 * contributors (see TRANSLATING.md); it is also the source for per-string
 * context in a translation platform (Crowdin/Weblate string descriptions).
 *
 * Keep this in sync with src/i18n/locales/en.js (the key set is asserted by the
 * i18n test). When you add a key to en.js, add its description + any constraint.
 */

/** Tone + audience guidance that applies to the whole catalog. */
export const TONE =
  'Audience: Twitch/live-stream viewers and streamers. Register: friendly and ' +
  'casual, not corporate. Where the language distinguishes formality, address the ' +
  'reader informally (du / tu / tú / je). Preserve the playful train metaphor.';

/**
 * Domain terms with their intended meaning + a canonical treatment per language.
 * `obs`/`twitch` terms are filled per-locale by the term-grounding step (match
 * the app's own official translation so instructions read native). Keep the
 * train metaphor consistent within a locale once chosen.
 */
export const GLOSSARY = {
  'raid train': 'A relay event where streamers "raid" (send their audience) to the next streamer in turn. Rendered as a literal choo-choo train of streamer cars. Match Twitch\'s localized "raid" term.',
  'raid': 'Twitch term: sending your viewers to another channel at stream end. Use Twitch\'s official localized term for this locale.',
  'overlay': 'A transparent graphic layered on a stream in OBS. Often kept as "overlay" even in other languages (streaming jargon) — use the locally common term.',
  'OBS': 'OBS Studio — the streaming app. A proper noun; never translate. Match OBS\'s own localized UI for Browser / Sources / Width / Height.',
  'browser source': 'An OBS source type that renders a web page. Use OBS\'s exact localized term for "Browser" source.',
  'slot': 'A time slot in the lineup that a streamer books. Train metaphor: each becomes a car.',
  'broadcaster': 'A streamer in the lineup. "streamer" is usually the most natural rendering.',
  'organiser': 'The person running the whole raid train; drives the locomotive in the art. (British spelling in en; localize naturally.)',
  'engine / locomotive / loco': 'The front of the train = the organiser. Keep the train metaphor.',
  'car / coach': 'A train car = one streamer in the lineup.',
  'caboose': 'The last car of a train = the final streamer. Use the natural local word for the rear train car (or "last car").',
  'tender': 'The coal-car behind the locomotive; here it carries the organiser credit.',
  'pass': 'Display mode: the train rolls across the screen once, then leaves. As a UI label it is a mode name — translate the motion, not the card game.',
  'marquee': 'Display mode: the train scrolls continuously like a marquee/ticker. May stay "marquee" if that reads as the scrolling-ticker sense.',
  'spotlight': 'Highlight a streamer with a glow. Verb/feature name.',
  'theme': 'A visual art style for the train (Classic, Synthwave, …).',
  'NOW': 'Badge: this streamer is live right now.',
  'OPEN': 'Badge: an unbooked slot a viewer can sign up for. Use the shortest natural word for "available/free".',
  'PLAYED': 'Badge stamped on a slot whose turn is over ("done / already aired"). Shortest natural past-state word.',
};

/**
 * Keys whose rendered text sits on a FIXED-WIDTH train car and must stay short,
 * with a soft character budget (longer risks overflow/auto-shrink). The QA gate
 * warns past these. organisedBy/conductor ride wider elements, so a bit longer.
 */
export const BADGE_BUDGET = {
  'overlay.now': 8,
  'overlay.open': 10,
  'overlay.signUp': 14,
  'overlay.played': 12,
  'overlay.conductor': 13,
  'overlay.organisedBy': 16,
  'overlay.staff': 10,
  'status.onTime': 12,
  'status.boarding': 12,
  'status.departed': 12,
  'status.lead': 10,
  'departures.header': 12,
};

/**
 * Per-key context. One line each: what it is / where it shows / how to treat it.
 * The ambiguous and constrained strings carry the most detail — those are where
 * machine translation goes wrong.
 */
export const DESCRIPTIONS = {
  // Overlay badges (painted into the train; SHORT — see BADGE_BUDGET).
  'overlay.now': 'Badge on the streamer who is live right now. Adverb "now". Very short.',
  'overlay.open': 'Big label on an unbooked slot ("available/free"). Short, bold.',
  'overlay.signUp': 'Call-to-action under OPEN inviting a viewer to claim the slot. Imperative, casual ("sign up!").',
  'overlay.played': 'Stamp on a slot whose turn is over — "done / already aired", NOT "played a game". Short past-state.',
  'overlay.conductor': 'Badge over the locomotive marking the lead (the organiser). Train conductor / driver sense.',
  'overlay.organisedBy': 'Caption above the organiser credit on the tender. "organised by" (followed by their name elsewhere).',
  'overlay.staff': 'Caption on the organiser/tender card (the event "staff/crew/team"). Short.',
  // Departures-board statuses (split-flap sign metaphor).
  'status.onTime': 'Departures-board status lamp: upcoming, on schedule. Airport/rail "on time".',
  'status.boarding': 'Departures-board status: this streamer is live now (their slot is "boarding").',
  'status.departed': 'Departures-board status: this slot is over ("departed"). Rail/airport sense.',
  'status.lead': 'Departures-board status on the lead streamer who has played but still heads the train. "Lead / head of the line".',
  'departures.header': 'Header strip on the Departures-board theme reading "DEPARTURES" (the board title). The ● bullet is added in code.',
  // Relative time assembly.
  'time.in': 'Wrapper for an upcoming time: "in {v}" where {v} is e.g. "2h30m". Use your language\'s "in X time" preposition. Keep {v}.',
  'time.d': 'Compact unit token for DAYS, used like "2d" with no space. Shortest conventional abbreviation, lowercase.',
  'time.h': 'Compact unit token for HOURS, used like "2h" with no space. Shortest conventional abbreviation, lowercase.',
  'time.m': 'Compact unit token for MINUTES, used like "30m" with no space. Shortest conventional abbreviation, lowercase.',

  // Configurator — hero.
  'configurator.title': 'Page title of the Configurator tool.',
  'configurator.sub': 'One-line intro under the title.',
  'configurator.sourceRaidpal': 'Toggle button: use a RaidPal event as the lineup source.',
  'configurator.sourceManual': 'Toggle button: build the lineup by hand (no RaidPal).',
  'configurator.manualPlaceholder': 'Preview hint shown in manual mode before any DJ is added.',
  // Configurator — "Build by hand" editor.
  'configurator.manual.fieldTitle': 'Field label: the event title for a hand-built lineup.',
  'configurator.manual.titlePlaceholder': 'Placeholder example for the event-title field.',
  'configurator.manual.fieldOrganiser': 'Field label: the organiser\'s handle/name (drives the locomotive).',
  'configurator.manual.fieldStart': 'Field label: when the first set starts (a wall clock).',
  'configurator.manual.fieldZone': 'Field label: the timezone the start time is entered in.',
  'configurator.manual.fieldSetLength': 'Field label: the default length of one DJ set (the base slot).',
  'configurator.manual.zoneYours': 'Suffix appended to the auto-detected timezone option, e.g. "America/New_York (your timezone)".',
  'configurator.manual.colNum': 'Table column header: the row number. Keep very short ("#").',
  'configurator.manual.colHandle': 'Table column header: the DJ\'s handle.',
  'configurator.manual.colPlays': 'Table column header over the per-DJ slot multiplier (×N cars on the train). Match the "slot" term used elsewhere in the catalog.',
  'configurator.manual.colLive': 'Table column header: the clock time this DJ goes live.',
  'configurator.manual.handlePlaceholder': 'Placeholder in a DJ handle input.',
  'configurator.manual.addDj': 'Button: add a new empty DJ row. Keep the leading "+".',
  'configurator.manual.pasteOpen': 'Button: reveal the paste-a-list box.',
  'configurator.manual.pasteClose': 'Button: hide the paste-a-list box.',
  'configurator.manual.pasteLabel': 'Help text above the paste textarea (one handle per line; optional duration).',
  'configurator.manual.pasteAdd': 'Button: append the pasted handles to the lineup.',
  'configurator.manual.pasteHint': 'Hint beside the add buttons (drag to reorder; handles are cleaned).',
  'configurator.manual.legend': 'Caption under the schedule timeline strip.',
  'configurator.manual.emptyTimeline': 'Placeholder shown in the timeline before any DJ is added.',
  'configurator.manual.dragReorder': 'Tooltip on the drag handle of a DJ row.',
  'configurator.manual.remove': 'Tooltip on the remove (✕) button of a DJ row.',
  'configurator.manual.totDjs': 'Footer total: the DJ count. Keep the {n} token.',
  'configurator.manual.totDuration': 'Footer total: the lineup\'s total length. Keep the {dur} token.',
  'configurator.manual.warnDup': 'Warning: duplicate handles in the lineup. Keep the {names} token.',
  'configurator.manual.warnEmpty': 'Warning: rows with no handle. Keep the {n} token.',
  'configurator.manual.warnMany': 'Warning shown when there are many DJs (the overlay link may get long).',
  'configurator.manual.savedStreamers': 'Heading over the click-to-add chips of previously-used streamers.',
  'configurator.manual.forget': 'Tooltip on a saved-streamer chip\'s ✕ button — forget this handle.',
  'configurator.manual.addStreamer': 'Placeholder in the field for manually saving a streamer handle to the saved list.',
  // Landing — build paths + theme actions.
  'landing.buildRaidpal': 'Landing CTA button: start building from a RaidPal event.',
  'landing.buildManual': 'Landing CTA button: build a lineup by hand (no RaidPal).',
  'landing.buildExplain': 'One-line explainer under the CTA distinguishing the two build paths. Keep the <a> to raidpal.com.',
  'landing.themePreview': 'Button in the Themes section: preview the selected theme.',
  'landing.themeBuild': 'Button in the Themes section: build an overlay with the selected theme.',
  'configurator.eventLabel': 'Field label: the RaidPal event to load.',
  'configurator.eventPlaceholder': 'Placeholder in the event field (a paste-your-RaidPal-link hint).',
  'configurator.eventHint': 'Help text under the event field.',
  'configurator.previewTitle': 'Accessible title of the preview iframe.',
  'configurator.previewPlaceholder': 'Shown in the empty preview area before an event is entered.',
  'configurator.previewEnterValid': 'Shown in the preview area when the entered event is invalid.',
  'configurator.rollTitle': 'Tooltip on the "Roll it" preview button (explains roll/freeze/resume).',
  'configurator.rollIt': 'Preview button: start the train rolling across. Short.',
  'configurator.freeze': 'Preview button label once rolling: pause in place. Short.',
  'configurator.resume': 'Preview button label once frozen: continue. Short.',
  'configurator.stillTitle': 'Tooltip on the "Recenter" button.',
  'configurator.recenter': 'Preview button: return to the centered still view. Short.',
  'configurator.captionPass': 'Caption under the preview when display mode is Pass. {mins} = minutes between passes (keep token).',
  'configurator.captionMarquee': 'Caption under the preview when display mode is Marquee.',
  'configurator.urlPlaceholder': 'Placeholder in the generated-URL field before an event is set.',
  'configurator.copy': 'Button: copy the URL. Verb.',
  'configurator.copied': 'Transient confirmation after copying ("Copied!").',
  // Configurator — presets.
  'configurator.presets': 'Section heading: saved configurations.',
  'configurator.presetNamePlaceholder': 'Placeholder: name for a preset.',
  'configurator.save': 'Button: save a preset. Verb.',
  'configurator.load': 'Button: load a preset. Verb.',
  'configurator.delete': 'Button: delete a preset. Verb.',
  'configurator.noPresets': 'Empty-state option in the preset dropdown.',
  // Configurator — settings tabs.
  'configurator.settings': 'Section heading: settings.',
  'configurator.tabLook': 'Tab name: visual options (theme/size/position). Noun "Look/Appearance".',
  'configurator.tabMotion': 'Tab name: motion options (mode/speed). Noun "Motion".',
  'configurator.tabLineup': 'Tab name: lineup options (open slots, spotlight, zones). Noun "Lineup".',
  // Configurator — language.
  'configurator.languageLabel': 'Field label for the overlay-language selector.',
  'configurator.languageHint': 'Help text: this sets the language the on-stream overlay shows; it is saved in the URL.',
  // Configurator — theme.
  'configurator.themeLabel': 'Field label: art style.',
  'configurator.theme.classic': 'Theme name: vintage American steam-train look. "Classic Americana".',
  'configurator.theme.flat': 'Theme name: flat cartoon vector style.',
  'configurator.theme.synthwave': 'Theme name: 80s neon "Synthwave" (proper noun — keep).',
  'configurator.theme.ticket': 'Theme name: vintage paper ticket style.',
  'configurator.theme.wood': 'Theme name: wooden toy train.',
  'configurator.theme.comic': 'Theme name: comic-book / halftone style. "halftone" = the printed-dot effect.',
  'configurator.theme.departures': 'Theme name: airport/rail split-flap departures board.',
  'configurator.theme.paper': 'Theme name: cut-out construction paper.',
  'configurator.theme.tron': 'Theme name: Tron neon lightcycle (proper noun — keep "Tron").',
  'configurator.theme.pixel': 'Theme name: 16-bit pixel art.',
  'configurator.theme.highvibes': 'Theme name: a cannabis "High Vibes" theme — avatars nestle in frosty cannabis buds amid pot leaves. Keep it light/playful; localize "High Vibes" naturally or keep as-is if it reads as a brand.',
  'configurator.theme.jazz': 'Theme name: spinning jazz vinyl records. "Jazz" is usually kept; translate "vinyl" if natural.',
  'configurator.theme.bullet': 'Theme name: an anime-styled Japanese bullet train (shinkansen). Translate "bullet train" with the local term (or keep "shinkansen").',
  'configurator.theme.lava': 'Theme name: a psychedelic lava lamp. Translate "lava lamp" with the local term.',
  'configurator.theme.shuffle': 'Theme option: cycle through every theme. Keep the 🔀 emoji.',
  'configurator.themeHint': 'Help text under the theme picker. Contains <strong>Shuffle</strong> — keep the tag; translate "Shuffle" to match the shuffle option.',
  // Configurator — look sliders.
  'configurator.scaleLabel': 'Slider label: how big the train is.',
  'configurator.scaleHint': 'Help text for the size slider.',
  'configurator.heightLabel': 'Slider label: vertical position on screen.',
  'configurator.heightHint': 'Help text for the vertical-position slider.',
  // Configurator — motion.
  'configurator.modeLabel': 'Field label: display style (Pass vs Marquee).',
  'configurator.modePass': 'Option describing Pass mode (rolls across, then leaves).',
  'configurator.modeMarquee': 'Option describing Marquee mode (scrolls continuously).',
  'configurator.intervalLabel': 'Field label: minutes between passes.',
  'configurator.intervalNotePassShuffle': 'Help text shown for Pass + Shuffle.',
  'configurator.intervalNotePass': 'Help text shown for Pass mode.',
  'configurator.intervalNoteShuffle': 'Help text shown for Shuffle in Marquee.',
  'configurator.intervalNoteOff': 'Help text shown when the interval field does not apply.',
  'configurator.trackLabel': 'Field label: whether the rails (the train track) stay on screen between passes. "Track" = the rails, not an audio track.',
  'configurator.trackAlways': 'Option: keep the track/rails visible the whole time (the default).',
  'configurator.trackPeriodic': 'Option: fade the track/rails out between passes so the overlay is empty until the next pass.',
  'configurator.trackHint': 'Help text under the track-visibility picker, explaining the fade-out-between-passes option.',
  'configurator.trackFadeLabel': 'Field label above the two fade-duration inputs (seconds): how long the track fade in/out takes.',
  'configurator.trackFadeInLabel': 'Tiny inline label before the fade-IN seconds input. "In" as in fade-in. Very short.',
  'configurator.trackFadeOutLabel': 'Tiny inline label before the fade-OUT seconds input. "Out" as in fade-out. Very short.',
  'configurator.trackFadeHint': 'Help text under the track fade-duration inputs.',
  'configurator.speedLabel': 'Field label: animation speed.',
  'configurator.speedHint': 'Help text for the speed field.',
  'configurator.refreshLabel': 'Field label: auto-refresh interval in minutes.',
  'configurator.refreshPlaceholder': 'Placeholder meaning auto-refresh is off ("off").',
  'configurator.refreshHint': 'Help text for auto-refresh.',
  // Configurator — lineup.
  'configurator.openslotsLabel': 'Checkbox: show unbooked slots.',
  'configurator.openslotsHint': 'Help text; contains <strong>OPEN</strong> — keep the tag and match the overlay OPEN badge.',
  'configurator.hidefinishedLabel': 'Checkbox: hide cars whose turn is over.',
  'configurator.hidefinishedHint': 'Help text for hiding finished cars.',
  'configurator.spotlightLabel': 'Field label: streamers to highlight with a glow.',
  'configurator.spotlightPlaceholder': 'Placeholder example names.',
  'configurator.spotlightHint': 'Help text for the spotlight field.',
  'configurator.enginedimLabel': 'Field label: what the locomotive does when the whole event ends.',
  'configurator.enginedimOver': 'Option: dim the locomotive when the event is over.',
  'configurator.enginedimFinished': 'Option: hide the locomotive (when hiding finished cars).',
  'configurator.enginedimNever': 'Option: keep the locomotive bright.',
  'configurator.enginedimHint': 'Help text for the post-event locomotive behavior.',
  'configurator.tzLabel': 'Field label: show clock times in chosen time zones.',
  'configurator.tzPlaceholder': 'Placeholder example zones (PT, ET, GMT).',
  'configurator.tzHint': 'Help text; contains <br> and <code> with zone abbreviations — keep the tags and the abbreviations as-is.',
  'configurator.tzShowing': 'Status: which zones will show. {zones} = a comma list (keep token).',
  'configurator.tzIgnored': 'Status: which zone tokens were ignored. {zones} (keep token).',
  // Configurator — OBS instructions (HTML; keep <strong>, match OBS\'s localized UI terms).
  'configurator.obsTitle': 'Heading for the OBS setup steps.',
  'configurator.obs1': 'OBS step 1. Keep <strong>. "Copy your overlay URL".',
  'configurator.obs2': 'OBS step 2. Keep <strong>. Match OBS\'s localized "Sources" / "Browser" terms.',
  'configurator.obs3': 'OBS step 3. Keep <strong>. "Paste your URL".',
  'configurator.obs4': 'OBS step 4. Keep <strong>. Match OBS\'s localized "Width" / "Height". Keep 1920/1080.',
  'configurator.obs5': 'OBS step 5: leave the background transparent.',
  'configurator.obs6': 'OBS step 6. Keep <strong>OK</strong>.',
  'configurator.obs7': 'OBS step 7 (long). Keep all <strong> tags; match OBS terms; reference "Look" tab + Train size / Vertical position labels consistently with those keys.',
  'configurator.obsChanged': 'Tip: re-copy the URL after changing settings.',
  'configurator.footer': 'Footer note. Contains an <a> link — keep the tag/href; translate only the visible text.',
  // Configurator — runtime status messages.
  'configurator.slugDemo': 'Status when the built-in demo event is loaded. Keep the ✓.',
  'configurator.slugChecking': 'Status while validating an event ("Checking…"). Keep the ellipsis.',
  'configurator.slugFound': 'Status when an event is found. Keep ✓ and {slug}.',
  'configurator.slugNotFound': 'Status when no event matches. Keep ✗ and {slug}.',
  'configurator.presetNameFirst': 'Validation when saving a preset with no name.',
  'configurator.presetReplace': 'Confirm dialog when overwriting a preset. Keep {name}.',
  'configurator.presetSaved': 'Confirmation after saving. Keep {name}.',
  'configurator.presetLoaded': 'Confirmation after loading. Keep {name}.',
  'configurator.presetDeleteConfirm': 'Confirm dialog when deleting. Keep {name}.',
  'configurator.presetDeleted': 'Confirmation after deleting. Keep {name}.',

  // Landing page.
  'landing.tagline': 'Hero tagline. Contains an <a> to RaidPal — keep the tag/href.',
  'landing.build': 'Primary CTA button: open the Configurator.',
  'landing.preview': 'Secondary CTA button: open the preview page.',
  'landing.demoNote': 'Note under the CTAs about the built-in demo.',
  'landing.howTitle': 'Section heading "How it works".',
  'landing.how1': 'Step 1 (HTML: <strong>, <a> to Configurator). Keep tags.',
  'landing.how2': 'Step 2 (HTML: <strong>, <em> with OBS menu path). Keep tags; match OBS terms.',
  'landing.themesTitle': 'Section heading above the theme chips (count-free, e.g. "Themes").',
  'landing.themesIntro': 'Intro line above the theme chips.',
  'landing.theme.classic': 'Theme chip name (landing). Same art style as configurator.theme.classic — keep consistent.',
  'landing.theme.flat': 'Theme chip name (landing).',
  'landing.theme.synthwave': 'Theme chip name (landing). Proper noun — keep "Synthwave".',
  'landing.theme.ticket': 'Theme chip name (landing).',
  'landing.theme.wood': 'Theme chip name (landing).',
  'landing.theme.comic': 'Theme chip name (landing).',
  'landing.theme.departures': 'Theme chip name (landing).',
  'landing.theme.paper': 'Theme chip name (landing).',
  'landing.theme.tron': 'Theme chip name (landing). Keep "Tron".',
  'landing.theme.pixel': 'Theme chip name (landing).',
  'landing.theme.highvibes': 'Theme chip name (landing). Same theme as configurator.theme.highvibes — keep consistent. Cannabis "High Vibes"; localize naturally or keep as a brand.',
  'landing.theme.jazz': 'Theme chip name (landing). Spinning jazz vinyl; "Jazz" usually kept.',
  'landing.theme.bullet': 'Theme chip name (landing). Anime Japanese bullet train (shinkansen).',
  'landing.theme.lava': 'Theme chip name (landing). A lava lamp; translate "lava lamp" locally.',
  'landing.theme.shuffle': 'Theme chip: cycle all. Keep 🔀.',
  'landing.urlAria': 'Accessible label for the overlay-URL field.',
  'landing.copy': 'Copy button on the landing page. Verb.',
  'landing.urlNote': 'Note under the URL (HTML: <code>your-event</code>, <a> to Configurator). Keep tags; keep the <code>your-event</code> placeholder text.',
  'landing.readme': 'Footer link text "README" (often left as-is).',
  'landing.authorTheme': 'Footer link: guide to authoring a theme.',
  'landing.source': 'Footer link: source code.',
  'landing.license': 'Footer text "MIT licensed".',
  'landing.credit': 'Footer credit line. Keep the ❤️ emoji.',
  'landing.creditBy': 'Connector word "by" before the author name in the credit line.',
};
