import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

function bootServer(sessionDir) {
  return spawn('node', ['server/server.cjs',
    '--session-dir', sessionDir, '--idle-seconds', '5'], { stdio: ['pipe', 'pipe', 'pipe'] });
}

function readServerInfo(sessionDir) {
  return JSON.parse(readFileSync(join(sessionDir, '.state', 'server-info'), 'utf8'));
}

async function stopAndCleanup(child, sessionDir) {
  await new Promise(resolve => { child.on('exit', resolve); child.kill('SIGTERM'); });
  rmSync(sessionDir, { recursive: true, force: true });
}

test('server writes server-info with url and port when it starts', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-srv-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const infoPath = join(sessionDir, '.state', 'server-info');
    assert.ok(existsSync(infoPath), 'server-info missing');
    const info = JSON.parse(readFileSync(infoPath, 'utf8'));
    assert.ok(info.port >= 50000 && info.port < 60000);
    assert.match(info.url, /^http:\/\/127\.0\.0\.1:\d+$/);
  } finally {
    await stopAndCleanup(child, sessionDir);
  }
});

test('start script ignores stale server-info from previous runs', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-start-script-'));
  mkdirSync(join(sessionDir, '.state'), { recursive: true });
  writeFileSync(join(sessionDir, '.state', 'server-info'),
    JSON.stringify({ port: 59999, host: '127.0.0.1', url: 'http://127.0.0.1:59999', pid: 123 }));
  writeFileSync(join(sessionDir, '.state', 'server-stopped'), 'old-stop\n');

  try {
    const out = execFileSync('server/start-board-server.sh', [sessionDir, '--idle-seconds', '5'],
      { encoding: 'utf8' });
    const info = JSON.parse(out);
    assert.notEqual(info.pid, 123);
    assert.notEqual(info.port, 59999);
    assert.equal(existsSync(join(sessionDir, '.state', 'server-stopped')), false);
    const res = await fetch(info.url + '/health');
    assert.equal(res.status, 200);
  } finally {
    try { execFileSync('server/stop-board-server.sh', [sessionDir]); } catch {}
    await wait(200);
    rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('server responds to GET / with HTML page', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-srv-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = readServerInfo(sessionDir);
    const res = await fetch(info.url + '/');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /<html/i);
  } finally {
    await stopAndCleanup(child, sessionDir);
  }
});

test('POST /state writes latest.excalidraw.json in session dir', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-state-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = readServerInfo(sessionDir);
    const scene = { type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} };
    const res = await fetch(info.url + '/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(scene),
    });
    assert.equal(res.status, 200);
    const stored = JSON.parse(readFileSync(join(sessionDir, 'latest.excalidraw.json'), 'utf8'));
    assert.equal(stored.type, 'excalidraw');
  } finally {
    await stopAndCleanup(child, sessionDir);
  }
});

test('POST /state sanitizes null text heights from Excalidraw', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-sanitize-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = readServerInfo(sessionDir);
    // Excalidraw sometimes serializes bound text with null height — this would
    // render invisible on reload. Server should fill it in.
    const scene = {
      type: 'excalidraw', version: 2,
      elements: [{
        id: 't1', type: 'text', x: 0, y: 0, width: 200, height: null,
        text: 'line one\nline two\nline three',
        fontSize: 16, fontFamily: 2,
      }],
      appState: {}, files: {},
    };
    await fetch(info.url + '/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(scene),
    });
    const stored = JSON.parse(readFileSync(join(sessionDir, 'latest.excalidraw.json'), 'utf8'));
    const t = stored.elements[0];
    assert.ok(typeof t.height === 'number' && t.height > 0,
      `expected sanitized height, got ${t.height}`);
  } finally {
    await stopAndCleanup(child, sessionDir);
  }
});

test('POST /events appends to .state/events.jsonl', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-evt-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = readServerInfo(sessionDir);
    await fetch(info.url + '/events', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'ping', note: 'hello' }),
    });
    const events = readFileSync(join(sessionDir, '.state', 'events.jsonl'), 'utf8').trim().split('\n');
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

test('SSE /events-stream pushes refresh when latest.excalidraw.json changes', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-sse-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = readServerInfo(sessionDir);
    const res = await fetch(info.url + '/events-stream');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    writeFileSync(join(sessionDir, 'latest.excalidraw.json'), JSON.stringify({
      type: 'excalidraw', version: 2, elements: [], appState: {}, files: {},
    }));

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

test('GET /versions returns [] when no version files present', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-ver-'));
  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = readServerInfo(sessionDir);
    const res = await fetch(info.url + '/versions');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body, []);
  } finally {
    await new Promise(resolve => { child.on('exit', resolve); child.kill('SIGTERM'); });
    rmSync(sessionDir, { recursive: true, force: true });
  }
});

test('GET /versions + /versions/:n serve board-v*.excalidraw.json in session dir', async () => {
  const sessionDir = mkdtempSync(join(tmpdir(), 'wbb-sd-'));
  // Seed version files in session dir itself — no separate vault lookup.
  writeFileSync(join(sessionDir, 'board-v0.excalidraw.json'),
    JSON.stringify({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} }));
  writeFileSync(join(sessionDir, 'board-v1.excalidraw.json'),
    JSON.stringify({ type: 'excalidraw', version: 2,
      elements: [{ id: 'x', type: 'rectangle', x: 0, y: 0, width: 10, height: 10,
                   seed: 1, versionNonce: 1, groupIds: [] }],
      appState: {}, files: {} }));

  const child = bootServer(sessionDir);
  try {
    await wait(1200);
    const info = readServerInfo(sessionDir);
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
  }
});
