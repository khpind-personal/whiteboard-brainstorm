import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNewAiElements } from '../lib/ai-diff.js';

const mk = (id, extras = {}) => ({
  id, type: 'rectangle', x: 0, y: 0, width: 10, height: 10,
  isDeleted: false, customData: { source: 'ai' },
  ...extras,
});

test('returns AI elements not in prev set', () => {
  const prev = new Set(['a']);
  const current = [mk('a'), mk('b')];
  const out = computeNewAiElements(prev, current);
  assert.deepEqual(out.map(e => e.id), ['b']);
});

test('skips non-AI elements', () => {
  const out = computeNewAiElements(new Set(), [
    { ...mk('u'), customData: undefined },
    mk('ai'),
  ]);
  assert.deepEqual(out.map(e => e.id), ['ai']);
});

test('skips archived elements', () => {
  const out = computeNewAiElements(new Set(), [
    mk('arch', { customData: { source: 'ai', archived: true } }),
    mk('fresh'),
  ]);
  assert.deepEqual(out.map(e => e.id), ['fresh']);
});

test('skips bound text (containerId set)', () => {
  const out = computeNewAiElements(new Set(), [
    mk('t', { type: 'text', containerId: 'rect-1' }),
    mk('r'),
  ]);
  assert.deepEqual(out.map(e => e.id), ['r']);
});

test('skips deleted elements', () => {
  const out = computeNewAiElements(new Set(), [
    mk('dead', { isDeleted: true }),
    mk('live'),
  ]);
  assert.deepEqual(out.map(e => e.id), ['live']);
});

test('accepts array instead of Set for prev', () => {
  const out = computeNewAiElements(['a'], [mk('a'), mk('b')]);
  assert.deepEqual(out.map(e => e.id), ['b']);
});

test('empty inputs yield empty output', () => {
  assert.deepEqual(computeNewAiElements(new Set(), []), []);
  assert.deepEqual(computeNewAiElements(null, null), []);
});

test('only shape types pass (rectangle, ellipse, text)', () => {
  const out = computeNewAiElements(new Set(), [
    mk('r'),
    mk('e', { type: 'ellipse' }),
    mk('t', { type: 'text' }),
    mk('a', { type: 'arrow', points: [[0,0],[10,10]] }),
  ]);
  assert.deepEqual(out.map(e => e.id).sort(), ['e', 'r', 't']);
});
