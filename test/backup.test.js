import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encodeBackup, decodeBackup } from '../src/backup.js';
import { createPreset } from '../src/preset-library.js';
import { addProfile, upsertTrainConfig } from '../src/profiles.js';

function makeStores() {
  const { library: presets } = createPreset({}, 'Neon Night', { theme: 'synthwave', mode: 'marquee' }, () => 'id-1');
  let profiles = addProfile({ active: null, profiles: {} }, 'goproflowyo');
  profiles = upsertTrainConfig(profiles, 'goproflowyo', 'luna-hao8', { presetId: 'id-1', overrides: { theme: 'lava' } });
  const streamers = ['DJFriend', 'TeamMate'];
  return { presets, profiles, streamers };
}

test('encode/decodeBackup round-trips Presets, Profiles (with Raid Train Configs), and streamers', async () => {
  const stores = makeStores();
  const blob = await encodeBackup(stores);
  assert.match(blob, /^[A-Za-z0-9_-]+$/); // URL/paste-safe base64url, no padding
  const decoded = await decodeBackup(blob);
  assert.deepEqual(decoded, stores);
});

test('the blob is compressed — a repetitive store encodes far smaller than its JSON', async () => {
  let profiles = addProfile({ active: null, profiles: {} }, 'goproflowyo');
  for (let i = 0; i < 200; i += 1) {
    profiles = upsertTrainConfig(profiles, 'goproflowyo', `train-${i}`, { presetId: 'id-1', overrides: { theme: 'synthwave' } });
  }
  const stores = { presets: {}, profiles, streamers: [] };
  const blob = await encodeBackup(stores);
  assert.ok(blob.length < JSON.stringify(stores).length / 4, `blob ${blob.length} not < 1/4 of JSON`);
  assert.deepEqual((await decodeBackup(blob)).profiles, profiles);
});

test('decodeBackup is fail-soft: garbage, empty, non-gzip, wrong version → null', async () => {
  assert.equal(await decodeBackup('not a blob at all!!'), null);
  assert.equal(await decodeBackup(''), null);
  assert.equal(await decodeBackup(null), null);
  // Valid base64url of NON-gzip bytes.
  assert.equal(await decodeBackup(btoa('{"v":1}').replace(/=+$/, '')), null);
  // A real blob, tampered to a future version, refuses to import.
  const stores = makeStores();
  const v99 = await encodeBackup(stores, { version: 99 });
  assert.equal(await decodeBackup(v99), null);
});

test('decodeBackup degrades malformed sections through the tolerant store parsers', async () => {
  // Hand-build a wire whose sections are the wrong shapes: the import yields
  // safe empties rather than rejecting the whole blob or importing garbage.
  const blob = await encodeBackup({ presets: [1, 2, 3], profiles: 'nope', streamers: { a: 1 } });
  const decoded = await decodeBackup(blob);
  assert.deepEqual(decoded.presets, {});
  assert.deepEqual(decoded.profiles, { active: null, profiles: {} });
  assert.deepEqual(decoded.streamers, []);
});

test('decodeBackup rejects an oversized blob', async () => {
  assert.equal(await decodeBackup('A'.repeat(1_100_000)), null);
});
