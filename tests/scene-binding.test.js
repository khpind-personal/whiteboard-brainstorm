// tests/scene-binding.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSticky, buildPanel, buildMindNode } from '../lib/scene.js';

test('buildSticky: rectangle.boundElements contains the text element id', () => {
  const [rect, text] = buildSticky({ tone: 'question', text: 'hi' });
  assert.ok(Array.isArray(rect.boundElements));
  assert.ok(rect.boundElements.some(b => b.id === text.id && b.type === 'text'));
  assert.equal(text.containerId, rect.id);
});

test('buildPanel: rectangle.boundElements contains both title and body text ids', () => {
  const els = buildPanel({ title: 'T', body: 'B' });
  const [rect, titleEl, bodyEl] = els;
  const ids = rect.boundElements.map(b => b.id);
  assert.ok(ids.includes(titleEl.id));
  assert.ok(ids.includes(bodyEl.id));
});

test('buildMindNode: ellipse.boundElements contains the text id', () => {
  const [ellipse, text] = buildMindNode({ text: 'node' });
  assert.ok(Array.isArray(ellipse.boundElements));
  assert.ok(ellipse.boundElements.some(b => b.id === text.id));
});
