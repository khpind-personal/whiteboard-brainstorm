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

test('GET /versions returns [] when vault-root/slug are not provided', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-ver-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = JSON.parse(readFileSync(join(sessionDir, 'state', 'server-info'), 'utf8'));
    const res = await fetch(info.url + '/versions');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, []);
  } finally {
    await new Promise(resolve => { child.on('exit', resolve); child.kill('SIGTERM'); });
    rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('GET /versions + /versions/:n serve vault board-v*.excalidraw.json when configured', async () => {
  const vault = mkdtempSync(join(tmpdir(), 'wbb-vault-'));
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-sd-'));
  const slug = 'test-slug';
  const vDir = join(vault, '20-Canvases', slug);
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(vDir, { recursive: true });
  writeFileSync(join(vDir, 'board-v0.excalidraw.json'),
    JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
  writeFileSync(join(vDir, 'board-v1.excalidraw.json'),
    JSON.stringify({ type: 'excalidraw', version: 2,
      elements: [{ id: 'x', type: 'rectangle', x: 0, y: 0, width: 10, height: 10,
                   seed: 1, versionNonce: 1, groupIds: [] }],
      appState: {}, files: {} }));

  const child = spawn('node', ['server/server.cjs',
    '--session-dir', sessionDir,
    '--idle-seconds', '5',
    '--vault-root', vault,
    '--slug', slug,
  ], { stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    await wait(1200);
    const info = JSON.parse(readFileSync(join(sessionDir, 'state', 'server-info'), 'utf8'));
    const list = await (await fetch(info.url + '/versions')).json();
    assert.equal(list.length, 2);
    assert.deepEqual(list.map(x => x.n).sort((a, b) => a - b), [0, 1]);
    const v1 = await (await fetch(info.url + '/versions/1')).json();
    assert.equal(v1.elements[0].id, 'x');
    const missing = await fetch(info.url + '/versions/99');
    assert.equal(missing.status, 404);
  } finally {
    await new Promise(resolve => { child.on('exit', resolve); child.kill('SIGTERM'); });
    rmSync(sessionDir, { recursive: true, force: true });
    rmSync(vault, { recursive: true, force: true });
  }
});
