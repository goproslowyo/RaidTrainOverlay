import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTrains, trainCardHtml, whenLabel } from '../src/train-list.js';
import { makeT } from '../src/i18n/index.js';
import enMessages from '../src/i18n/locales/en.js';

// The real English catalog, so these assertions exercise the shipped strings
// rather than a stub — a key deleted from en.js fails here, not just in CI.
const t = makeT(enMessages);

const NOW = new Date('2026-08-07T18:00:00Z');
const at = (iso, hours) => ({
  slug: iso, title: `Train ${iso}`, organiser: false,
  starttime: new Date(iso), endtime: new Date(new Date(iso).getTime() + hours * 3600_000),
});

test('classifyTrains splits on the clock, not on any API status', () => {
  const running = at('2026-08-07T16:00:00Z', 6);   // started, not finished
  const soon = at('2026-08-08T20:00:00Z', 4);
  const later = at('2026-08-20T20:00:00Z', 4);
  const done = at('2026-07-26T20:00:00Z', 4);
  const { live, upcoming, past } = classifyTrains([later, done, running, soon], NOW);
  assert.deepEqual(live.map((e) => e.slug), [running.slug]);
  assert.deepEqual(upcoming.map((e) => e.slug), [soon.slug, later.slug], 'upcoming ascends');
  assert.deepEqual(past.map((e) => e.slug), [done.slug]);
});

test('a train is live right up to its end, and departed only after it', () => {
  const ending = at('2026-08-07T12:00:00Z', 6); // ends exactly at NOW
  assert.equal(classifyTrains([ending], NOW).live.length, 1);
  assert.equal(classifyTrains([ending], new Date(NOW.getTime() + 1)).past.length, 1);
  // A train starting exactly now is live, not upcoming.
  const starting = at('2026-08-07T18:00:00Z', 2);
  assert.equal(classifyTrains([starting], NOW).live.length, 1);
});

test('departed trains list most-recent first', () => {
  const older = at('2026-06-01T20:00:00Z', 4);
  const newer = at('2026-07-26T20:00:00Z', 4);
  assert.deepEqual(classifyTrains([older, newer], NOW).past.map((e) => e.slug), [newer.slug, older.slug]);
});

test('whenLabel says Today for a train departing today', () => {
  const today = at('2026-08-07T22:00:00Z', 3);
  assert.match(whenLabel(today, NOW, 'en-US', t), /^Today · /);
  const other = at('2026-08-20T22:00:00Z', 3);
  assert.ok(!whenLabel(other, NOW, 'en-US', t).startsWith('Today'));
});

test('the card shows live / organiser / config chips and escapes user text', () => {
  const event = { ...at('2026-08-07T16:00:00Z', 6), title: '<script>x</script>', organiser: true };
  const html = trainCardHtml({
    event, status: 'live', when: 'Today · 4 PM – 10 PM',
    detail: { slots: 12, filled: 11 }, config: { presetName: 'House', overrideCount: 2 },
  }, t);
  assert.match(html, /LIVE NOW/);
  assert.match(html, /Organiser/);
  assert.match(html, /House \+2/);
  assert.match(html, /11\/12/);
  assert.ok(!html.includes('<script>'), 'the RaidPal title is escaped');
});

test('a departed card is stamped and drops its mini-train; a failed detail still renders', () => {
  const event = at('2026-07-26T20:00:00Z', 4);
  const departed = trainCardHtml({ event, status: 'past', when: 'Sun, Jul 26', detail: { slots: 8, filled: 8 } }, t);
  assert.match(departed, /Departed/);
  assert.ok(!departed.includes('mini-train'));

  const failed = trainCardHtml({ event, status: 'upcoming', when: 'Sun, Jul 26', error: new Error('nope') }, t);
  assert.match(failed, /couldn’t refresh/);
  assert.match(failed, /data-act="open-config"/, 'the card stays usable when RaidPal fails');
});
