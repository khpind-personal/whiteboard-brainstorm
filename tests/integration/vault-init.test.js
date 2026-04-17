// tests/integration/vault-init.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = new URL('../../bin/wbb.js', import.meta.url).pathname;

test('vault-init idempotent; preserves existing 00-Index.md content', () => {
  const v = mkdtempSync(join(tmpdir(), 'wbb-vi-'));
  try {
    execFileSync('node', [CLI, 'vault-init', v]);
    const custom = '\n- [[foo]] — custom entry\n';
    appendFileSync(join(v, '00-Index.md'), custom);

    execFileSync('node', [CLI, 'vault-init', v]);
    assert.match(readFileSync(join(v, '00-Index.md'), 'utf8'), /custom entry/);

    for (const sub of ['10-Sessions', '20-Canvases', '30-Templates/preimpl']) {
      assert.ok(existsSync(join(v, sub)));
    }
  } finally { rmSync(v, { recursive: true, force: true }); }
});
