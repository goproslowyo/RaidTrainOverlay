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
_Avoid_: rail line, road

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
The form page that builds an Overlay URL (event slug, Mode, toggles, Spotlights, timezones, refresh). Hosted alongside the Overlay.
_Avoid_: settings page, admin, generator

**Preset**:
A named, saved Configurator form state, stored in the Configurator's localStorage. Never read by the Overlay.
_Avoid_: profile, template

**Theme**:
The complete, swappable art treatment the Train is rendered in (e.g. Classic Americana, Pixel, Ticket). Selected per Overlay via the `theme` query param; one Theme is active at a time, and every Theme renders the full state vocabulary — Engine, Car, Caboose, Now Marker, Spotlight, departed, Open Slot. Orthogonal to **Mode**: Theme is _how the Train looks_, Mode is _how it moves_.
_Avoid_: skin, style (style is the CSS/code sense), look, art (in code; fine in prose)

## Flagged ambiguities

- "Conductor" was used for the Organiser's engine role; canonical split: the *person* is the **Organiser**, the *vehicle* is the **Engine**.
- **Spotlight** vs **Now Marker**: Spotlight is user-configured emphasis; Now Marker is time-derived. A Car can have both.

## Example dialogue

> **Dev:** When a Slot ends, does its Car leave the Train?
> **Expert:** No — the Train shows the full lineup, Engine to Caboose. The Now Marker just moves to the next Car.
> **Dev:** And if that next Slot is an Open Slot?
> **Expert:** If Open Slots are hidden by config, the Now Marker skips to the next occupied Car; the timetable still governs timing.
