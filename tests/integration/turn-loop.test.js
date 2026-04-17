// tests/integration/turn-loop.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../../bin/wbb.js', import.meta.url).pathname;
const run = (args, stdin = '') => execFileSync('node', [CLI, ...args],
  { input: stdin, encoding: 'utf8' });

test('end-to-end: init → new-session → build → merge → write-version', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-e2e-'));
  try {
    run(['init', '--root', root]);
    // Use an empty template so the assertion on merged element count is exact.
    const tpl = join(root, 'tpl.excalidraw.json');
    writeFileSync(tpl, JSON.stringify({
      type: 'excalidraw', version: 2, elements: [],
      appState: { viewBackgroundColor: '#ffffff' }, files: {},
    }));
    const nb = JSON.parse(run(['new-session', 'preimpl', 'turn loop test',
                               '--root', root, '--template', tpl]));
    assert.ok(nb.slug);
    assert.ok(existsSync(nb.boardPath));

    const spec = JSON.stringify([
      { kind: 'sticky', tone: 'question', text: 'what is X?', x: 200, y: 200 },
    ]);
    const aiJson = run(['build-scene'], spec);
    const aiFile = join(root, '_ai.json');
    writeFileSync(aiFile, aiJson);

    const merged = JSON.parse(run(['merge', nb.boardPath, aiFile, '1']));
    assert.equal(merged.elements.length, 2);
    assert.ok(merged.elements[0].groupIds.some(g => g.startsWith('ai-v1')));

    const mergedFile = join(root, '_merged.json');
    writeFileSync(mergedFile, JSON.stringify(merged));
    const v1Path = run(['write-version', nb.slug, '1', mergedFile, '--root', root]);
    assert.ok(existsSync(v1Path.trim()));
    assert.ok(v1Path.includes('board-v1.excalidraw.json'));

    // write-version also refreshes latest.excalidraw.json in same dir.
    const latest = JSON.parse(
      readFileSync(join(nb.sessionDir, 'latest.excalidraw.json'), 'utf8'));
    assert.equal(latest.elements.length, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
