import { test, expect } from '@playwright/test';
import { startSession, waitForServer, stopSession } from './_helpers.js';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PLUGIN = resolve(import.meta.dirname, '../..');
const CLI = join(PLUGIN, 'bin/wbb.js');

test('concurrent edit: user adds element while AI turn merges — both survive', async () => {
  const ctx = startSession('general', 'concurrent-e2e');
  try {
    const info = await waitForServer(ctx.sessionDir);

    const userScene = {
      type: 'excalidraw', version: 2,
      elements: [{ id: 'user-rect', type: 'rectangle', x: 50, y: 50, width: 40, height: 40,
                   seed: 1, versionNonce: 1, groupIds: [] }],
      appState: { viewBackgroundColor: '#ffffff' }, files: {},
    };
    await fetch(info.url + '/state', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(userScene),
    });

    const spec = JSON.stringify([{ kind: 'sticky', tone: 'insight', text: 'ai', x: 300, y: 300 }]);
    const aiJson = execFileSync('node', [CLI, 'build-scene'], { input: spec, encoding: 'utf8' });
    const aiFile = join(ctx.sessionDir, 'ai.json');
    writeFileSync(aiFile, aiJson);

    userScene.elements.push({ id: 'user-rect-2', type: 'rectangle', x: 100, y: 100, width: 40, height: 40,
                              seed: 2, versionNonce: 2, groupIds: [] });
    const sceneFile = join(ctx.sessionDir, 'latest.excalidraw.json');
    writeFileSync(sceneFile, JSON.stringify(userScene));

    const merged = JSON.parse(execFileSync('node', [CLI, 'merge', sceneFile, aiFile, '1'],
      { encoding: 'utf8' }));

    const ids = merged.elements.map(e => e.id);
    expect(ids).toContain('user-rect');
    expect(ids).toContain('user-rect-2');
    expect(merged.elements.length).toBeGreaterThanOrEqual(4);
  } finally { stopSession(ctx); }
});
