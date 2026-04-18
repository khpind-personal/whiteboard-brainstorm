// tests/integration/arrange.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../../bin/wbb.js', import.meta.url).pathname;
const run = (args, stdin = '') => execFileSync('node', [CLI, ...args],
  { input: stdin, encoding: 'utf8' });

test('wbb arrange column scope=ai collapses AI elements into one column', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-arr-'));
  try {
    run(['init', '--root', root]);
    const tpl = join(root, 'tpl.excalidraw.json');
    writeFileSync(tpl, JSON.stringify({
      type: 'excalidraw', version: 2, elements: [],
      appState: { viewBackgroundColor: '#ffffff' }, files: {},
    }));
    const nb = JSON.parse(run(['new-session', 'general', 'arrange test',
                               '--root', root, '--template', tpl]));

    // Merge 3 AI stickies at scattered positions into v1.
    const spec = JSON.stringify([
      { kind: 'sticky', tone: 'insight',  text: 'one',   x: 50,  y: 50  },
      { kind: 'sticky', tone: 'warning',  text: 'two',   x: 900, y: 600 },
      { kind: 'sticky', tone: 'question', text: 'three', x: 400, y: 900 },
    ]);
    const aiFile = join(root, '_ai.json');
    writeFileSync(aiFile, run(['build-scene'], spec));
    const merged = JSON.parse(run(['merge', nb.boardPath, aiFile, '1']));
    const mergedFile = join(root, '_merged.json');
    writeFileSync(mergedFile, JSON.stringify(merged));
    run(['write-version', nb.slug, '1', mergedFile, '--root', root]);

    // Run arrange.
    const r = JSON.parse(run(['arrange', nb.slug, '--algo', 'column',
                              '--scope', 'ai', '--start-x', '1000',
                              '--start-y', '100', '--root', root]));
    assert.equal(r.moved, 3);
    assert.ok(r.turn >= 2);

    const v2 = JSON.parse(readFileSync(
      join(nb.sessionDir, `board-v${r.turn}.excalidraw.json`), 'utf8'));
    const aiRects = v2.elements.filter(e =>
      e.type === 'rectangle' && e.customData && e.customData.source === 'ai');
    assert.equal(aiRects.length, 3);
    // All AI rects share a single x coordinate (one column).
    const xs = new Set(aiRects.map(r => r.x));
    assert.equal(xs.size, 1);
    // y coordinates are strictly increasing.
    const ys = aiRects.map(r => r.y).sort((a, b) => a - b);
    assert.ok(ys[0] < ys[1] && ys[1] < ys[2]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('wbb arrange returns moved:0 when session has no AI elements', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-arr-'));
  try {
    run(['init', '--root', root]);
    const tpl = join(root, 'tpl.excalidraw.json');
    writeFileSync(tpl, JSON.stringify({
      type: 'excalidraw', version: 2, elements: [],
      appState: { viewBackgroundColor: '#ffffff' }, files: {},
    }));
    const nb = JSON.parse(run(['new-session', 'general', 'empty',
                               '--root', root, '--template', tpl]));
    const r = JSON.parse(run(['arrange', nb.slug, '--scope', 'ai', '--root', root]));
    assert.equal(r.moved, 0);
    assert.equal(r.turn, null);
    // No new board version written.
    assert.ok(!existsSync(join(nb.sessionDir, 'board-v1.excalidraw.json')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
