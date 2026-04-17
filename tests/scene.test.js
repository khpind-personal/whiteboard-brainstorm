// tests/scene.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSticky } from '../lib/scene.js';
import { validateElement } from '../lib/schema.js';
import { STICKY_PALETTE, TEXT_COLOR } from '../lib/constants.js';

test('buildSticky produces rectangle + text pair with matching groupId', () => {
  const [rect, text] = buildSticky({ tone: 'question', text: 'need auth?', x: 50, y: 50 });
  assert.equal(rect.type, 'rectangle');
  assert.equal(text.type, 'text');
  assert.deepEqual(rect.groupIds, text.groupIds);
  assert.equal(rect.groupIds.length, 1);
});

test('buildSticky assigns palette fill matching tone', () => {
  for (const tone of ['question', 'insight', 'warning', 'action', 'neutral']) {
    const [rect] = buildSticky({ tone, text: 't' });
    assert.equal(rect.backgroundColor, STICKY_PALETTE[tone], `tone ${tone}`);
  }
});

test('buildSticky sets text color to high-contrast dark', () => {
  const [, text] = buildSticky({ tone: 'question', text: 'hi' });
  assert.equal(text.strokeColor, TEXT_COLOR);
});

test('buildSticky rectangle and text pass element validator', () => {
  const els = buildSticky({ tone: 'insight', text: 'hi' });
  for (const el of els) assert.equal(validateElement(el).ok, true);
});

test('buildSticky throws on unknown tone', () => {
  assert.throws(() => buildSticky({ tone: 'banana', text: 'x' }), /tone/);
});

test('buildSticky text width fits inside rectangle with padding', () => {
  const [rect, text] = buildSticky({ tone: 'question', text: 'short' });
  assert.ok(text.x >= rect.x + 8);
  assert.ok(text.x + text.width <= rect.x + rect.width - 8);
});

import { buildMindNode } from '../lib/scene.js';

test('buildMindNode emits ellipse + text + arrow when parent given', () => {
  const parent = { id: 'p1', x: 100, y: 100, width: 80, height: 40 };
  const els = buildMindNode({ text: 'child', parent, angleRad: 0 });
  const types = els.map(e => e.type).sort();
  assert.deepEqual(types, ['arrow', 'ellipse', 'text']);
});

test('buildMindNode without parent emits ellipse + text only', () => {
  const els = buildMindNode({ text: 'root' });
  const types = els.map(e => e.type).sort();
  assert.deepEqual(types, ['ellipse', 'text']);
});

test('buildMindNode arrow endpoints bound to parent and child ids', () => {
  const parent = { id: 'p1', x: 0, y: 0, width: 80, height: 40 };
  const els = buildMindNode({ text: 'c', parent });
  const arrow = els.find(e => e.type === 'arrow');
  const ellipse = els.find(e => e.type === 'ellipse');
  assert.equal(arrow.startBinding.elementId, 'p1');
  assert.equal(arrow.endBinding.elementId, ellipse.id);
});

test('buildMindNode all elements share a groupId', () => {
  const parent = { id: 'p1', x: 0, y: 0, width: 80, height: 40 };
  const els = buildMindNode({ text: 'c', parent });
  const gid = els[0].groupIds[0];
  for (const el of els) assert.ok(el.groupIds.includes(gid));
});
