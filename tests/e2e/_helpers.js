// tests/e2e/_helpers.js
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PLUGIN = resolve(import.meta.dirname, '../..');
const CLI    = join(PLUGIN, 'bin/wbb.js');

const TEMPLATE_FILENAME = {
  preimpl: 'purpose-constraints.excalidraw.json',
  general: 'blank-with-ping.excalidraw.json',
  mindmap: 'center-node.excalidraw.json',
};

export function startSession(mode, topic = 'e2e-test') {
  const root = mkdtempSync(join(tmpdir(), 'wbb-e2e-'));
  execFileSync('node', [CLI, 'init', '--root', root]);

  const templatePath = join(
    PLUGIN, 'skills/whiteboard-brainstorm/templates', mode, TEMPLATE_FILENAME[mode],
  );
  const nb = JSON.parse(execFileSync('node',
    [CLI, 'new-session', mode, topic, '--root', root, '--template', templatePath],
    { encoding: 'utf8' }));

  // new-session output already places latest.excalidraw.json inside sessionDir,
  // so no extra copy is needed — server can be pointed straight at sessionDir.
  const proc = spawn('node', [join(PLUGIN, 'server/server.cjs'),
    '--session-dir', nb.sessionDir, '--idle-seconds', '60']);
  return { vault: root, slug: nb.slug, sessionDir: nb.sessionDir, proc };
}

export async function waitForServer(sessionDir, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  const infoPath = join(sessionDir, '.state', 'server-info');
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

export async function restartServer(ctx) {
  // SIGKILL, not SIGTERM: SIGTERM triggers server.close() which waits for
  // open SSE connections to drain. The browser tab from page.goto holds
  // one open, so the old server would never exit and this would deadlock.
  await new Promise(resolve => { ctx.proc.on('exit', resolve); ctx.proc.kill('SIGKILL'); });
  try { unlinkSync(join(ctx.sessionDir, '.state/server-info')); } catch (_) {}
  try { unlinkSync(join(ctx.sessionDir, '.state/server-stopped')); } catch (_) {}
  const proc = spawn('node', [
    resolve(import.meta.dirname, '../../server/server.cjs'),
    '--session-dir', ctx.sessionDir, '--idle-seconds', '60',
  ]);
  ctx.proc = proc;
  return await waitForServer(ctx.sessionDir);
}
