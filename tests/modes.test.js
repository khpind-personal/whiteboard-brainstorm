import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMode, listModes } from '../lib/modes.js';

test('listModes returns preimpl, general, mindmap', () => {
  assert.deepEqual(listModes().sort(), ['general', 'mindmap', 'preimpl']);
});

test('loadMode returns prompt string containing placeholders', () => {
  for (const mode of ['preimpl', 'general', 'mindmap']) {
    const prompt = loadMode(mode);
    assert.ok(prompt.length > 50);
    assert.ok(prompt.includes('{user_scene}'));
    assert.ok(prompt.includes('{events}'));
  }
});

test('loadMode throws on unknown', () => {
  assert.throws(() => loadMode('banana'), /unknown/);
});
