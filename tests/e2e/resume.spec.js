import { test, expect } from '@playwright/test';
import { startSession, waitForServer, stopSession } from './_helpers.js';
import { spawn } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

test('resume: kill server, re-start on same session, scene intact', async ({ page }) => {
  const ctx = startSession('general', 'resume-e2e');
  try {
    let info = await waitForServer(ctx.sessionDir);
    await page.goto(info.url);
    await expect(page.locator('#root canvas').first()).toBeVisible({ timeout: 10_000 });

    const marker = { type: 'excalidraw', version: 2, elements: [{
      id: 'marker', type: 'rectangle', x: 10, y: 10, width: 30, height: 30,
      seed: 1, versionNonce: 1, groupIds: [],
    }], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
    writeFileSync(join(ctx.sessionDir, 'content/latest.excalidraw.json'), JSON.stringify(marker));

    await new Promise(resolve => { ctx.proc.on('exit', resolve); ctx.proc.kill('SIGTERM'); });
    await new Promise(r => setTimeout(r, 500));

    const proc2 = spawn('node', [
      new URL('../../server/server.cjs', import.meta.url).pathname,
      '--session-dir', ctx.sessionDir, '--idle-seconds', '30',
    ]);
    ctx.proc = proc2;
    info = await waitForServer(ctx.sessionDir);
    const r = await fetch(info.url + '/content/latest.excalidraw.json');
    const scene = await r.json();
    expect(scene.elements[0].id).toBe('marker');
  } finally { stopSession(ctx); }
});
