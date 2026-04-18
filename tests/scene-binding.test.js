// tests/scene-binding.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSticky, buildPanel, buildMindNode } from '../lib/scene.js';

test('buildSticky: uses free-floating text, not container-bound', () => {
  // Sticky text is free-floating (like panels) because Excalidraw's bound-text
  // auto-resize misbehaves on updateScene — causes blank / clipped text.
  const [rect, text] = buildSticky({ tone: 'question', text: 'hi' });
  assert.ok(Array.isArray(rect.boundElements));
  assert.equal(rect.boundElements.length, 0);
  assert.equal(text.containerId, undefined);
  assert.equal(text.autoResize, false);
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
