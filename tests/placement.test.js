import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeNear, nextGridSlot } from '../lib/placement.js';

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
