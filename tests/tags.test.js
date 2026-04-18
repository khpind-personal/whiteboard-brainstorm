import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTags, TAG_NAMES } from '../lib/tags.js';

const scene = (elements) => ({ type: 'excalidraw', version: 2, elements, appState: {}, files: {} });

test('parseTags recognizes @drop as a drop-zone anchor', () => {
  const els = [
    { id: 'a', type: 'text', x: 100, y: 200, width: 80, height: 20,
      text: '@drop here', originalText: '@drop here',
      seed: 1, versionNonce: 1 },
    { id: 'b', type: 'text', x: 0, y: 0, width: 40, height: 20,
      text: '@idea seed', originalText: '@idea seed',
      seed: 1, versionNonce: 1 },
  ];
  const tags = parseTags(scene(els));
  assert.equal(tags.get('drop').length, 1);
  assert.equal(tags.get('drop')[0].elId, 'a');
  assert.equal(tags.get('drop')[0].text, 'here');
});

test('parseTags recognizes @idea @problem @q @pin @rewrite @ping', () => {
  const els = TAG_NAMES.map((tag, i) => ({
    id: `e${i}`, type: 'text', x: i * 10, y: 0, width: 100, height: 20,
    text: `@${tag} sample`, originalText: `@${tag} sample`,
    seed: 1, versionNonce: 1,
  }));
  const out = parseTags(scene(els));
  assert.deepEqual([...out.keys()].sort(), TAG_NAMES.slice().sort());
});

test('parseTags returns elId, text, and element reference', () => {
  const els = [{
    id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 20,
    text: '@q is this correct?', originalText: '@q is this correct?',
    seed: 1, versionNonce: 1,
  }];
  const out = parseTags(scene(els));
  const qs = out.get('q');
  assert.equal(qs.length, 1);
  assert.equal(qs[0].elId, 'e1');
  assert.equal(qs[0].text, 'is this correct?');
});

test('parseTags is case-insensitive', () => {
  const els = [{
    id: 'e1', type: 'text', x: 0, y: 0, width: 100, height: 20,
    text: '@IDEA upper', originalText: '@IDEA upper',
    seed: 1, versionNonce: 1,
  }];
  const out = parseTags(scene(els));
  assert.equal(out.get('idea').length, 1);
});

test('parseTags ignores non-text elements and untagged text', () => {
  const els = [
    { id: 'r1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10, seed: 1, versionNonce: 1 },
    { id: 't1', type: 'text', x: 0, y: 0, width: 10, height: 10,
      text: 'just a note', originalText: 'just a note', seed: 1, versionNonce: 1 },
  ];
  const out = parseTags(scene(els));
  for (const tag of TAG_NAMES) assert.equal((out.get(tag) ?? []).length, 0);
});

test('parseTags splits multi-line text on newlines', () => {
  const els = [{
    id: 'e1', type: 'text', x: 0, y: 0, width: 200, height: 60,
    text: '@idea first\n@problem second\n@q third',
    originalText: '@idea first\n@problem second\n@q third',
    seed: 1, versionNonce: 1,
  }];
  const out = parseTags(scene(els));
  assert.equal(out.get('idea')[0].text, 'first');
  assert.equal(out.get('problem')[0].text, 'second');
  assert.equal(out.get('q')[0].text, 'third');
});
