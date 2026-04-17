// tests/e2e/drawn-ping.spec.js
import { test, expect } from '@playwright/test';
import { startSession, waitForServer, stopSession } from './_helpers.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('drawn @ping text auto-fires a ping event with source=drawn-shape', async ({ page }) => {
  const ctx = startSession('general', 'drawn-ping-e2e');
  try {
    const info = await waitForServer(ctx.sessionDir);
    await page.goto(info.url);
    await expect(page.locator('#root canvas').first()).toBeVisible({ timeout: 10_000 });

    // Use Excalidraw API from page context to inject a @ping text element
    await page.evaluate(async () => {
      const poll = () => new Promise(r => {
        const tick = () => { if (window.__wbb_api) r(window.__wbb_api); else setTimeout(tick, 50); };
        tick();
      });
      // apiRef is set in app.js via excalidrawAPI prop — expose it for tests
      // (we'll set window.__wbb_api in the app.js itself as part of this task)
      const api = await poll();
      const current = api.getSceneElements();
      const newEl = {
        id: 'drawn-ping', type: 'text', x: 200, y: 200, width: 100, height: 30,
        text: '@ping', originalText: '@ping',
        angle: 0, strokeColor: '#1e1e1e', backgroundColor: 'transparent',
        fillStyle: 'solid', strokeWidth: 1.5, strokeStyle: 'solid',
        roughness: 1, opacity: 100, groupIds: [], frameId: null, roundness: null,
        seed: 9001, versionNonce: 9001, isDeleted: false, boundElements: null,
        updated: Date.now(), link: null, locked: false,
        fontSize: 16, fontFamily: 1, textAlign: 'left', verticalAlign: 'top', baseline: 18,
      };
      api.updateScene({ elements: [...current, newEl] });
    });
    await page.waitForTimeout(1000);
    const events = readFileSync(join(ctx.sessionDir, 'state/events.jsonl'), 'utf8').trim();
    expect(events).toContain('"source":"drawn-shape"');
  } finally { stopSession(ctx); }
});
