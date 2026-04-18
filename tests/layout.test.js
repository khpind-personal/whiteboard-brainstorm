import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupUnits, columnLayout, gridLayout, applyLayout } from '../lib/layout.js';

const box = (id, x, y, w, h, extras = {}) => ({
  id, x, y, width: w, height: h,
  seed: 1, versionNonce: 1,
  groupIds: [], isDeleted: false,
  ...extras,
});

test('groupUnits: adjacent stickies yield separate units', () => {
  const els = [
    box('r1', 0, 0, 100, 50, { type: 'rectangle', groupIds: ['sticky-a'] }),
    box('t1', 5, 5, 90, 40, { type: 'text', groupIds: ['sticky-a'] }),
    box('r2', 140, 0, 100, 50, { type: 'rectangle', groupIds: ['sticky-b'] }),
    box('t2', 145, 5, 90, 40, { type: 'text', groupIds: ['sticky-b'] }),
  ];
  const units = groupUnits(els);
  assert.equal(units.length, 2);
  const a = units.find(u => u.groupId === 'sticky-a');
  assert.equal(a.members.length, 2);
  assert.equal(a.bbox.x, 0);
  assert.equal(a.bbox.w, 100);
});

test('groupUnits: bound text inherits its container unit', () => {
  const els = [
    box('c1', 0, 0, 80, 80, { type: 'ellipse', groupIds: ['mind-a'] }),
    // bound text: containerId set, groupIds empty
    box('bt', 10, 30, 60, 20, { type: 'text', containerId: 'c1', groupIds: [] }),
  ];
  const units = groupUnits(els);
  assert.equal(units.length, 1);
  assert.equal(units[0].groupId, 'mind-a');
  assert.equal(units[0].members.length, 2);
});

test('groupUnits: standalone element keyed by its id', () => {
  const els = [box('loner', 0, 0, 40, 40, { type: 'rectangle' })];
  const units = groupUnits(els);
  assert.equal(units.length, 1);
  assert.equal(units[0].groupId, 'loner');
});

test('groupUnits: deleted and bbox-less elements skipped', () => {
  const els = [
    box('r1', 0, 0, 100, 50, { type: 'rectangle', groupIds: ['sticky-a'] }),
    { id: 'dead', type: 'rectangle', isDeleted: true, x: 0, y: 0, width: 1, height: 1 },
    { id: 'nobox', type: 'text', groupIds: [] },
  ];
  const units = groupUnits(els);
  assert.equal(units.length, 1);
});

test('columnLayout: stacks units vertically with gapY', () => {
  const units = [
    { groupId: 'a', members: [], bbox: { x: 50, y: 30, w: 100, h: 40 } },
    { groupId: 'b', members: [], bbox: { x: 70, y: 200, w: 100, h: 40 } },
  ];
  const d = columnLayout(units, { startX: 0, startY: 0, gapY: 20 });
  assert.equal(d.get('a').dx, -50);
  assert.equal(d.get('a').dy, -30);
  assert.equal(d.get('b').dy, 0 + 40 + 20 - 200); // next y = 60; target origin 60
});

test('columnLayout: wraps to second column at maxHeight', () => {
  const units = [
    { groupId: 'a', members: [], bbox: { x: 0, y: 0, w: 100, h: 60 } },
    { groupId: 'b', members: [], bbox: { x: 0, y: 0, w: 100, h: 60 } },
    { groupId: 'c', members: [], bbox: { x: 0, y: 0, w: 100, h: 60 } },
  ];
  const d = columnLayout(units, { startX: 0, startY: 0, gapX: 20, gapY: 10, maxHeight: 100 });
  // a at (0,0). b would span (0,70)→(0,130) > 100 so wraps to col 2 at (120,0).
  assert.equal(d.get('a').dx, 0);
  assert.equal(d.get('a').dy, 0);
  assert.equal(d.get('b').dx, 120);
  assert.equal(d.get('b').dy, 0);
});

test('gridLayout: respects cols and row heights', () => {
  const units = [
    { groupId: 'a', members: [], bbox: { x: 0, y: 0, w: 80, h: 40 } },
    { groupId: 'b', members: [], bbox: { x: 0, y: 0, w: 80, h: 80 } },
    { groupId: 'c', members: [], bbox: { x: 0, y: 0, w: 80, h: 40 } },
    { groupId: 'd', members: [], bbox: { x: 0, y: 0, w: 80, h: 40 } },
  ];
  const d = gridLayout(units, { startX: 0, startY: 0, gapX: 10, gapY: 10, cols: 2 });
  // Row 0 (a, b): a at (0,0); b at (90,0). Row height = max(40,80) = 80.
  assert.equal(d.get('a').dx, 0);
  assert.equal(d.get('b').dx, 90);
  // Row 1 (c, d): starts at y = 0 + 80 + 10 = 90.
  assert.equal(d.get('c').dy, 90);
  assert.equal(d.get('d').dx, 90);
  assert.equal(d.get('d').dy, 90);
});

test('applyLayout: shifts every member of a unit by the delta', () => {
  const els = [
    box('r', 0, 0, 100, 50, { type: 'rectangle', groupIds: ['u'] }),
    box('t', 10, 10, 80, 30, { type: 'text', groupIds: ['u'] }),
  ];
  const deltas = new Map([['u', { dx: 200, dy: 300 }]]);
  const out = applyLayout(els, deltas);
  assert.equal(out[0].x, 200);
  assert.equal(out[0].y, 300);
  assert.equal(out[1].x, 210);
  assert.equal(out[1].y, 310);
  // Intra-unit offsets preserved.
  assert.equal(out[1].x - out[0].x, 10);
});

test('applyLayout: no-ops elements whose unit isn\'t in deltas', () => {
  const els = [
    box('r', 5, 5, 50, 30, { type: 'rectangle', groupIds: ['u'] }),
    box('other', 100, 100, 50, 30, { type: 'rectangle', groupIds: ['v'] }),
  ];
  const out = applyLayout(els, new Map([['u', { dx: 10, dy: 10 }]]));
  assert.equal(out[1].x, 100);
  assert.equal(out[1].y, 100);
});

test('applyLayout: arrow points array is NOT mutated when arrow shifts', () => {
  const arrow = {
    id: 'arr', type: 'arrow', x: 0, y: 0, width: 100, height: 50,
    points: [[0, 0], [100, 50]],
    groupIds: ['u'], isDeleted: false, seed: 1, versionNonce: 1,
  };
  const out = applyLayout([arrow], new Map([['u', { dx: 50, dy: 20 }]]));
  assert.equal(out[0].x, 50);
  assert.equal(out[0].y, 20);
  assert.deepEqual(out[0].points, [[0, 0], [100, 50]]);
});

test('applyLayout: empty deltas returns input untouched', () => {
  const els = [box('r', 0, 0, 10, 10, { type: 'rectangle' })];
  const out = applyLayout(els, new Map());
  assert.equal(out, els);
});
