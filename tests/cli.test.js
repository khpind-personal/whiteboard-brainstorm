import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

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
