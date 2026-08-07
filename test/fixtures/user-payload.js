/**
 * Wire-shaped RaidPal user payload, as returned by
 * GET https://api.raidpal.com/rest/user/<twitch_login> (shape verified live —
 * see docs/research/raidpal-user-endpoint-edge-cases.md).
 *
 * The fixture user organises one Event that ALSO appears in events_joined
 * (organisers duplicate across both arrays on the real API), and
 * events_joined is deliberately OUT of chronological order so tests can
 * assert dedupe and client-side sorting. Returns a fresh object per call.
 */
export function makeUserPayload(userOverrides = {}) {
  return {
    user: {
      display_name: 'GoProFlowYo',
      profile_image: 'https://example.test/avatars/goproflowyo.png',
      twitch_uri: 'https://twitch.tv/goproflowyo',
      timezone: 'America/Los_Angeles',
      events: [
        {
          title: 'My Own Train',
          starttime: '2026-08-20T18:00:00Z',
          endtime: '2026-08-20T22:00:00Z',
          raidpal_link: 'https://raidpal.com/en/event/my-own-train',
          api_link: 'https://api.raidpal.com/rest/event/my-own-train',
        },
      ],
      events_joined: [
        {
          title: 'My Own Train',
          starttime: '2026-08-20T18:00:00Z',
          endtime: '2026-08-20T22:00:00Z',
          raidpal_link: 'https://raidpal.com/en/event/my-own-train',
          api_link: 'https://api.raidpal.com/rest/event/my-own-train',
        },
        {
          title: 'LUNA',
          starttime: '2026-08-03T22:00:00Z',
          endtime: '2026-08-06T12:00:00Z',
          raidpal_link: 'https://raidpal.com/en/event/luna-hao8',
          api_link: 'https://api.raidpal.com/rest/event/luna-hao8',
        },
        {
          title: 'Trainwreck &amp; Friends',
          starttime: '2026-08-10T18:00:00Z',
          endtime: '2026-08-10T22:00:00Z',
          raidpal_link: 'https://raidpal.com/en/event/trainwreck-lucky-13',
          api_link: 'https://api.raidpal.com/rest/event/trainwreck-lucky-13',
        },
      ],
      ...userOverrides,
    },
  };
}
