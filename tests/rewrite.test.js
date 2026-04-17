// tests/rewrite.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeAiElements } from '../lib/merge.js';

const baseScene = (els = []) => ({
  type: 'excalidraw', version: 2, elements: els, appState: {}, files: {},
});

test('mergeAiElements marks a rewriteOf target as isDeleted in the merged output', () => {
  const originalAi = {
    id: 'ai-orig', type: 'rectangle', x: 0, y: 0, width: 10, height: 10,
    seed: 1, versionNonce: 1, groupIds: ['ai-v1'], isDeleted: false,
    customData: { source: 'ai', turn: 1 },
  };
  const scene = baseScene([originalAi]);
  const replacement = {
    id: 'ai-new', type: 'rectangle', x: 50, y: 50, width: 10, height: 10,
    seed: 2, versionNonce: 2, groupIds: [], customData: { rewriteOf: 'ai-orig' },
  };
  const out = mergeAiElements(scene, [replacement], 2);
  const orig = out.elements.find(e => e.id === 'ai-orig');
  const repl = out.elements.find(e => e.id === 'ai-new');
  assert.equal(orig.isDeleted, true, 'original AI element should be marked deleted');
  assert.ok(repl, 'replacement should be present');
  assert.equal(repl.customData.rewriteOf, 'ai-orig');
});

test('mergeAiElements leaves elements untouched when no rewriteOf is set', () => {
  const originalAi = {
    id: 'ai-orig', type: 'rectangle', x: 0, y: 0, width: 10, height: 10,
    seed: 1, versionNonce: 1, groupIds: ['ai-v1'], isDeleted: false,
    customData: { source: 'ai', turn: 1 },
  };
  const scene = baseScene([originalAi]);
  const out = mergeAiElements(scene, [{ id: 'new', type: 'rectangle', x: 5, y: 5,
    width: 10, height: 10, seed: 2, versionNonce: 2, groupIds: [] }], 2);
  assert.equal(out.elements.find(e => e.id === 'ai-orig').isDeleted, false);
});
