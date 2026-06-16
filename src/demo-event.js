/**
 * A built-in, self-contained demo lineup for the Configurator's live preview and
 * the landing page. It renders WITHOUT touching RaidPal — no fetch, never 404s —
 * so the overlay always has something to show before you paste your own slug.
 *
 * Slot times are anchored to `now` so it always reads as a live event: a couple
 * of Cars have already played, one is live, the rest are upcoming — so every Car
 * state (departed/dimmed, NOW, upcoming, spotlight) is on display at once.
 */

// teknokat222 always kicks off the train — the first streamer, riding the first coach
// (slot order 0). The organiser (GoProSlowYo, below) drives the loco.
const KICKOFF = 'teknokat222';
// The two VIPs take the live + next slots, so they ride prominently spotlit
// (NOW + upcoming, never dimmed). Lowercased copy is the spotlight match list.
const VIPS = ['PatrickRichards', 'JackMonoDJ'];
// The supporting cast — shuffled between loads so the demo varies.
const OTHERS = ['vernigosh', 'spacetaco', 'OakDaddyDJs', 'cacespowboy', 'valdudes'];

/** The event slug that selects the demo instead of a RaidPal fetch. */
export const DEMO_SLUG = 'demo';
/** The VIPs the demo spotlights, lowercased to match parseConfig's name list. */
export const DEMO_SPOTLIGHT = VIPS.map((name) => name.toLowerCase());

/**
 * Build the demo Event in the normalized shape buildTrain expects, with slot
 * times placed around `now`. `rand` is injectable for deterministic tests.
 */
export function makeDemoEvent(now, rand = Math.random) {
  const slotMins = 30;
  const others = OTHERS.slice();
  for (let i = others.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  // Order: the kickoff streamer + two others (all already played), the live VIP, the
  // next VIP, then three upcoming — every Car state on display at once.
  const names = [KICKOFF, others[0], others[1], VIPS[0], VIPS[1], others[2], others[3], others[4]];
  const liveIndex = 3; // names[liveIndex] is on air now; before it has played, after is upcoming
  const slots = names.map((displayName, order) => ({
    order,
    occupied: true,
    // The live slot started 10 min ago; each slot is slotMins apart.
    starttime: new Date(now.getTime() + (order - liveIndex) * slotMins * 60_000 - 10 * 60_000),
    broadcaster: { displayName, image: '' },
  }));
  return {
    title: 'Demo Raid Train',
    organiser: { displayName: 'GoProSlowYo', image: '' },
    slotDurationMins: slotMins,
    slots,
  };
}
