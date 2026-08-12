# RaidTrainOverlay

A browser-source stream overlay that renders a RaidPal raid train event's lineup as an animated train: each streamer's avatar and name rides a train car across the screen.

## Language

### Event domain (RaidPal)

**Event**:
A RaidPal raid train: a scheduled sequence of streamers identified by a slug (e.g. `trainwreck-lucky-13`), fetched from `https://api.raidpal.com/rest/event/<slug>`.
_Avoid_: raid, show, party

**Slot**:
A fixed-duration time block in the Event's timetable (`slot_duration_mins`). May be occupied by a Broadcaster or open.
_Avoid_: set, timeslot, segment

**Broadcaster**:
A streamer occupying a Slot. Has a display name, avatar (`broadcaster_image`), and Twitch identity.
_Avoid_: DJ, user, streamer (in code; fine in prose)

**Organiser**:
The Broadcaster who created the Event. Drives the **Engine** as the train's **conductor** — they built the train and lead it. The Organiser has no Slot of their own, so the Engine carries no live/departed state.
_Avoid_: host, owner

**Open Slot**:
A Slot with `slot_occupied: false`. Visibility on the Train is configurable (show/hide).
_Avoid_: empty slot, vacancy

### Train metaphor (overlay)

**Train**:
The full visual assembly: Engine + one Car per displayed Slot + Caboose. Shows the full Event lineup.

