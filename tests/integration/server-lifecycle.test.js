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

test('POST /state writes content/latest.excalidraw.json', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-state-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = JSON.parse(readFileSync(join(sessionDir, 'state', 'server-info'), 'utf8'));
    const scene = { type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} };
    const res = await fetch(info.url + '/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(scene),
    });
    assert.equal(res.status, 200);
    const stored = JSON.parse(readFileSync(join(sessionDir, 'content', 'latest.excalidraw.json'), 'utf8'));
    assert.equal(stored.type, 'excalidraw');
  } finally {
    child.kill('SIGTERM');
    rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('POST /events appends to state/events.jsonl', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-evt-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = JSON.parse(readFileSync(join(sessionDir, 'state', 'server-info'), 'utf8'));
    await fetch(info.url + '/events', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'ping', note: 'hello' }),
    });
    const events = readFileSync(join(sessionDir, 'state', 'events.jsonl'), 'utf8').trim().split('\n');
    assert.equal(events.length, 1);
    const evt = JSON.parse(events[0]);
    assert.equal(evt.type, 'ping');
    assert.equal(evt.note, 'hello');
    assert.ok(evt.timestamp > 0);
  } finally {
    await new Promise(resolve => { child.on('exit', resolve); child.kill('SIGTERM'); });
    rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('SSE /events-stream pushes refresh when content/latest changes', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-sse-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = JSON.parse(readFileSync(join(sessionDir, 'state', 'server-info'), 'utf8'));
    const res = await fetch(info.url + '/events-stream');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    // touch the file
    const contentPath = join(sessionDir, 'content', 'latest.excalidraw.json');
    import('node:fs').then(fs => {
      fs.writeFileSync(contentPath, JSON.stringify({
        type: 'excalidraw', version: 2, elements: [], appState: {}, files: {},
      }));
    });

    let buf = '';
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      const { value } = await reader.read();
      if (value) buf += decoder.decode(value);
      if (buf.includes('event: refresh')) break;
    }
    assert.match(buf, /event: refresh/);
    reader.cancel();
  } finally {
    await new Promise(resolve => { child.on('exit', resolve); child.kill('SIGTERM'); });
    rmSync(sessionDir, { recursive: true, force: true });
  }
});
