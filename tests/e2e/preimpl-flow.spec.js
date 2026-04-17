import { test, expect } from '@playwright/test';
import { startSession, waitForServer, stopSession } from './_helpers.js';

test('preimpl flow: load template, render, post state, simulate ping', async ({ page }) => {
  const ctx = startSession('preimpl', 'preimpl-e2e');
  try {
    const info = await waitForServer(ctx.sessionDir);
    await page.goto(info.url);
    // Canvas mounts
    await expect(page.locator('#root canvas').first()).toBeVisible({ timeout: 10_000 });
    // Scene served contains the seed panels (canvas text isn't queryable, so check JSON)
    const sceneRes = await page.request.get(info.url + '/content/latest.excalidraw.json');
    const scene = await sceneRes.json();
    const panelTexts = scene.elements.filter(e => e.type === 'text').map(e => e.text);
    expect(panelTexts.some(t => t.includes('PURPOSE'))).toBeTruthy();
    expect(panelTexts.some(t => t.includes('CONSTRAINTS'))).toBeTruthy();
    // Ping button posts event
    await page.locator('#ping').click();
    await page.waitForTimeout(300);
    const fs = await import('node:fs');
    const evt = fs.readFileSync(`${ctx.sessionDir}/state/events.jsonl`, 'utf8').trim();
    expect(evt).toContain('"type":"ping"');
  } finally { stopSession(ctx); }
});
