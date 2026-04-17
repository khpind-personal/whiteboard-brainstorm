import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../bin/wbb.js', import.meta.url).pathname;
const run = (args, { input, env } = {}) => execFileSync('node', [CLI, ...args], {
  input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, ...(env || {}) },
});

test('wbb --help prints subcommand list', () => {
  const out = run(['--help']);
  for (const cmd of ['build-scene', 'parse-tags', 'merge', 'validate',
                     'init', 'new-session', 'write-version', 'compact',
                     'list-sessions', 'list-templates', 'default-template',
                     'export-png', 'session-dir']) {
    assert.match(out, new RegExp(cmd));
  }
});

test('wbb build-scene reads spec from stdin and outputs valid scene JSON', () => {
  const spec = JSON.stringify([{ kind: 'sticky', tone: 'question', text: 'hi', x: 0, y: 0 }]);
  const out = run(['build-scene'], { input: spec });
  const elements = JSON.parse(out);
  assert.equal(elements.length, 2);
  assert.equal(elements[0].type, 'rectangle');
});

test('wbb validate returns exit 0 on valid, non-zero on invalid', () => {
  const good = JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} });
  assert.doesNotThrow(() => run(['validate'], { input: good }));
  const bad = JSON.stringify({ nope: true });
  assert.throws(() => run(['validate'], { input: bad }));
});

test('wbb init + new-session creates session with boardPath', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-cli-'));
  run(['init', '--root', root]);
  assert.ok(existsSync(join(root, '20-Canvases')));
  const out = run(['new-session', 'general', 'topic a', '--root', root]);
  const r = JSON.parse(out);
  assert.ok(r.slug.includes('topic-a'));
  assert.ok(existsSync(r.boardPath));
  assert.ok(existsSync(join(r.sessionDir, 'latest.excalidraw.json')));
});

test('wbb write-version creates board-v<n>.excalidraw.json', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-wv-'));
  const created = JSON.parse(run(['new-session', 'general', 'x', '--root', root]));
  const sceneFile = join(tmpdir(), `wbb-scene-${Date.now()}.json`);
  writeFileSync(sceneFile, JSON.stringify({
    type: 'excalidraw', version: 2, elements: [], appState: {}, files: {},
  }));
  run(['write-version', created.slug, '5', sceneFile, '--root', root]);
  assert.ok(existsSync(join(created.sessionDir, 'board-v5.excalidraw.json')));
});

test('wbb compact moves boards older than latest 10 to .archive', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-comp-'));
  const created = JSON.parse(run(['new-session', 'general', 'c', '--root', root]));
  for (let i = 1; i < 55; i++) {
    writeFileSync(join(created.sessionDir, `board-v${i}.excalidraw.json`),
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
  }
  run(['compact', created.slug, '--root', root]);
  assert.ok(existsSync(join(created.sessionDir, '.archive')));
  const remaining = readdirSync(created.sessionDir).filter(f => /^board-v\d+/.test(f));
  assert.ok(remaining.length <= 11);
});

test('wbb list-templates returns JSON array of built-in templates for a mode', () => {
  const out = JSON.parse(run(['list-templates', 'preimpl']));
  assert.ok(out.length > 0);
  for (const t of out) {
    assert.ok(t.id);
    assert.ok(t.path.endsWith('.excalidraw.json'));
  }
});

test('wbb default-template prints path for a mode', () => {
  const p = run(['default-template', 'general']);
  assert.match(p, /blank-with-ping\.excalidraw\.json$/);
});

test('wbb list-sessions returns JSON array of slugs', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-ls-'));
  const a = JSON.parse(run(['new-session', 'general', 'alpha', '--root', root]));
  const b = JSON.parse(run(['new-session', 'general', 'bravo', '--root', root]));
  const slugs = JSON.parse(run(['list-sessions', '--root', root]));
  assert.ok(slugs.includes(a.slug));
  assert.ok(slugs.includes(b.slug));
});

test('wbb session-dir resolves path for slug', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-sd-'));
  const r = JSON.parse(run(['new-session', 'general', 'd', '--root', root]));
  const path = run(['session-dir', r.slug, '--root', root]);
  assert.equal(path, r.sessionDir);
});

test('WBB_ROOT env var works when --root omitted', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-env-'));
  const out = run(['new-session', 'general', 'e'], { env: { WBB_ROOT: root } });
  const r = JSON.parse(out);
  assert.ok(r.root === root);
  assert.ok(existsSync(r.boardPath));
});
