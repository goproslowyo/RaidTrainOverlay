import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorStyle } from '../src/upcoming-card.js';

// The DOM half of upcoming-card is verified headless in the browser sweep;
// the anchor grammar is the pure part, so it gets unit coverage here.

test('anchorStyle places each of the nine anchors on its own edge pair', () => {
  assert.match(anchorStyle('tl'), /top:24px/);
  assert.match(anchorStyle('tl'), /left:24px/);
  assert.match(anchorStyle('br'), /bottom:24px/);
  assert.match(anchorStyle('br'), /right:24px/);
  assert.match(anchorStyle('mc'), /top:50%/);
  assert.match(anchorStyle('mc'), /justify-content:center/);
  assert.match(anchorStyle('bc'), /bottom:24px/);
  assert.match(anchorStyle('bc'), /justify-content:center/);
});

test('anchorStyle always carries a max-width ceiling (the ticker is one long line)', () => {
  for (const key of ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']) {
    assert.match(anchorStyle(key), /max-width:calc\(100% - 48px\)/, key);
  }
});

test('anchorStyle falls back to bottom-centre for a missing key', () => {
  assert.equal(anchorStyle(undefined), anchorStyle('bc'));
});
