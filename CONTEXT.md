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
The display behavior of the overlay: `pass` (train rolls across every N minutes) or `marquee` (continuous always-on scroll). Selected per browser source via query param.

**Track**:
The rails the Train rides on — a stationary, full-screen layer. The Train moves along the Track; the Track itself never moves. Styled per Theme (steel rail and ties, neon grid, wooden sleepers, etc.).
_Avoid_: rail line, road, railroad

**Track visibility**:
Whether the Track is shown *periodically* (the default) or *always*. Periodic visibility shows the Track only around each **Pass** — it fades in before the Train enters and fades out after the Train clears, so the Overlay goes fully empty between Passes (reclaiming the lower-third) and a Theme's scenery never lingers on screen with no Train. `always` keeps the Track up the whole time, for a persistent lower-third. Honors "the Track never moves": the change is a fade, not a slide. A `pass`-Mode-only concept — marquee and preview always show the Track.

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
A Raid Train Config whose slug is absent from the Profile's current My Raid Trains feed — the Event ended, was deleted, or was renamed. The store cannot tell these apart, and does not need to: the Overlay resolves against that same feed, so none of the three can ever be selected again. The Live Link therefore drops an Orphaned Config, on the strict condition that the read was *good* — a failed or stale read makes no train an orphan.
_Avoid_: stale config, dead config, dangling train

**Live Link**:
An Overlay URL keyed to a Profile's username rather than one Event: the Overlay resolves the currently-live (or next) Event from the RaidPal user endpoint at load. Set once in OBS, never edited per train. Carries its settings — including any per-Event mappings — encoded in the URL itself; it never reads the Configurator's localStorage.
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

## Example dialogue

> **Dev:** When a Slot ends, does its Car leave the Train?
> **Expert:** No — the Train shows the full lineup, Engine to Caboose. The Now Marker just moves to the next Car.
> **Dev:** And if that next Slot is an Open Slot?
> **Expert:** If Open Slots are hidden by config, the Now Marker skips to the next occupied Car; the timetable still governs timing.
