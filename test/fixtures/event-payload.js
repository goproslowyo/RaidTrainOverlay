/**
 * Wire-shaped RaidPal event payload, as returned by
 * GET https://api.raidpal.com/rest/event/<slug> (shape mirrors dirty-raid's
 * docs/example-custom-event.json, which consumes the same API).
 *
 * The time_table is deliberately OUT of order, with one Open Slot, so tests
 * can assert ordering and filtering. Returns a fresh object per call.
 */
export function makeEventPayload(eventOverrides = {}) {
  return {
    event: {
      status: true,
      title: 'Trainwreck &amp; Friends',
      description: 'Lucky 13th edition of the trainwreck raid train',
      slot_duration_mins: 60,
      starttime: '2026-06-16T18:00:00Z',
      endtime: '2026-06-16T22:00:00Z',
      organiser_display_name: 'DJ Organiser',
      organiser_image: 'https://example.test/avatars/organiser.png',
      organiser_link: 'https://twitch.tv/djorganiser',
      organiser_timezone: 'UTC',
      raidpal_link: 'https://raidpal.com/event/trainwreck-lucky-13',
      event_extlink: null,
      inconsistent_slot_durations: false,
      time_table: [
        {
          order: 2,
          starttime: '2026-06-16T20:00:00Z',
          slot_occupied: true,
          user_timezone: 'Europe/Amsterdam',
          broadcaster_display_name: 'DJ Charlie',
          broadcaster_image: 'https://example.test/avatars/charlie.png',
          broadcaster_live: false,
          broadcaster_id: 'charlie-id',
        },
        {
          order: 0,
          starttime: '2026-06-16T18:00:00Z',
          slot_occupied: true,
          user_timezone: 'UTC',
          broadcaster_display_name: 'DJ Alpha',
          broadcaster_image: 'https://example.test/avatars/alpha.png',
          broadcaster_live: false,
          broadcaster_id: 'alpha-id',
        },
        {
          order: 3,
          starttime: '2026-06-16T21:00:00Z',
          slot_occupied: true,
          user_timezone: 'America/New_York',
          broadcaster_display_name: 'DJ Caboose',
          broadcaster_image: 'https://example.test/avatars/caboose.png',
          broadcaster_live: false,
          broadcaster_id: 'caboose-id',
        },
        {
          order: 1,
          starttime: '2026-06-16T19:00:00Z',
          slot_occupied: false,
          user_timezone: 'UTC',
          broadcaster_display_name: null,
          broadcaster_image: null,
          broadcaster_live: false,
          broadcaster_id: null,
        },
      ],
      ...eventOverrides,
    },
  };
}
