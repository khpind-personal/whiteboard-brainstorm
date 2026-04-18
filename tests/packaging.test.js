import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';

test('Claude packaging manifest exists', () => {
  assert.equal(existsSync('.claude-plugin/plugin.json'), true);
});

test('Claude marketplace manifest exists', () => {
  assert.equal(existsSync('.claude-plugin/marketplace.json'), true);
});

test('Codex marketplace exists', () => {
  assert.equal(existsSync('.agents/plugins/marketplace.json'), true);
});

test('Root AGENTS.md exposes whiteboard-brainstorm', () => {
  const text = readFileSync('AGENTS.md', 'utf8');
  assert.match(text, /whiteboard-brainstorm/);
});

test('skill launches into the default blocking wait after sharing the canvas URL', () => {
  const text = readFileSync('skills/whiteboard-brainstorm/SKILL.md', 'utf8');
  assert.match(text, /Immediately enter the Auto-poll wait/);
});

test('skill keeps auto-poll active after each processed turn', () => {
  const text = readFileSync('skills/whiteboard-brainstorm/SKILL.md', 'utf8');
  assert.doesNotMatch(text, /Do NOT auto-loop/);
  assert.match(text, /After replying, immediately enter the Auto-poll wait again/);
});

test('packaged Codex skill keeps the same default loop contract', () => {
  const text = readFileSync('plugins/whiteboard-brainstorm/skills/whiteboard-brainstorm/SKILL.md', 'utf8');
  assert.match(text, /Immediately enter the Auto-poll wait/);
  assert.match(text, /After replying, immediately enter the Auto-poll wait again/);
});

test('skill documents Codex foreground server fallback for reaped background jobs', () => {
  const text = readFileSync('skills/whiteboard-brainstorm/SKILL.md', 'utf8');
  assert.match(text, /Codex foreground fallback/);
  assert.match(text, /node <plugin>\/server\/server\.cjs --session-dir <sessionDir>/);
});

for (const path of [
  'plugins/whiteboard-brainstorm/.codex-plugin/plugin.json',
  'plugins/whiteboard-brainstorm/AGENTS.md',
  'plugins/whiteboard-brainstorm/package.json',
  'plugins/whiteboard-brainstorm/package-lock.json',
  'plugins/whiteboard-brainstorm/bin/wbb.js',
  'plugins/whiteboard-brainstorm/lib/export.js',
  'plugins/whiteboard-brainstorm/server/start-board-server.sh',
  'plugins/whiteboard-brainstorm/skills/whiteboard-brainstorm/SKILL.md',
]) {
  test(`Codex bundle includes ${path}`, () => {
    assert.equal(existsSync(path), true);
  });
}

test('Codex bundle excludes generated export temp files', () => {
  const files = readdirSync('plugins/whiteboard-brainstorm/server/public')
    .filter((file) => file.startsWith('_export_tmp_') && file.endsWith('.html'));

  assert.deepEqual(files, []);
});

for (const path of [
  'skills/whiteboard-brainstorm/SKILL.md',
  'skills/whiteboard-brainstorm/modes/general.md',
  'skills/whiteboard-brainstorm/modes/preimpl.md',
  'skills/whiteboard-brainstorm/modes/mindmap.md',
]) {
  test(`${path} uses neutral assistant wording`, () => {
    const text = readFileSync(path, 'utf8');
    assert.equal(text.includes('You are Claude'), false);
    assert.equal(text.includes('Question for Claude'), false);
    assert.equal(text.includes('Claude replaces'), false);
  });
}
