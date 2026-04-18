import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeNear, nextGridSlot, computeDropZone, isUserAuthored } from '../lib/placement.js';

const bbox = (x, y, w, h) => ({ x, y, width: w, height: h });

test('placeNear returns point 40px right + 40px below target bbox by default', () => {
  const target = bbox(100, 100, 80, 40);
  const pt = placeNear(target, []);
  assert.equal(pt.x, 100 + 80 + 40);
  assert.equal(pt.y, 100 + 40);
});

test('placeNear shifts down 20px on overlap, up to 10 tries', () => {
  const target = bbox(100, 100, 80, 40);
  const blockers = [
    bbox(220, 140, 200, 80),
    bbox(220, 160, 200, 80),
  ];
  const pt = placeNear(target, blockers);
  assert.ok(pt.y > 160 + 80 || pt.x !== 220);
});

test('placeNear falls back to nextGridSlot after 10 collisions', () => {
  const target = bbox(100, 100, 80, 40);
  const blockers = Array.from({ length: 11 }, (_, i) =>
    bbox(220, 140 + i * 20, 400, 80));
  const pt = placeNear(target, blockers);
  assert.ok(pt.fallback === true);
});

test('nextGridSlot returns a slot not overlapping any existing bbox', () => {
  const blockers = [bbox(0, 0, 100, 100), bbox(100, 0, 100, 100)];
  const viewport = bbox(0, 0, 1000, 1000);
  const pt = nextGridSlot(viewport, blockers, 100, 100);
  assert.ok(pt.x !== 0 || pt.y !== 0);
});

test('isUserAuthored returns true for elements without ai source', () => {
  assert.equal(isUserAuthored({ id: 'x' }), true);
  assert.equal(isUserAuthored({ id: 'x', customData: {} }), true);
  assert.equal(isUserAuthored({ id: 'x', customData: { source: 'ai' } }), false);
});

test('computeDropZone returns origin when no user elements', () => {
  const z = computeDropZone([]);
  assert.equal(z.x, 0);
  assert.equal(z.y, 0);
});

test('computeDropZone anchors to right edge of user bbox', () => {
  const userElements = [
    { x: 100, y: 80, width: 200, height: 100 },
    { x: 350, y: 200, width: 300, height: 100 },
  ];
  const z = computeDropZone(userElements);
  // Right edge of user bbox is 350 + 300 = 650
  assert.equal(z.x, 650);
  assert.equal(z.y, 80);
});

test('computeDropZone clamps x below MAX_X even for far-out elements', () => {
  const z = computeDropZone([{ x: 10000, y: 0, width: 100, height: 100 }]);
  assert.ok(z.x <= 2400, `drop-zone x ${z.x} should be clamped below 2400`);
});

test('placeNear returns fallback when candidate x exceeds MAX_X', () => {
  // Anchor far right — every try stays beyond MAX_X so we should fall through.
  const target = { x: 5000, y: 0, width: 100, height: 100 };
  const pt = placeNear(target, []);
  assert.ok(pt.fallback === true);
  assert.ok(pt.x < 2400);
});
