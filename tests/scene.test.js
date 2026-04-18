// tests/scene.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSticky } from '../lib/scene.js';
import { validateElement } from '../lib/schema.js';
import { STICKY_PALETTE, TEXT_COLOR } from '../lib/constants.js';

test('buildSticky produces rectangle + free-floating text sharing a groupId', () => {
  const [rect, text] = buildSticky({ tone: 'question', text: 'need auth?', x: 50, y: 50 });
  assert.equal(rect.type, 'rectangle');
  assert.equal(text.type, 'text');
  // Rect + text share one per-sticky group so they drag as a unit.
  // Text is NOT container-bound (Excalidraw's bound-text autoresize blanks out
  // after updateScene); autoResize: false wraps at the fixed width.
  assert.equal(rect.groupIds.length, 1);
  assert.equal(text.groupIds.length, 1);
  assert.equal(rect.groupIds[0], text.groupIds[0]);
  assert.equal(text.containerId, undefined);
  assert.equal(text.autoResize, false);
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

test('buildSticky wraps long single-line text into multiple lines', () => {
  const longText = 'This is a long single line sentence that should wrap into multiple lines once we insert explicit newlines';
  const [rect, text] = buildSticky({ tone: 'question', text: longText });
  const lines = text.text.split('\n');
  assert.ok(lines.length >= 2, `expected wrap, got ${lines.length} lines`);
  for (const ln of lines) {
    assert.ok(ln.length <= 42 + 10, `line too long: ${ln.length} chars`);
  }
  // Rectangle height must grow to fit all wrapped lines.
  assert.ok(rect.height >= lines.length * 20);
});

test('buildSticky hard-breaks a single word longer than the wrap width', () => {
  const [, text] = buildSticky({
    tone: 'neutral',
    text: 'supercalifragilisticexpialidociousaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });
  const lines = text.text.split('\n');
  assert.ok(lines.length >= 2);
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

test('buildMindNode ellipse + arrow share a groupId; text is container-bound', () => {
  const parent = { id: 'p1', x: 0, y: 0, width: 80, height: 40 };
  const els = buildMindNode({ text: 'c', parent });
  const ellipse = els.find(e => e.type === 'ellipse');
  const text    = els.find(e => e.type === 'text');
  const arrow   = els.find(e => e.type === 'arrow');
  const gid = ellipse.groupIds[0];
  assert.ok(arrow.groupIds.includes(gid));
  // text is bound via containerId and carries no groupIds (ungroup safety)
  assert.equal(text.groupIds.length, 0);
  assert.equal(text.containerId, ellipse.id);
});

import { buildAnnotation } from '../lib/scene.js';

test('buildAnnotation circle kind produces ellipse around target bbox', () => {
  const target = { id: 't1', x: 100, y: 100, width: 80, height: 40 };
  const [el] = buildAnnotation({ target, kind: 'circle', color: 'critical' });
  assert.equal(el.type, 'ellipse');
  assert.ok(el.x <= target.x);
  assert.ok(el.x + el.width >= target.x + target.width);
  assert.equal(el.strokeColor, '#E03131');
  assert.equal(el.backgroundColor, 'transparent');
});

test('buildAnnotation arrow kind binds to target', () => {
  const target = { id: 't1', x: 100, y: 100, width: 80, height: 40 };
  const els = buildAnnotation({ target, kind: 'arrow', color: 'caution', note: 'check this' });
  const arrow = els.find(e => e.type === 'arrow');
  assert.equal(arrow.endBinding.elementId, 't1');
  assert.equal(arrow.strokeColor, '#F59F00');
});

test('buildAnnotation underline kind produces line below target', () => {
  const target = { id: 't1', x: 100, y: 100, width: 80, height: 40 };
  const [el] = buildAnnotation({ target, kind: 'underline', color: 'validated' });
  assert.equal(el.type, 'line');
  assert.ok(el.y >= target.y + target.height);
  assert.equal(el.strokeColor, '#2F9E44');
});

test('buildAnnotation rejects unknown color role', () => {
  const target = { id: 't1', x: 0, y: 0, width: 10, height: 10 };
  assert.throws(() => buildAnnotation({ target, kind: 'circle', color: 'banana' }));
});

import { buildPanel } from '../lib/scene.js';

test('buildPanel produces rectangle + title text + body text', () => {
  const els = buildPanel({ title: 'Summary', body: 'line 1\nline 2\nline 3', x: 0, y: 0 });
  const types = els.map(e => e.type).sort();
  assert.deepEqual(types, ['rectangle', 'text', 'text']);
});

test('buildPanel height grows with body line count', () => {
  const short = buildPanel({ title: 't', body: 'one line' });
  const long  = buildPanel({ title: 't', body: Array(8).fill('line').join('\n') });
  const shortRect = short.find(e => e.type === 'rectangle');
  const longRect  = long.find(e => e.type === 'rectangle');
  assert.ok(longRect.height > shortRect.height);
});

test('buildPanel all elements share a groupId', () => {
  const els = buildPanel({ title: 't', body: 'b' });
  const gid = els[0].groupIds[0];
  for (const el of els) assert.ok(el.groupIds.includes(gid));
});
