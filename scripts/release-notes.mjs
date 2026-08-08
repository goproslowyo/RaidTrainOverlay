#!/usr/bin/env node
/**
 * Prints the CHANGELOG section for one version, for `gh release create
 * --notes-file`. Run: `node scripts/release-notes.mjs v0.8.0 [--verify]`.
 *
 * `--verify` additionally asserts that package.json's version matches the tag
 * being released. That guard exists because v0.8.0 was first tagged one commit
 * early, at a tree where package.json still said 0.7.2 and the CHANGELOG had no
 * 0.8.0 section — a release that did not contain its own release notes, and
 * nothing said so. On a tag push the workspace IS the tag, so the mismatch is
 * detectable; on a manual backfill run it is not (the workspace is main), which
 * is why the flag is opt-in rather than always on.
 */
import { readFile } from 'node:fs/promises';
import { changelogSection, changelogVersions, normalizeVersion } from './changelog.js';

const args = process.argv.slice(2);
const verify = args.includes('--verify');
const version = args.find((a) => !a.startsWith('--'));

if (!version) {
  fail('usage: node scripts/release-notes.mjs <version> [--verify]');
}

const url = (name) => new URL(`../${name}`, import.meta.url);
const markdown = await readFile(url('CHANGELOG.md'), 'utf8');
const section = changelogSection(markdown, version);

if (!section) {
  fail(
    `CHANGELOG.md documents no section for ${version}.\n` +
      `Known versions: ${changelogVersions(markdown).join(', ') || '(none)'}`,
  );
}

if (verify) {
  const { version: pkgVersion } = JSON.parse(await readFile(url('package.json'), 'utf8'));
  if (normalizeVersion(pkgVersion) !== normalizeVersion(version)) {
    fail(
      `Tagged ${version} but package.json says ${pkgVersion}.\n` +
        'The tag is probably on the wrong commit — it should point at the ' +
        'chore(release) commit that bumps the version and adds the CHANGELOG entry.',
    );
  }
}

process.stdout.write(`${section.body}\n`);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
