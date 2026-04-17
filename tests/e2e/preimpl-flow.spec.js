// tests/e2e/preimpl-flow.spec.js
import { test, expect } from '@playwright/test';
import { startSession, waitForServer, stopSession } from './_helpers.js';

test('preimpl flow: load template, render, post state, simulate ping', async ({ page }) => {
  const ctx = startSession('preimpl', 'preimpl-e2e');
  try {
    const info = await waitForServer(ctx.sessionDir);
    await page.goto(info.url);
    await expect(page.locator('#root canvas')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=PURPOSE')).toBeVisible();
    await expect(page.locator('text=CONSTRAINTS')).toBeVisible();
    await page.locator('#ping').click();
    await page.waitForTimeout(300);
    const fs = await import('node:fs');
    const evt = fs.readFileSync(`${ctx.sessionDir}/state/events.jsonl`, 'utf8').trim();
    expect(evt).toContain('"type":"ping"');
  } finally { stopSession(ctx); }
});
