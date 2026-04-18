// tests/merge.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeAiElements } from '../lib/merge.js';

const baseScene = (els = []) => ({
  type: 'excalidraw', version: 2, elements: els, appState: {}, files: {},
});

const userEl = { id: 'u1', type: 'rectangle', x: 0, y: 0, width: 10, height: 10,
                 seed: 1, versionNonce: 1, groupIds: [] };
const aiEl = { id: 'a1', type: 'rectangle', x: 100, y: 100, width: 10, height: 10,
               seed: 2, versionNonce: 2, groupIds: [] };

test('mergeAiElements preserves all user elements', () => {
  const scene = baseScene([userEl]);
  const out = mergeAiElements(scene, [aiEl], 1);
  assert.ok(out.elements.find(e => e.id === 'u1'));
});

test('mergeAiElements tags AI elements via customData.source=ai + customData.turn', () => {
  const scene = baseScene([userEl]);
  const out = mergeAiElements(scene, [aiEl], 3);
  const merged = out.elements.find(e => e.id === 'a1');
  assert.equal(merged.customData.source, 'ai');
  assert.equal(merged.customData.turn, 3);
  // No turn-level group — would force multi-select of all turn elements.
  assert.ok(!merged.groupIds.some(g => g.startsWith('ai-v')));
});

test('mergeAiElements preserves pre-existing AI elements from prior turns', () => {
  const priorAi = { ...aiEl, id: 'prev', customData: { source: 'ai', turn: 2 },
                    groupIds: ['ai-v2'] };
  const scene = baseScene([userEl, priorAi]);
  const out = mergeAiElements(scene, [aiEl], 3);
  assert.ok(out.elements.find(e => e.id === 'prev'));
  assert.ok(out.elements.find(e => e.id === 'a1'));
});

test('mergeAiElements preserves existing groupIds on AI elements', () => {
  const withGroup = { ...aiEl, groupIds: ['sticky-abc'] };
  const out = mergeAiElements(baseScene([]), [withGroup], 1);
  const merged = out.elements.find(e => e.id === 'a1');
  assert.ok(merged.groupIds.includes('sticky-abc'));
});
