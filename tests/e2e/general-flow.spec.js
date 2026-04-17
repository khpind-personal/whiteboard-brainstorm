import { test, expect } from '@playwright/test';
import { startSession, waitForServer, stopSession } from './_helpers.js';

test('general flow: blank template with instruction sticky renders', async ({ page }) => {
  const ctx = startSession('general', 'general-e2e');
  try {
    const info = await waitForServer(ctx.sessionDir);
    await page.goto(info.url);
    await expect(page.locator('#root canvas').first()).toBeVisible({ timeout: 10_000 });
    const sceneRes = await page.request.get(info.url + '/content/latest.excalidraw.json');
    const scene = await sceneRes.json();
    const texts = scene.elements.filter(e => e.type === 'text').map(e => e.text);
    expect(texts.some(t => t.includes('@ping'))).toBeTruthy();
  } finally { stopSession(ctx); }
});
