import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateScene, validateElement, REQUIRED_ELEMENT_FIELDS } from '../lib/schema.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/sample-user-scene.excalidraw.json', import.meta.url))
);

test('validateScene accepts a real exported scene', () => {
  const result = validateScene(fixture);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test('validateScene rejects missing top-level `elements` array', () => {
  const bad = { type: 'excalidraw', version: 2, appState: {} };
  const result = validateScene(bad);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /elements/);
});

test('validateElement requires id, type, x, y, width, height, seed, versionNonce', () => {
  const missing = { type: 'rectangle', x: 0, y: 0, width: 10, height: 10 };
  const { ok, errors } = validateElement(missing);
  assert.equal(ok, false);
  for (const f of ['id', 'seed', 'versionNonce']) {
    assert.ok(errors.some(e => e.includes(f)), `expected error for ${f}`);
  }
});

test('validateElement accepts known Excalidraw element types', () => {
  for (const type of ['rectangle', 'ellipse', 'diamond', 'arrow', 'line', 'text', 'image']) {
    const el = {
      id: 'x', type, x: 0, y: 0, width: 10, height: 10,
      seed: 1, versionNonce: 1,
    };
    assert.equal(validateElement(el).ok, true, `type ${type} should validate`);
  }
});

test('validateElement rejects unknown element type', () => {
  const el = { id: 'x', type: 'banana', x: 0, y: 0, width: 10, height: 10, seed: 1, versionNonce: 1 };
  assert.equal(validateElement(el).ok, false);
});

test('REQUIRED_ELEMENT_FIELDS is stable', () => {
  assert.deepEqual(REQUIRED_ELEMENT_FIELDS.sort(),
    ['height', 'id', 'seed', 'type', 'versionNonce', 'width', 'x', 'y']);
});