**Upcoming / Departed / Ended** _(a Train's three lifecycle states)_:
The metaphor runs in one direction and the vocabulary must follow it. A Train sits at the station until its start time (**Upcoming**); it **departs** the station when the Event *starts*, and travels from streamer to streamer; it **ends** when it reaches the Caboose, the last streamer.

| State | In the metaphor | Code |
|---|---|---|
| **Upcoming** | waiting at the station | `upcoming` |
| **Departed** | left the station — running right now | `live` |
| **Ended** | reached the Caboose | `past` |

_Avoid_: "departed" for a Train that is over — it says the opposite of what it means. The Configurator's past-trains expander made exactly this mistake and now reads **Ended** (`configurator.endedOne` / `endedMany`).

Note this is the **Train** level. At the **Slot** level, `isDeparted` / `.rt-car--departed` / `status.departed` describe one streamer's turn being over, in the departures-board sense of an individual departure having left the board. That usage is deliberate and unchanged — see [docs/authoring-a-theme.md](docs/authoring-a-theme.md), where it is a published Theme contract.

**Engine**:
The lead locomotive, driven by the **Organiser** — the conductor of the raid train. The Organiser has no Slot of their own, so the Engine carries no live state (no Now Marker, departed, or Spotlight); it simply leads the train and dims only post-event (`enginedim`).
_Avoid_: locomotive, conductor car

**Tender** _(retired)_:
A car that once coupled directly behind the Engine to credit the **Organiser** when they weren't driving. The Organiser now always drives the Engine, so there is no Tender; the view-model's `engine.organiser` field is a vestigial fallback that is null in practice. Themes do not draw a Tender.

**Car**:
The visual representation of one Slot: avatar, name, and time. One Car per Slot.
_Avoid_: wagon, carriage

**Caboose**:
The final Car, occupied by the last Broadcaster in the lineup.

**Spotlight**:
A configurable per-Broadcaster emphasis (glow) applied to their Car. Set by the overlay user, not by RaidPal data.
_Avoid_: highlight, feature

**Now Marker**:
The treatment of the currently-live Slot's Car: in-place glow plus a pointer/arrow above the Car. Distinct from Spotlight.
_Avoid_: now playing, live highlight

**Pass**:
One traversal of the Train across the screen in periodic mode.

**Mode**:
How the **Train** moves, and nothing else: `pass` (the Train rolls across every N minutes) or `marquee` (a continuous always-on scroll). Selected per browser source via query param. It governs the Train alone — it does not touch the **Upcoming card**, whose shape is that card's **Footprint** (`upstyle`) and whose presence is `upcoming`. So with no Train live, changing Mode changes nothing on screen at all.
_Avoid_: reading `marquee` as a card style — see **Footprint**

**Track**:
The rails the Train rides on — a stationary, full-screen layer. The Train moves along the Track; the Track itself never moves. Styled per Theme (steel rail and ties, neon grid, wooden sleepers, etc.).
_Avoid_: rail line, road, railroad

**Stage**:
Everything this browser source paints, on one full-screen surface: the **Train**, its **Track**, and the **Upcoming card**. Not the *scene* — the scene is the streamer's whole OBS composition (webcam, chat, the game), which we never see and never touch. The Stage sits transparently on top of it. What a **Breather** clears is the Stage.
_Avoid_: canvas, scene, layer

**Cell**:
One ninth of the **Stage** — three columns by three rows. The nine `uppos` anchors are the nine Cells, and a Cell is where an **Upcoming card** *sits*. At 1920×1080 a Cell is 640×360.

A Cell is no longer all the room the card may *take*. The owner's rule, restated once the card's type grew: the grid is a suggested anchor point, and a card may overflow into the neighbours it is next to — so the ceiling is the anchor's own Cell plus every neighbour it can grow toward on that axis, three Cells for a centre position and two for an edge. There is still always a ceiling, and it still depends on the anchor: that is the part that keeps the **scrolling view** from spanning the whole **Stage** from a corner. The one-line **Footprint** keeps a single Cell regardless, because its content is longer than any scene and so takes any room it is given rather than asking for what it needs.
_Avoid_: quadrant, zone, region, box

**Track visibility**:
Whether the Track is shown *periodically* (the default) or *always*. Periodic visibility shows the Track only around each **Pass** — it fades in before the Train enters and fades out after the Train clears, so the Overlay goes fully empty between Passes (reclaiming the lower-third) and a Theme's scenery never lingers on screen with no Train. `always` keeps the Track up the whole time, for a persistent lower-third. Honors "the Track never moves": the change is a fade, not a slide. A `pass`-Mode-only concept — preview always shows the Track, and marquee shows it except during a **Breather**, which clears the **Stage** regardless of this setting.

**Breather**:
The empty stretch a marquee cycle manufactures for itself, so the **Upcoming card** has somewhere to appear while a train is live. Marquee is a seamless crawl with no **Pass** gap, so roughly every three minutes the whole **Stage** clears — Train *and* Track together, by a fade, never a slide — the card takes it alone for one **Page**, and both return. Deliberately not called a Pass (nothing traverses) nor a gap (that is the `pass`-Mode word), so "Pass gaps and marquee Breathers" reads unambiguously. Its length is chosen rather than imposed, so it stays short and constant; a longer **Horizon** rotates across successive Breathers instead of stretching any one of them.

**Stage choreography**:
The rule that the **Train** and the **Upcoming card** never share the **Stage**, and the way it is kept: not by mounting and unmounting, but by one shared period. The card's presence is a single generated opacity keyframe on its own layer, timed against the **Pass** — or against the **Breather**, where marquee has no Pass — so the two cannot drift apart over a stream that runs for days, and nothing is measured frame by frame. Two consequences follow and both are load-bearing. The card's keyframe may be re-seeded *only* when the period it is timed against restarts: a card re-seeded at any other moment slides out of phase with the **Pass** or **Breather** it is timed against, and can then appear *on* a Train. And an empty stretch too short for one whole **Page** or **Lap** is sat out entirely rather than filled with a fraction of one.
_Avoid_: sync, scheduling, timing (each names a mechanism; this names the guarantee)

**Upcoming card**:
The panel that lists what raid trains are coming up. What the Overlay shows when no **Turn** of the streamer's is running — a **Live Link** concept, since resolving "next" needs a **Profile** — and it also takes the pauses while one is: the gap between **Passes**, or a marquee **Breather**. Deliberately unthemed: a sodium departure-board slab that sits on any scene, never the active **Theme**'s art. Distinct from **Upcoming**, the Train lifecycle state: that is a Train waiting at the station, this is the card on screen when there is no Train at all.
_Avoid_: idle card, next-up widget, banner (the code's `idle*` naming is older and inconsistent; the domain word is the card)

**Horizon**:
How far ahead the **Upcoming card** looks. **One concept, measured three ways** — a count of trains (`upcoming=3`, the next three), a span of time (`upcoming=2w`, the next fortnight), or all of them to the end of eternity (`upcoming=all`). These are not three features; they are three ways of expressing the same time horizon, and the card answers the same question under each. Everything the card shows comes out of the Horizon. How much of it is on screen at once is the **Footprint**'s business, and the card walks the rest a **Page** or a **Lap** at a time.
_Avoid_: range, window, lookahead, list

**Page**:
One card view's worth of the **Horizon** — up to three trains, held for `upcycle` seconds, then crossfaded to the next. The card view's unit of one whole thing, and what the gap choreography counts: an empty stretch too short for one whole Page shows nothing at all rather than half of one. A Page *turns*; a **Pass** *traverses*. The two words are deliberately unalike.
_Avoid_: screen, slide, frame

**Lap**:
One scrolling view's worth of the **Horizon** — the whole list carried past once, taking `upscroll` seconds. The scrolling view's unit of one whole thing and **Page**'s opposite number: the gap choreography treats them as a matched pair, so an empty stretch is measured in whole **Page**s or whole **Lap**s and never a fraction of either. Drawn as two identical spans so the loop has no visible seam.
_Avoid_: loop, cycle, scroll, rotation

**Footprint**:
How much room the **Upcoming card** takes — one card, two views. The **card view** (`upstyle=card`, the default) is a small slab showing three trains at a time, paging through the **Horizon** a **Page** at a time. The **scrolling view** (`upstyle=ticker`) is a single line carrying the whole **Horizon** past on one seamless **Lap**. The param is `upstyle`; the Configurator calls the axis *How much room it takes → Card / One line*. Either view is ceilinged from its anchor's **Cell** — the card view may spread into the neighbours it is next to, the scrolling view keeps the single **Cell**. The scrolling view is never "a marquee", even though it scrolls: that word names a **Mode**, which is the *Train*'s axis and not the card's. `mode=marquee` does not turn the card into the scrolling view, and `upstyle=ticker` does not change how the Train moves. The param *value* stays `ticker`, because it ships inside copied OBS browser sources; the words for it do not.
_Avoid_: marquee (for the card), ticker (as a name for the view — it is only a param value), style, size

**Card view**:
The **Upcoming card** wearing the roomier of its two **Footprint**s: a slab of up to three trains at a time, turning a **Page** every `upcycle` seconds until the **Horizon** is spent, then starting over. `upstyle=card`, the default.
_Avoid_: panel, list, widget

**Scrolling view**:
The **Upcoming card** wearing the narrower of its two **Footprint**s: one line, the whole **Horizon** carried past on a seamless **Lap** taking `upscroll` seconds. `upstyle=ticker` — the param value is older than the word for it and does not move. Never "the marquee view": that word names a **Mode** and belongs to the Train.
_Avoid_: ticker, marquee, crawl, banner

**Occasion**:
When the **Upcoming card** is allowed on the **Stage**, as against **Footprint**'s how-much-room: never, only between trains, or between trains *and* in the pauses while one is running (a **Pass** gap, or a marquee **Breather**). Two params carry the three-way — no `upcoming` at all is *never*, and `upgap` then chooses between only-between-trains (`0`) and also-while-one-runs (`1`, the default). The Configurator calls the axis *When the card appears*.
_Avoid_: timing, schedule, visibility (that names the **Track**'s axis)

**Baseline**:
Where a Theme's **floor** sits — the lowest resting art of its Train (wheels, a ground shadow, a name/time line hanging below them) — expressed as a fraction of the Train height, measured down from the top of the Theme's box. Declared per Theme as `foot`. The Overlay's `height` param drops the Baseline onto the bottom edge rather than the Theme's layout box, so every Theme bottoms out identically and a Preset never needs per-Theme height compensation. Effects that bleed on purpose (smoke, glows, the Now Marker, a departed stamp) are excluded — the Baseline must not move with live state. Two Themes take their Baseline from the **Track** instead of the Train, because there the Track paints the ground the Train rests on: jazz (the console deck the records sit on) and lava (the lounge floor line the lamp stands on). Decorative Track bands that merely run downward — tie strips, receding grids, translucent backing — are scenery and may bleed off the bottom edge.
_Avoid_: offset, anchor, ground line

**Ambient animation**:
The Train's per-Theme idle motion — wheels turning, smoke puffing, and Cars undulating — distinct from the macro **Mode** traversal. Organic and varied rather than a uniform mechanical wave: each Theme sets its own **Ride character** and may bump a little off the rail for liveliness without ever reading as derailed. Makes the Train read as rolling, not gliding.
_Avoid_: idle, fidget

**Ride character**:
How tightly or loosely a given Theme's Train rides the rail — the amount and looseness of its ambient bump/bounce. A per-Theme trait: precise/digital Themes (e.g. tron, departures) ride tight; playful ones (e.g. wood, comic) ride looser. Always tasteful — lively, never visibly derailed.
_Avoid_: derail, chaos (those name the deferred opt-in *off-the-rails* axis, not this per-Theme baseline)

### Configuration surface

**Overlay**:
The transparent full-canvas page loaded as an OBS browser source. All behavior is driven by its URL's query params.

**Configurator**:
The streamer-facing app hosted alongside the Overlay: an app shell over a Profile's raid trains, with My Raid Trains as its home view plus the Raid Train Config editor, the Preset library, and Profile settings. Building a single Overlay URL by hand is one secondary view inside it (the One-off link), not the whole page.
_Avoid_: settings page, admin, generator, form page

**Preview**:
The Configurator's rehearsal of what OBS will paint. There are two: the **Train** preview (the real Overlay in a frame, standing still by default and rolled across on request) and the **Upcoming card** preview, the "Between trains" pane. A Preview is honest about *placement* — the **Cell** an anchor may fill and the **Footprint** the card wears are exactly what the **Stage** will give them — and deliberately dishonest about *scale*: the card's contents are drawn several times larger than a true miniature would be, because a 1:1 model in a small pane cannot be read. A Preview is therefore a rehearsal and never a scale model, and it does not have to paint what the Overlay paints. What it may never misstate is where the card lands.
_Avoid_: mock (the code's older word), thumbnail, simulation, WYSIWYG

**Preset**:
A named, saved bundle of Configurator settings — *settings only, no Event*. Stored in the Configurator's localStorage; never read by the Overlay. Referenced by Raid Train Configs.
_Avoid_: profile, template

**Profile**:
A Twitch login identity the Configurator acts as — just the username string, no extra naming layer. Owns its My Raid Trains list, Raid Train Configs, and default settings. Stored locally; switchable to manage another streamer's setup.
_Avoid_: account, user (in code)

**My Raid Trains**:
The Configurator view that lists the Profile's RaidPal Events (joined and organized), fetched from the RaidPal user endpoint. Upcoming Events sorted by start; past Events greyed out and collapsed.
_Avoid_: my trains, my events, dashboard

**Raid Train Config**:
A per-Event saved settings record, keyed by the Event's slug and scoped to a Profile: a reference to a Preset plus per-Event overrides. Feeds the copied Overlay link for that Event.
_Avoid_: train setup, booking, override set (for the whole record)

**Orphaned Config**:
A Raid Train Config whose slug is absent from the Profile's current My Raid Trains feed — the Event ended, was deleted, or was renamed. The store cannot tell these apart, and does not need to: the Overlay resolves against that same feed, so none of the three can ever be selected again. The Live Link therefore drops an Orphaned Config, on the strict condition that the read was both *good* and a **Verified read** — a failed or stale read makes no train an orphan, and neither does a cached one.

**Good read / Verified read** _(two different bars)_:
A **good** read is one nothing is visibly wrong with: it completed, it returned a `{ user: … }` payload, and no stale cache was substituted for it. A **verified** read is a good read that also actually *reached RaidPal* on this attempt rather than being served from the ~6h cache.

Neither bar moved in #49; what changed is which wire responses are allowed to *clear* them. **An empty body is an answer** — a 204, or any status carrying nothing, is RaidPal saying *no such login*. **A non-empty body that isn't a profile is a failure** — a Cloudflare backend-down page, a truncated response — and it is now thrown, so it retries (#47) and, if it keeps failing, serves the last-good list with "RaidPal didn't answer just now". Previously both read as "no such user", which is not a failure, so a downed RaidPal could tell a streamer with 13 trains that they had no profile *and* silently withhold the verified read that pruning and Cleanup depend on.

The distinction exists because the two things the feed is used for need different evidence. When a train **ends** is a fact RaidPal reported, and a fact does not decay — a good read is enough. That a train is **absent** is an inference, and it does decay: a cached feed can be six hours old, and one degraded-but-well-formed response poisons it for that whole window. So absence only prunes on a verified read (`src/feed-verdict.js`'s `readVerdict`, on which its `planCleanup` gates Cleanup, and `buildTrainMap`'s `verified` option); end times prune on any good read. Both bars are one pure module the tests can import — the Configurator keeps the read and asks it what may be concluded.
_Avoid_: stale config, dead config, dangling train

**Cleanup** _(the store's own prune, #41)_:
The Configurator removes an Orphaned Config from the **store** — not just from the Live Link — once it is both unreachable and finished. #31 settled the opposite ("the URL filters and the store does not"), and this **deliberately overturns it**. Do not restore #31's rule: the premise it rested on has changed. #31 rejected store-pruning because a bad RaidPal day makes every train look absent, and at that time nothing could tell a fresh read from a six-hour-old cached one. #39 made that detectable (**Verified read**), so absence can now be trusted under conditions #31 had no way to express.

Five conditions, all required, and each one exists because dropping it deletes real settings on some real day: the read was **good**; it was a **Verified read**; it returned **at least one Event** (`normalizeUser` merges `wire.events ?? []`, so an empty list is indistinguishable from a payload that arrived without the key); the Config belongs to the Profile that was read; and its `endsAt` is in the **past**.

That last one is the rename guard, and it is the load-bearing one. RaidPal has no stable event id, so a renamed *upcoming* train is absent under its old slug and reads exactly like a deleted one — while its settings are about to be needed. A Config with a future `endsAt`, or none at all, is therefore never removed. `endsAt` is a **guard here, never a trigger**: absence alone does not delete, and being over alone does not either.

The streamer is told after the fact by a standing notice with a *Keep them* button (an in-memory restore, suppressed for the rest of the session so the next read does not undo their choice). There is no setting for any of this — a setting would put the question to every streamer forever, which is the friction the feature exists to remove.
_Avoid_: garbage collection, expiry, auto-delete (the last two name what #31 rejected, which this is not)

**Turn**:
The stretch of an Event during which the streamer themselves is playing: their own slot in the lineup, or a run of back-to-back slots, which is one Turn and not several. The unit a **Live Link** actually follows — the Overlay renders the train a Turn is running on (or is about to, `lead` minutes out) and clears the **Stage** when that Turn ends, however many hours the train itself runs on. Read from the Event's lineup, so it is evidence rather than a certainty: a lineup that cannot be fetched falls back to the whole train, while one that reads cleanly and does not name the streamer means that train is not theirs and never takes the **Stage**. Two trains overlapping is therefore an ordinary Tuesday, not an ambiguity — only one of them has a Turn on it.
_Avoid_: slot (a slot is RaidPal's row; a Turn may be several), shift, my window (the code's `myWindows` is the plural of this, not a second idea)

**Live Link**:
An Overlay URL keyed to a Profile's username rather than one Event: the Overlay resolves which Event to show from the RaidPal user endpoint, following the streamer's own **Turn** rather than whichever train happens to be running. Set once in OBS, never edited per train. Carries its settings — including any per-Event mappings — encoded in the URL itself; it never reads the Configurator's localStorage. `wholetrain=1` opts out, restoring the pre-Turn rule where any running train holds the **Stage** for its whole run.
_Avoid_: magic URL (in code; fine in prose)

**One-off link**:
The Configurator view that builds a single Overlay URL from any Event slug or a hand-typed lineup, with no Profile behind it. The door for someone else's event, or for a train RaidPal has never heard of. Produces a static URL — nothing about it re-resolves later.
_Avoid_: manual mode, quick link, guest mode

**Theme**:
The complete, swappable art treatment the Train is rendered in (e.g. Classic Americana, Pixel, Ticket). Selected per Overlay via the `theme` query param; one Theme is active at a time, and every Theme renders the full state vocabulary — Engine, Car, Caboose, Now Marker, Spotlight, departed, Open Slot. Orthogonal to **Mode**: Theme is _how the Train looks_, Mode is _how it moves_.
_Avoid_: skin, style (style is the CSS/code sense), look, art (in code; fine in prose)

## Flagged ambiguities

- "Conductor" was used for the Organiser's engine role; canonical split: the *person* is the **Organiser**, the *vehicle* is the **Engine**.
- **Spotlight** vs **Now Marker**: Spotlight is user-configured emphasis; Now Marker is time-derived. A Car can have both.
- **"Animation"** is overloaded: the macro screen traversal is a **Pass** (a Mode behavior); the per-Theme idle motion (wheels, smoke, undulation) is **Ambient animation**. Always say which — never a bare "animation".
- **"Marquee"** names a **Mode** and only a Mode. The **Upcoming card**'s one-line **Footprint** is the *scrolling view* (`upstyle=ticker`); it scrolls, but calling it a marquee is what sent a streamer to `mode=` looking for a control that was two fields away (#67). Neither param value is renamed — both ship inside copied OBS sources — so the discipline lives in the words.
- **"Ticker"** is a param value and nothing else. #67 canonised it as the name of the one-line view; on review the owner did not recognise the word and called it *the scrolling view*, distinguishing it from *the train marqueeing*. The glossary records the language the team speaks, so the two views are the **card view** and the **scrolling view** — and `upstyle=ticker` stays exactly as it is, because it ships inside copied OBS sources.
- **Does renaming a RaidPal Event change its slug?** Unknown, and it decides whether "renamed" is a real cause of an Orphaned Config or a phantom. `raidpal_link` looks title-and-date derived (`…/event/house-is-a-feeling-raid-train-27-aug-8-9`), which suggests yes, but that is inference — the API exposes no id field to check against (`docs/research/raidpal-user-endpoint-edge-cases.md`). Only an actual rename of a real Event would settle it. **Cleanup** does not depend on the answer: its `endsAt` guard protects renamed upcoming trains either way.

## Example dialogue

> **Dev:** When a Slot ends, does its Car leave the Train?
> **Expert:** No — the Train shows the full lineup, Engine to Caboose. The Now Marker just moves to the next Car.
> **Dev:** And if that next Slot is an Open Slot?
> **Expert:** If Open Slots are hidden by config, the Now Marker skips to the next occupied Car; the timetable still governs timing.
