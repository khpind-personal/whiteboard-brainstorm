// tests/integration/init.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../../bin/wbb.js', import.meta.url).pathname;

test('init creates store skeleton; idempotent', () => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-init-'));
  try {
    execFileSync('node', [CLI, 'init', '--root', root]);
    for (const sub of ['10-Sessions', '20-Canvases']) {
      assert.ok(existsSync(join(root, sub)));
    }
    // No Obsidian-specific dirs/files seeded.
    assert.ok(!existsSync(join(root, '.obsidian')));
    assert.ok(!existsSync(join(root, '00-Index.md')));
    assert.ok(!existsSync(join(root, '30-Templates')));

    assert.doesNotThrow(() =>
      execFileSync('node', [CLI, 'init', '--root', root]));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
