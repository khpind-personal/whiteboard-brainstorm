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

test('mergeAiElements with op:restructure archives prior AI elements', () => {
  const priorAi = { ...aiEl, id: 'prev',
    customData: { source: 'ai', turn: 1 }, opacity: 100, strokeStyle: 'solid' };
  const newAi = { ...aiEl, id: 'fresh', customData: { op: 'restructure' } };
  const out = mergeAiElements(baseScene([userEl, priorAi]), [newAi], 2);
  const archived = out.elements.find(e => e.id === 'prev');
  assert.equal(archived.opacity, 25);
  assert.equal(archived.strokeStyle, 'dashed');
  assert.equal(archived.customData.archived, true);
  assert.equal(archived.customData.archivedAt, 2);
});

test('mergeAiElements with op:restructure does NOT touch user elements', () => {
  const newAi = { ...aiEl, id: 'fresh', customData: { op: 'restructure' } };
  const out = mergeAiElements(baseScene([userEl]), [newAi], 2);
  const user = out.elements.find(e => e.id === 'u1');
  assert.notEqual(user.opacity, 25);
  assert.ok(!user.customData || !user.customData.archived);
});

test('mergeAiElements with op:restructure does NOT re-archive already-archived elements', () => {
  const priorArchived = { ...aiEl, id: 'old',
    customData: { source: 'ai', archived: true, archivedAt: 1, turn: 1 },
    opacity: 25, strokeStyle: 'dashed' };
  const newAi = { ...aiEl, id: 'fresh', customData: { op: 'restructure' } };
  const out = mergeAiElements(baseScene([priorArchived]), [newAi], 5);
  const kept = out.elements.find(e => e.id === 'old');
  assert.equal(kept.customData.archivedAt, 1);  // preserved
});

test('rewriteOf takes precedence over restructure archive on same element', () => {
  const prior = { ...aiEl, id: 'target', customData: { source: 'ai', turn: 1 } };
  const replacement = { ...aiEl, id: 'fresh',
    customData: { op: 'restructure', rewriteOf: 'target' } };
  const out = mergeAiElements(baseScene([prior]), [replacement], 2);
  const replaced = out.elements.find(e => e.id === 'target');
  assert.equal(replaced.isDeleted, true);
  assert.notEqual(replaced.opacity, 25);
});

test('mergeAiElements without op:restructure leaves prior AI elements untouched', () => {
  const priorAi = { ...aiEl, id: 'prev',
    customData: { source: 'ai', turn: 1 }, opacity: 100 };
  const out = mergeAiElements(baseScene([priorAi]), [aiEl], 2);
  const prev = out.elements.find(e => e.id === 'prev');
  assert.equal(prev.opacity, 100);
  assert.ok(!prev.customData.archived);
});
