import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initVault, newBoard, mocAppend } from '../lib/vault.js';

function freshVault() {
  const dir = mkdtempSync(join(tmpdir(), 'wbb-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('initVault creates the standard folder tree', () => {
  const { dir, cleanup } = freshVault();
  try {
    initVault(dir);
    for (const sub of ['10-Sessions', '20-Canvases', '30-Templates/preimpl',
                        '30-Templates/general', '30-Templates/mindmap',
                        '99-Meta', '.obsidian']) {
      assert.ok(existsSync(join(dir, sub)), `missing ${sub}`);
    }
    assert.ok(existsSync(join(dir, '00-Index.md')));
  } finally { cleanup(); }
});

test('initVault is idempotent', () => {
  const { dir, cleanup } = freshVault();
  try {
    initVault(dir);
    assert.doesNotThrow(() => initVault(dir));
  } finally { cleanup(); }
});

test('newBoard creates session dir with v0 scene and latest pointer', () => {
  const { dir, cleanup } = freshVault();
  try {
    initVault(dir);
    const templatePath = join(dir, '30-Templates/preimpl/purpose-constraints.excalidraw.json');
    writeFileSync(templatePath,
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
    const { slug, boardPath } = newBoard({ vaultRoot: dir, mode: 'preimpl',
                                            templatePath, topic: 'my topic' });
    assert.ok(slug.includes('my-topic'));
    assert.ok(existsSync(boardPath));
    assert.ok(existsSync(join(dir, '20-Canvases', slug, 'board-v0.excalidraw.json')));
  } finally { cleanup(); }
});

test('mocAppend adds a line to 00-Index.md', () => {
  const { dir, cleanup } = freshVault();
  try {
    initVault(dir);
    mocAppend({ vaultRoot: dir, slug: '2026-04-17-x', mode: 'general', turns: 3, topic: 'x' });
    const moc = readFileSync(join(dir, '00-Index.md'), 'utf8');
    assert.match(moc, /2026-04-17-x/);
    assert.match(moc, /general/);
  } finally { cleanup(); }
});
