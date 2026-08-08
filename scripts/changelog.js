/**
 * Reads CHANGELOG.md so a release can be published from the file that already
 * describes it. Keep a Changelog headings look like `## [0.8.0] - 2026-08-08`,
 * and the trailing `[0.8.0]: https://…` link-reference block is presentation,
 * not release notes, so it is dropped.
 *
 * Pure string in, plain data out — no filesystem here, so the parsing is
 * testable without a fixture on disk (test/changelog.test.js).
 */

// `## [0.8.0] - 2026-08-08`, `## [Unreleased]`, and en-dash separators.
const HEADING = /^## \[([^\]]+)\]\s*(?:[-–—]\s*(.+?))?\s*$/;
// `[0.8.0]: https://github.com/…` — the link definitions at the foot of the file.
const LINK_REF = /^\[[^\]]+\]:\s+\S+\s*$/;

/** `v0.8.0`, ` 0.8.0 ` and `0.8.0` all name the same section. */
export function normalizeVersion(version) {
  return String(version ?? '').trim().replace(/^v/i, '');
}

/** Every version heading in the file, in document order. */
export function changelogVersions(markdown) {
  return String(markdown ?? '')
    .split('\n')
    .map((line) => HEADING.exec(line))
    .filter(Boolean)
    .map((m) => m[1]);
}

/**
 * The one section for `version`, or null when the file does not document it.
 * `body` is the section's prose with blank edges and link definitions removed.
 */
export function changelogSection(markdown, version) {
  const wanted = normalizeVersion(version);
  if (!wanted) return null;

  const lines = String(markdown ?? '').split('\n');
  let start = -1;
  let date = null;

  for (let i = 0; i < lines.length; i += 1) {
    const m = HEADING.exec(lines[i]);
    if (!m) continue;
    if (start === -1 && normalizeVersion(m[1]) === wanted) {
      start = i + 1;
      date = m[2] ?? null;
    } else if (start !== -1) {
      return { version: wanted, date, body: trimBody(lines.slice(start, i)) };
    }
  }

  if (start === -1) return null;
  return { version: wanted, date, body: trimBody(lines.slice(start)) };
}

function trimBody(lines) {
  const kept = lines.filter((line) => !LINK_REF.test(line));
  while (kept.length && kept[0].trim() === '') kept.shift();
  while (kept.length && kept[kept.length - 1].trim() === '') kept.pop();
  return kept.join('\n');
}
