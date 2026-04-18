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

test('placeNear keeps shifting down in the same column when blocked', () => {
  const target = bbox(100, 100, 80, 40);
  // Two tall blockers at the target's anchor column; placement should land
  // BELOW them rather than flipping to a distant grid slot.
  const blockers = [bbox(220, 140, 400, 200), bbox(220, 360, 400, 200)];
  const pt = placeNear(target, blockers);
  assert.equal(pt.x, 220);
  assert.ok(pt.y >= 560, `expected y below both blockers, got ${pt.y}`);
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

test('computeDropZone anchors at right edge even for far-out elements', () => {
  // Clamping was removed: AI elements should follow user content, not snap
  // back and overlap it. placeNear provides its own fallback for extremes.
  const z = computeDropZone([{ x: 10000, y: 0, width: 100, height: 100 }]);
  assert.equal(z.x, 10100);
});

test('placeNear returns the anchored column x even for far-right targets', () => {
  // No clamp: the AI drop zone follows user content to wherever it landed.
  // Extreme right targets are now tolerated; the column stays stable.
  const target = { x: 5000, y: 0, width: 100, height: 100 };
  const pt = placeNear(target, []);
  assert.equal(pt.x, 5140);
});
