import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  initStore, newSession, writeVersion, listSessions, compactSession,
  sessionDir, resolveRoot, DEFAULT_ROOT,
} from '../lib/store.js';

function freshRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'wbb-store-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('resolveRoot prefers arg, then $WBB_ROOT, then DEFAULT_ROOT', () => {
  const prev = process.env.WBB_ROOT;
  try {
    process.env.WBB_ROOT = '/tmp/from-env';
    assert.equal(resolveRoot('/explicit'), '/explicit');
    assert.equal(resolveRoot(), '/tmp/from-env');
    delete process.env.WBB_ROOT;
    assert.equal(resolveRoot(), DEFAULT_ROOT);
  } finally {
    if (prev === undefined) delete process.env.WBB_ROOT;
    else process.env.WBB_ROOT = prev;
  }
});

test('initStore creates 10-Sessions + 20-Canvases, no Obsidian dirs', () => {
  const { dir, cleanup } = freshRoot();
  try {
    initStore(dir);
    assert.ok(existsSync(join(dir, '10-Sessions')));
    assert.ok(existsSync(join(dir, '20-Canvases')));
    assert.ok(!existsSync(join(dir, '.obsidian')));
    assert.ok(!existsSync(join(dir, '30-Templates')));
    assert.ok(!existsSync(join(dir, '99-Meta')));
    assert.ok(!existsSync(join(dir, '00-Index.md')));
  } finally { cleanup(); }
});

test('initStore is idempotent', () => {
  const { dir, cleanup } = freshRoot();
  try {
    initStore(dir);
    assert.doesNotThrow(() => initStore(dir));
  } finally { cleanup(); }
});

test('newSession creates session dir with v0 + latest + plain-md note', () => {
  const { dir, cleanup } = freshRoot();
  try {
    initStore(dir);
    const tpl = join(dir, 'tpl.excalidraw.json');
    writeFileSync(tpl,
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
    const r = newSession({ rootArg: dir, mode: 'preimpl', templatePath: tpl, topic: 'my topic' });
    assert.ok(r.slug.includes('my-topic'));
    assert.equal(r.sessionDir, sessionDir(dir, r.slug));
    assert.ok(existsSync(join(r.sessionDir, 'board-v0.excalidraw.json')));
    assert.ok(existsSync(join(r.sessionDir, 'latest.excalidraw.json')));
    assert.ok(existsSync(r.notePath));
    const note = readFileSync(r.notePath, 'utf8');
    assert.match(note, /type: brainstorm/);
    assert.match(note, /mode: preimpl/);
  } finally { cleanup(); }
});

test('writeVersion writes versioned + latest file; readable', () => {
  const { dir, cleanup } = freshRoot();
  try {
    initStore(dir);
    const tpl = join(dir, 'tpl.excalidraw.json');
    writeFileSync(tpl,
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
    const { slug } = newSession({ rootArg: dir, mode: 'general', templatePath: tpl, topic: 'x' });
    const scene = { type: 'excalidraw', version: 2, elements: [{ id: 'a' }], appState: {}, files: {} };
    const p = writeVersion({ rootArg: dir, slug, turn: 3, scene });
    assert.ok(p.endsWith('board-v3.excalidraw.json'));
    const round = JSON.parse(readFileSync(join(sessionDir(dir, slug), 'latest.excalidraw.json'), 'utf8'));
    assert.equal(round.elements[0].id, 'a');
  } finally { cleanup(); }
});

test('listSessions returns slugs sorted', () => {
  const { dir, cleanup } = freshRoot();
  try {
    initStore(dir);
    const tpl = join(dir, 'tpl.excalidraw.json');
    writeFileSync(tpl,
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
    newSession({ rootArg: dir, mode: 'general', templatePath: tpl, topic: 'alpha' });
    newSession({ rootArg: dir, mode: 'general', templatePath: tpl, topic: 'bravo' });
    const slugs = listSessions(dir);
    assert.equal(slugs.length, 2);
    assert.ok(slugs[0] < slugs[1]);
  } finally { cleanup(); }
});

test('compactSession archives versions older than latest 10', () => {
  const { dir, cleanup } = freshRoot();
  try {
    initStore(dir);
    const tpl = join(dir, 'tpl.excalidraw.json');
    writeFileSync(tpl,
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
    const { slug } = newSession({ rootArg: dir, mode: 'general', templatePath: tpl, topic: 'c' });
    for (let i = 1; i < 55; i++) {
      writeFileSync(join(sessionDir(dir, slug), `board-v${i}.excalidraw.json`),
        JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
    }
    const r = compactSession({ rootArg: dir, slug });
    assert.ok(r.archived >= 44);
    assert.ok(existsSync(join(sessionDir(dir, slug), '.archive')));
  } finally { cleanup(); }
});
