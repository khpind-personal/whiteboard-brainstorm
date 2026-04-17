import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

function bootServer(sessionDir) {
  const child = spawn('node', ['server/server.cjs',
    '--session-dir', sessionDir, '--idle-seconds', '5'], { stdio: ['pipe', 'pipe', 'pipe'] });
  return child;
}

test('server writes server-info with url and port when it starts', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-srv-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const infoPath = join(sessionDir, 'state', 'server-info');
    assert.ok(existsSync(infoPath), 'server-info missing');
    const info = JSON.parse(readFileSync(infoPath, 'utf8'));
    assert.ok(info.port >= 50000 && info.port < 60000);
    assert.match(info.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  } finally {
    child.kill('SIGTERM');
    rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('server responds to GET / with HTML page', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-srv-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = JSON.parse(readFileSync(join(sessionDir, 'state', 'server-info'), 'utf8'));
    const res = await fetch(info.url + '/');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<html/i);
  } finally {
    child.kill('SIGTERM');
    rmSync(sessionDir, { recursive: true, force: true });
  }
});
