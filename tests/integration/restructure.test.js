// tests/integration/restructure.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../../bin/wbb.js', import.meta.url).pathname;
const run = (args, stdin = '') => execFileSync('node', [CLI, ...args],
  { input: stdin, encoding: 'utf8' });

test('build-scene propagates spec.op to every built element customData', () => {
  const spec = JSON.stringify([
    { kind: 'sticky', tone: 'insight', text: 'hi', x: 0, y: 0, op: 'restructure' },
    { kind: 'panel', title: 'T', body: 'B', x: 500, y: 0, op: 'restructure' },
  ]);
  const out = JSON.parse(run(['build-scene'], spec));
  for (const el of out) {
    assert.equal(el.customData && el.customData.op, 'restructure',
      `element type ${el.type} missing op`);
  }
  // Sticky emits rect + text (2 elements). Panel emits rect + title + body (3).
  assert.equal(out.length, 5);
});

test('merge with restructure element archives priors', () => {
  // Drive via CLI: build, merge, inspect.
  const userScene = JSON.stringify({
    type: 'excalidraw', version: 2,
    elements: [{
      id: 'prior-rect', type: 'rectangle',
      x: 0, y: 0, width: 100, height: 50,
      strokeColor: '#1e1e1e', backgroundColor: '#FFEB9C',
      fillStyle: 'solid', strokeWidth: 1.5, strokeStyle: 'solid',
      roughness: 1, opacity: 100, groupIds: ['sticky-prior'],
      frameId: null, roundness: { type: 3 }, seed: 1, versionNonce: 1,
      isDeleted: false, boundElements: [], updated: 1,
      link: null, locked: false,
      customData: { source: 'ai', turn: 1 },
    }],
    appState: {}, files: {},
  });
  const dir = mkdtempSync(join(tmpdir(), 'wbb-rs-'));
  try {
    const userFile = join(dir, 'user.json');
    writeFileSync(userFile, userScene);
    const spec = JSON.stringify([
      { kind: 'sticky', tone: 'insight', text: 'new', x: 500, y: 0, op: 'restructure' },
    ]);
    const aiJson = run(['build-scene'], spec);
    const aiFile = join(dir, 'ai.json');
    writeFileSync(aiFile, aiJson);
    const merged = JSON.parse(run(['merge', userFile, aiFile, '2']));
    const archived = merged.elements.find(e => e.id === 'prior-rect');
    assert.equal(archived.opacity, 25);
    assert.equal(archived.strokeStyle, 'dashed');
    assert.equal(archived.customData.archived, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
