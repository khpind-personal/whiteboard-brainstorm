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

test('buildPanel: rectangle does NOT bind its text children (avoids Excalidraw multi-bind render bug)', () => {
  // Panels use free-floating text inside the rect instead of container binding
  // because Excalidraw only supports a single bound text per container and a
  // second entry in boundElements renders invisible.
  const els = buildPanel({ title: 'T', body: 'B' });
  const [rect, titleEl, bodyEl] = els;
  assert.ok(Array.isArray(rect.boundElements));
  assert.equal(rect.boundElements.length, 0);
  assert.equal(titleEl.containerId, undefined);
  assert.equal(bodyEl.containerId, undefined);
});

test('buildMindNode: ellipse.boundElements contains the text id', () => {
  const [ellipse, text] = buildMindNode({ text: 'node' });
  assert.ok(Array.isArray(ellipse.boundElements));
  assert.ok(ellipse.boundElements.some(b => b.id === text.id));
});
