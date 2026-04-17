// tests/integration/export-png.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const CLI = new URL('../../bin/wbb.js', import.meta.url).pathname;

// Playwright may hang in the Claude Code sandbox. Skip in that environment.
// Set WBB_SKIP_PLAYWRIGHT=1 to opt out (e.g. in sandbox); default runs the test.
const SKIP = process.env.WBB_SKIP_PLAYWRIGHT === '1';

test('wbb export-png produces a valid PNG file', { skip: SKIP }, async () => {
  const vault = mkdtempSync(join(tmpdir(), 'wbb-exp-'));
  try {
    execFileSync('node', [CLI, 'vault-init', vault]);
    const slug = 'export-test';
    const dir = join(vault, '20-Canvases', slug);
    mkdirSync(dir, { recursive: true });
    const scene = {
      type: 'excalidraw', version: 2,
      elements: [{
        id: 'r1', type: 'rectangle', x: 100, y: 100, width: 200, height: 100,
        angle: 0, strokeColor: '#1e1e1e', backgroundColor: '#FFEB9C',
        fillStyle: 'solid', strokeWidth: 1.5, strokeStyle: 'solid',
        roughness: 1, opacity: 100, groupIds: [], frameId: null,
        roundness: { type: 3 }, seed: 1, versionNonce: 1, isDeleted: false,
        boundElements: null, updated: 1, link: null, locked: false,
      }],
      appState: { viewBackgroundColor: '#ffffff' }, files: {},
    };
    writeFileSync(join(dir, 'latest.excalidraw.json'), JSON.stringify(scene));

    const outPath = execFileSync('node', [CLI, 'export-png', vault, slug], { encoding: 'utf8' }).trim();
    assert.ok(existsSync(outPath));
    const buf = readFileSync(outPath);
    assert.equal(buf[0], 0x89);
    assert.equal(buf[1], 0x50);
    assert.equal(buf[2], 0x4E);
    assert.equal(buf[3], 0x47);
  } finally { rmSync(vault, { recursive: true, force: true }); }
});
