import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../bin/wbb.js', import.meta.url).pathname;
const run = (args, input) => execFileSync('node', [CLI, ...args], {
  input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
});

test('wbb --help prints subcommand list', () => {
  const out = run(['--help']);
  for (const cmd of ['build-scene', 'parse-tags', 'merge', 'validate',
                     'vault-init', 'new-board', 'moc-append']) {
    assert.match(out, new RegExp(cmd));
  }
});

test('wbb build-scene reads spec from stdin and outputs valid scene JSON', () => {
  const spec = JSON.stringify([{ kind: 'sticky', tone: 'question', text: 'hi', x: 0, y: 0 }]);
  const out = run(['build-scene'], spec);
  const elements = JSON.parse(out);
  assert.equal(elements.length, 2);
  assert.equal(elements[0].type, 'rectangle');
});

test('wbb validate returns exit 0 on valid, non-zero on invalid', () => {
  const good = JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} });
  assert.doesNotThrow(() => run(['validate'], good));
  const bad = JSON.stringify({ nope: true });
  assert.throws(() => run(['validate'], bad));
});

test('wbb compact moves boards older than the latest 10 to .archive', () => {
  const vault = mkdtempSync(join(tmpdir(), 'wbb-comp-'));
  run(['vault-init', vault]);
  const slug = 'test-session';
  const dir = join(vault, '20-Canvases', slug);
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < 55; i++) {
    writeFileSync(join(dir, `board-v${i}.excalidraw.json`),
      JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
  }
  run(['compact', vault, slug]);
  assert.ok(existsSync(join(dir, '.archive')));
  const remaining = readdirSync(dir).filter(f => f.startsWith('board-v'));
  assert.ok(remaining.length <= 11); // keep ~10 + the compact snapshot
});
