# RaidPal user-endpoint edge cases

Research for issue #4 ("My Raid Trains" configurator). Probed live against
`https://api.raidpal.com/rest` on **2026-08-06** — 11 sequential requests,
~0.5s apart, all responses as noted below. Companion to the general API notes
in twitch-gcal-sync's `RAIDPAL_API.md`.

## 1. `events[]` (organised trains): same entry shape as `events_joined[]`

Verified via organiser `teknokat222` (organiser of "House Is a Feeling",
found through `organiser_link` on the event payload). Entries in both arrays
have exactly the same five keys:

```json
{
  "title": "House Is a Feeling Raid Train № 27 | Aug 8 + 9",
  "starttime": "2026-08-08T22:30:00Z",
  "endtime": "2026-08-10T07:30:00Z",
  "raidpal_link": "https://raidpal.com/en/event/house-is-a-feeling-raid-train-27-aug-8-9",
  "api_link": "https://api.raidpal.com/rest/event/house-is-a-feeling-raid-train-27-aug-8-9"
}
```

**Caveat:** the `events` key is *absent entirely* for users who organise
nothing — `goproflowyo`'s user object has keys
`['display_name', 'profile_image', 'twitch_uri', 'timezone', 'events_joined']`
(no `events`), while `teknokat222`'s has both. Consumers must default to `[]`
(`user.events ?? []`).

## 2. Unknown / invalid username → 204 No Content, empty body

Not a 404, and **not JSON**:

```
GET /rest/user/thisuserdoesnotexist12345  →  204, Content-Length 0, no Content-Type
GET /rest/user/bad%20name%21%21           →  204, Content-Length 0, no Content-Type
```

Invalid characters behave identically to unknown-but-valid logins — there is
no distinguishable "malformed" error. Don't call `response.json()`
unconditionally: an empty body throws.

> **Corrected 2026-08-08 (#49).** This section originally advised treating
> *"any body that doesn't parse to `{user: …}`"* as "user not found", and that
> advice shipped and became a bug. It conflates two different answers. **Nothing
> at all** — a 204, or an empty body under any status — is RaidPal saying *no
> such login*. A body with **content in it** that isn't a profile is RaidPal
> failing to answer: when RaidPal's backend is down, Cloudflare serves an HTML
> error page, and a dropped connection truncates the JSON. Reading those as
> "not found" tells a streamer with 13 trains that they have no RaidPal profile,
> and — because "not found" isn't a failure — silently withholds the
> **Verified read** that Live Link pruning (#39) and store Cleanup (#41)
> require. Read an unreadable body as a **failed read** instead.

Bonus: lookup is **case-insensitive** — `GET /rest/user/GoProFlowYo` returns
200 with the same payload as the lowercase login.

## 3. HTML entities: descriptions yes, titles not observed

Scanned 2 user payloads (17 event titles) and 4 event payloads. Entities
(`&amp;`, `&nbsp;`) appeared **only inside `description`**, which is HTML:

```
"…Drum &amp; Bass, Breaks &amp; Bass) raid train…"   (the-frequency-jack-s-bday-train)
"HiAF № 27 - House is a feeling!&nbsp;<br /><br />…"  (house-is-a-feeling…)
```

Titles containing `&` come through as the **literal character**:
`"THE DOG POUND & HOUSE TEAM present: THE INTERNATIONAL VIBE FEST No. 3"` —
raw `&`, not `&amp;`, in both the user and event payloads. Unicode (`№`, `🌙`)
is plain UTF-8. Broadcaster display names in timetables (42 sampled): no
entities either.

Verdict: decoding is **required** for descriptions (full HTML: tags +
entities). For titles it was not observed in this sample; a defensive decode
is harmless (a title legitimately containing `&amp;` as text is implausible)
but do not run titles through an HTML-tag stripper.

## 4. Same event in both `events` and `events_joined`: yes, routinely

`teknokat222` organises 2 events; **both** also appear in their
`events_joined` (4 entries) — identical `raidpal_link`s. An organiser who
takes a slot in their own train is listed in both arrays, so naive
concatenation (as dirty-raid does) produces duplicates. **Dedupe by
`raidpal_link` (or `api_link`)** — there is no id field in these entries.

## 5. User-payload fields useful for a UI

Reliably present on every 200 observed:

| field | example | notes |
|---|---|---|
| `display_name` | `"GoProFlowYo"` | proper capitalisation |
| `profile_image` | `https://cdn.raidpal.com/userdata/user/img/profile/….png` | RaidPal CDN, 300x300 |
| `twitch_uri` | `https://twitch.tv/goproflowyo` | login derivable from tail |
| `timezone` | `"America/Los_Angeles"` | IANA name |
| `events_joined` | array | present even for organisers |
| `events` | array | **only when user organises** (see #1) |

Nothing else — no numeric id, no follower counts, no bio.

## 6. Sort order of `events_joined`: chronological ascending (observed)

Both sampled users' arrays are strictly ascending by `starttime`
(`goproflowyo`: 13 entries, 2026-08-08 → 2026-11-05; `teknokat222`: 4
entries; the organiser `events` array too). This contradicts the older
"order not guaranteed" note, but with n=2 users, keep the client-side sort —
it's one line and makes the guarantee irrelevant.

## Implementation checklist for "My Raid Trains"

- Fetch `GET /rest/user/{login}`. **Empty body** (204, or any status with
  nothing in it) = "not found". **Non-ok status**, or a non-empty body that
  isn't `{user: …}` = a *failed read*, not a verdict about the login (#49).
- Merge `[...(user.events ?? []), ...user.events_joined]`, dedupe by
  `raidpal_link`, sort by `starttime`; optionally badge entries present in
  `events` as "Organiser".
- Decode HTML entities in `description` (and render/strip its tags); titles
  can be displayed as-is (decode defensively if cheap).
- `display_name`, `profile_image`, `timezone` are safe to show for a
  profile header.
