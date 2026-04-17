// tests/e2e/_helpers.js
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PLUGIN = resolve(import.meta.dirname, '../..');
const CLI    = join(PLUGIN, 'bin/wbb.js');

export function startSession(mode, topic = 'e2e-test') {
  const vault = mkdtempSync(join(tmpdir(), 'wbb-e2e-'));
  execFileSync('node', [CLI, 'vault-init', vault]);

  execFileSync('cp', ['-r',
    join(PLUGIN, 'skills/whiteboard-brainstorm/templates/', mode) + '/.',
    join(vault, '30-Templates', mode),
  ]);
  const template = join(vault, '30-Templates', mode,
    mode === 'preimpl' ? 'purpose-constraints.excalidraw.json'
    : mode === 'general' ? 'blank-with-ping.excalidraw.json'
    : 'center-node.excalidraw.json');
  const nb = JSON.parse(execFileSync('node', [CLI, 'new-board',
    vault, mode, template, topic], { encoding: 'utf8' }));

  const sessionDir = join(vault, '_state', nb.slug);
  execFileSync('mkdir', ['-p', join(sessionDir, 'content')]);
  copyFileSync(nb.boardPath, join(sessionDir, 'content', 'latest.excalidraw.json'));

  const proc = spawn('node', [join(PLUGIN, 'server/server.cjs'),
    '--session-dir', sessionDir, '--idle-seconds', '60']);
  return { vault, slug: nb.slug, sessionDir, proc };
}

export async function waitForServer(sessionDir, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  const infoPath = join(sessionDir, 'state', 'server-info');
  while (Date.now() < deadline) {
    try {
      const info = JSON.parse(readFileSync(infoPath, 'utf8'));
      return info;
    } catch (_) { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
}

export function stopSession(ctx) {
  ctx.proc.kill('SIGTERM');
  execFileSync('rm', ['-rf', ctx.vault]);
}
