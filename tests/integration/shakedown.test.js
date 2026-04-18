// tests/integration/shakedown.test.js
//
// End-to-end exercise of every major feature shipped so far: session init,
// AI turn with merge + write-version, restructure op archives priors,
// sweep-archive endpoint, arrange (column + grid) via /arrange endpoint,
// branch subcommand, export-transcript. Server-backed for the HTTP paths.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';

const CLI = new URL('../../bin/wbb.js', import.meta.url).pathname;
const SERVER = new URL('../../server/server.cjs', import.meta.url).pathname;
const run = (args, stdin = '') => execFileSync('node', [CLI, ...args],
  { input: stdin, encoding: 'utf8' });

async function boot(sessionDir) {
  const child = spawn('node', [SERVER, '--session-dir', sessionDir, '--idle-seconds', '120'],
    { stdio: ['pipe', 'pipe', 'pipe'] });
  for (let i = 0; i < 40; i++) {
    const infoPath = join(sessionDir, '.state', 'server-info');
    if (existsSync(infoPath)) {
      return { child, info: JSON.parse(readFileSync(infoPath, 'utf8')) };
    }
    await wait(100);
  }
  child.kill('SIGTERM');
  throw new Error('server did not start');
}

async function stop(child) {
  await new Promise(r => { child.on('exit', r); child.kill('SIGTERM'); });
}

test('shakedown: init → turn → restructure → sweep → arrange → branch → transcript', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'wbb-shake-'));
  try {
    // 1. Bootstrap a session with an empty template.
    run(['init', '--root', root]);
    const tpl = join(root, 'tpl.excalidraw.json');
    writeFileSync(tpl, JSON.stringify({
      type: 'excalidraw', version: 2, elements: [],
      appState: { viewBackgroundColor: '#ffffff' }, files: {},
    }));
    const ns = JSON.parse(run(['new-session', 'general', 'shakedown',
                               '--root', root, '--template', tpl]));

    const { child, info } = await boot(ns.sessionDir);
    try {
      // 2. Turn 1: build 2 stickies, merge, write-version, notify-refresh.
      const spec1 = JSON.stringify([
        { kind: 'sticky', tone: 'question', text: 'Why now?', x: 600, y: 60 },
        { kind: 'sticky', tone: 'insight',  text: 'Anchor: problem > solution', x: 600, y: 160 },
      ]);
      const ai1 = run(['build-scene', '--scene', ns.boardPath], spec1);
      const ai1File = join(root, 'ai1.json'); writeFileSync(ai1File, ai1);
      const merged1 = run(['merge', ns.boardPath, ai1File, '1']);
      const merged1File = join(root, 'merged1.json'); writeFileSync(merged1File, merged1);
      run(['write-version', ns.slug, '1', merged1File, '--root', root]);
      const notify1 = await fetch(info.url + '/notify-refresh', { method: 'POST' });
      assert.equal(notify1.status, 200);

      // 3. Turn 2: restructure op — dims turn-1 AI, adds fresh stickies.
      const latestAfterT1 = JSON.parse(readFileSync(
        join(ns.sessionDir, 'latest.excalidraw.json'), 'utf8'));
      const spec2 = JSON.stringify([
        { kind: 'sticky', tone: 'action', text: 'Kickoff: scope the spike', x: 600, y: 60, op: 'restructure' },
      ]);
      const ai2 = run(['build-scene', '--scene',
                       join(ns.sessionDir, 'latest.excalidraw.json')], spec2);
      const ai2File = join(root, 'ai2.json'); writeFileSync(ai2File, ai2);
      const merged2 = run(['merge',
        join(ns.sessionDir, 'latest.excalidraw.json'), ai2File, '2']);
      const merged2File = join(root, 'merged2.json'); writeFileSync(merged2File, merged2);
      run(['write-version', ns.slug, '2', merged2File, '--root', root]);
      const afterT2 = JSON.parse(readFileSync(
        join(ns.sessionDir, 'latest.excalidraw.json'), 'utf8'));
      const archived = afterT2.elements.filter(e => e.customData && e.customData.archived);
      assert.ok(archived.length >= 2, `expected archived priors, got ${archived.length}`);
      for (const a of archived) {
        assert.equal(a.opacity, 25);
        assert.equal(a.strokeStyle, 'dashed');
      }

      // 4. Sweep-archive: removes dimmed elements.
      const sweepRes = await fetch(info.url + '/sweep-archive', { method: 'POST' });
      const sweep = await sweepRes.json();
      assert.ok(sweep.swept >= 2);
      const afterSweep = JSON.parse(readFileSync(
        join(ns.sessionDir, 'latest.excalidraw.json'), 'utf8'));
      const stillArchived = afterSweep.elements.filter(e =>
        e.customData && e.customData.archived && !e.isDeleted);
      assert.equal(stillArchived.length, 0);

      // 5. Arrange (column, AI scope).
      const arrRes = await fetch(info.url + '/arrange', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ algo: 'column', scope: 'ai' }),
      });
      const arr = await arrRes.json();
      assert.ok(arr.moved >= 1);
      assert.ok(arr.turn);
      const arrFile = join(ns.sessionDir, `board-v${arr.turn}.excalidraw.json`);
      assert.ok(existsSync(arrFile));

      // 6. Arrange (grid, all scope) — exercises the second code path.
      const gridRes = await fetch(info.url + '/arrange', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ algo: 'grid', scope: 'all', cols: 2 }),
      });
      const grid = await gridRes.json();
      assert.ok(grid.turn > arr.turn, 'grid arrange should bump version');

      // 7. Branch the session → fresh slug with same board history.
      const branched = JSON.parse(run(['branch', ns.slug, 'shakedown fork',
                                       '--root', root]));
      assert.ok(branched.slug.includes('shakedown-fork'));
      assert.ok(existsSync(join(branched.sessionDir, 'latest.excalidraw.json')));
      assert.ok(existsSync(join(branched.sessionDir, 'board-v0.excalidraw.json')));
      assert.equal(branched.branchedFrom, ns.slug);

      // 8. Export transcript.
      const md = run(['export-transcript', ns.slug, '--root', root]);
      assert.match(md, new RegExp(ns.slug));
      assert.match(md, /## Turn \d/);
      assert.match(md, /\*\*AI:\*\*/);
    } finally {
      await stop(child);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
