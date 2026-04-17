// tests/integration/turn-loop.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../../bin/wbb.js', import.meta.url).pathname;
const run = (args, stdin = '') => execFileSync('node', [CLI, ...args],
  { input: stdin, encoding: 'utf8' });

test('end-to-end: vault-init → new-board → build → merge → write-version', () => {
  const vault = mkdtempSync(join(tmpdir(), 'wbb-e2e-'));
  try {
    run(['vault-init', vault]);
    assert.ok(existsSync(join(vault, '00-Index.md')));

    // minimal template
    const tmpl = join(vault, '30-Templates/preimpl/min.excalidraw.json');
    writeFileSync(tmpl, JSON.stringify({
      type: 'excalidraw', version: 2, elements: [],
      appState: { viewBackgroundColor: '#ffffff' }, files: {},
    }));

    const nb = JSON.parse(run(['new-board', vault, 'preimpl', tmpl, 'turn-loop-test']));
    assert.ok(nb.slug);
    assert.ok(existsSync(nb.boardPath));

    const spec = JSON.stringify([
      { kind: 'sticky', tone: 'question', text: 'what is X?', x: 200, y: 200 },
    ]);
    const aiJson = run(['build-scene'], spec);
    const aiFile = join(vault, '_ai.json');
    writeFileSync(aiFile, aiJson);

    const merged = JSON.parse(run(['merge', nb.boardPath, aiFile, '1']));
    assert.equal(merged.elements.length, 2);
    assert.ok(merged.elements[0].groupIds.some(g => g.startsWith('ai-v1')));

    const mergedFile = join(vault, '_merged.json');
    writeFileSync(mergedFile, JSON.stringify(merged));
    const v1Path = run(['write-version', vault, nb.slug, '1', mergedFile]);
    assert.ok(existsSync(v1Path.trim()));

    run(['moc-append', vault, nb.slug, 'preimpl', '1', 'turn-loop-test']);
    const moc = readFileSync(join(vault, '00-Index.md'), 'utf8');
    assert.match(moc, new RegExp(nb.slug));
  } finally {
    rmSync(vault, { recursive: true, force: true });
  }
});
