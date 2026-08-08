import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { changelogSection, changelogVersions, normalizeVersion } from '../scripts/changelog.js';

const SAMPLE = [
  '# Changelog',
  '',
  'Preamble prose that belongs to no version.',
  '',
  '## [0.2.0] - 2026-08-08',
  '',
  '### Added',
  '- A thing.',
  '',
  '## [0.1.0] - 2026-01-01',
  '',
  '- The first one.',
  '',
  '[0.2.0]: https://example.invalid/releases/tag/v0.2.0',
  '[0.1.0]: https://example.invalid/releases/tag/v0.1.0',
  '',
].join('\n');

// ---- version naming ----

test('normalizeVersion accepts the tag and the bare version alike', () => {
  assert.equal(normalizeVersion('v0.8.0'), '0.8.0');
  assert.equal(normalizeVersion(' 0.8.0 '), '0.8.0');
  assert.equal(normalizeVersion('0.8.0'), '0.8.0');
  assert.equal(normalizeVersion(undefined), '');
});

test('changelogVersions lists every heading in document order', () => {
  assert.deepEqual(changelogVersions(SAMPLE), ['0.2.0', '0.1.0']);
});

// ---- section extraction ----

test('changelogSection returns one version, not its neighbours or the preamble', () => {
  const section = changelogSection(SAMPLE, 'v0.2.0');
  assert.equal(section.version, '0.2.0');
  assert.equal(section.date, '2026-08-08');
  assert.equal(section.body, '### Added\n- A thing.');
});

test('changelogSection reads the last section without running past the link block', () => {
  // The oldest entry has no following heading, so only the link-reference
  // filter stops the body swallowing the footer.
  const section = changelogSection(SAMPLE, '0.1.0');
  assert.equal(section.body, '- The first one.');
});

test('changelogSection is null for a version the file does not document', () => {
  assert.equal(changelogSection(SAMPLE, 'v9.9.9'), null);
  assert.equal(changelogSection(SAMPLE, ''), null);
});

// ---- the real file ----

test('every released version in CHANGELOG.md yields non-empty release notes', async () => {
  const markdown = await readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const versions = changelogVersions(markdown);
  assert.ok(versions.length >= 10, `expected the full release history, saw ${versions.length}`);

  for (const version of versions) {
    const section = changelogSection(markdown, version);
    assert.ok(section, `no section extracted for ${version}`);
    assert.ok(section.body.trim().length > 0, `${version} has an empty body`);
    assert.ok(!/^\[[^\]]+\]:\s/m.test(section.body), `${version} leaked a link definition`);
  }
});

test("package.json's version has a CHANGELOG entry, so it is releasable", async () => {
  // The guard `scripts/release-notes.mjs --verify` enforces on a tag push,
  // checked here too so a version bump without an entry fails at PR time.
  const [markdown, pkg] = await Promise.all([
    readFile(new URL('../CHANGELOG.md', import.meta.url), 'utf8'),
    readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ]);
  const { version } = JSON.parse(pkg);
  assert.ok(changelogSection(markdown, version), `CHANGELOG.md documents no ${version} section`);
});
